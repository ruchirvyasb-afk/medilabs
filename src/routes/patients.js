import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';
import { allow } from '../middleware/authorize.js';
import { encrypt, decrypt } from '../services/crypto.js';
import { parseReport } from '../services/parser.js';
import { safeSummary } from '../services/summary.js';
import { createPatient, processReport } from '../validators/schemas.js';

const router = Router();

// ── Helpers ──────────────────────────────────────────

async function canAccess(patientId, user) {
  const { rows } = await db.query(
    'SELECT id, owner_user_id, encrypted_profile FROM patients WHERE id = $1',
    [patientId],
  );
  if (!rows[0]) return null;
  return user.role === 'admin' || user.role === 'clinician' || rows[0].owner_user_id === user.sub
    ? rows[0]
    : null;
}

async function audit(patientId, actorId, action, metadata = {}) {
  await db.query(
    'INSERT INTO audit_events (patient_id, actor_id, action, metadata) VALUES ($1,$2,$3,$4)',
    [patientId, actorId, action, metadata],
  );
}

// ── Routes ───────────────────────────────────────────

/** POST /api/patients — create a patient record */
router.post('/', auth, allow('admin', 'clinician'), async (req, res, next) => {
  try {
    const { profile, ownerUserId } = createPatient.parse(req.body);
    const { rows } = await db.query(
      'INSERT INTO patients(owner_user_id,encrypted_profile,created_by) VALUES($1,$2,$3) RETURNING id,created_at',
      [ownerUserId, encrypt(profile), req.user.sub],
    );
    await audit(rows[0].id, req.user.sub, 'patient.created', {
      provenance: 'patient_provided',
    });
    res.status(201).json({
      patient: { ...rows[0], profile, provenance: 'patient_provided' },
    });
  } catch (e) {
    next(e);
  }
});

/** GET /api/patients/:patientId — read a patient record */
router.get('/:patientId', auth, async (req, res, next) => {
  try {
    const patient = await canAccess(req.params.patientId, req.user);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const [reports, obs, summary] = await Promise.all([
      db.query(
        'SELECT id,report_date,source_label,created_at FROM reports WHERE patient_id=$1 ORDER BY report_date DESC',
        [patient.id],
      ),
      db.query(
        'SELECT * FROM observations WHERE patient_id=$1 ORDER BY created_at DESC',
        [patient.id],
      ),
      db.query(
        'SELECT * FROM summaries WHERE patient_id=$1 ORDER BY created_at DESC LIMIT 1',
        [patient.id],
      ),
    ]);

    res.json({
      patient: {
        id: patient.id,
        profile: decrypt(patient.encrypted_profile),
        provenance: 'patient_provided',
      },
      reports: reports.rows,
      observations: obs.rows.map((x) => ({
        id: x.id,
        ...decrypt(x.encrypted_observation),
        provenance: x.provenance,
        confidence: x.confidence,
        verifiedAt: x.verified_at,
      })),
      summary: summary.rows[0]
        ? decrypt(summary.rows[0].encrypted_summary)
        : null,
    });
  } catch (e) {
    next(e);
  }
});

/** POST /api/patients/:patientId/reports — process a report */
router.post('/:patientId/reports', auth, allow('admin', 'clinician'), async (req, res, next) => {
  const client = await db.connect();
  try {
    const patient = await canAccess(req.params.patientId, req.user);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const input = processReport.parse(req.body);
    const extracted = parseReport(input.text, input.reportDate || null);

    await client.query('BEGIN');

    const report = (
      await client.query(
        'INSERT INTO reports(patient_id,report_date,encrypted_source,source_label,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',
        [
          patient.id,
          input.reportDate || null,
          encrypt({ text: input.text }),
          input.sourceLabel || 'Pasted report',
          req.user.sub,
        ],
      )
    ).rows[0];

    for (const row of extracted) {
      await client.query(
        'INSERT INTO observations(patient_id,report_id,encrypted_observation,provenance,confidence) VALUES($1,$2,$3,$4,$5)',
        [
          patient.id,
          report.id,
          encrypt(row),
          'report_extracted',
          row.referenceRange ? 90 : 60,
        ],
      );
    }

    const current = (
      await client.query(
        'SELECT encrypted_observation FROM observations WHERE patient_id=$1',
        [patient.id],
      )
    ).rows.map((x) => decrypt(x.encrypted_observation));

    const summary = {
      text: safeSummary(decrypt(patient.encrypted_profile), current),
      generatedAt: new Date().toISOString(),
      disclaimer: 'Not a diagnosis or treatment recommendation.',
    };

    await client.query(
      'INSERT INTO summaries(patient_id,encrypted_summary) VALUES($1,$2)',
      [patient.id, encrypt(summary)],
    );

    await client.query('COMMIT');

    await audit(patient.id, req.user.sub, 'report.processed', {
      reportId: report.id,
      extracted: extracted.length,
    });

    res.status(201).json({
      reportId: report.id,
      observations: extracted.map((x) => ({
        ...x,
        provenance: 'report_extracted',
        confidence: x.referenceRange ? 90 : 60,
      })),
      summary,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

/** GET /api/patients/:patientId/audit — audit trail */
router.get('/:patientId/audit', auth, async (req, res, next) => {
  try {
    const patient = await canAccess(req.params.patientId, req.user);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const { rows } = await db.query(
      `SELECT a.action, a.metadata, a.created_at, u.email AS actor
       FROM audit_events a LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.patient_id=$1 ORDER BY a.created_at DESC LIMIT 100`,
      [patient.id],
    );
    res.json({ events: rows });
  } catch (e) {
    next(e);
  }
});

export default router;
