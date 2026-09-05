import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';
import { allow } from '../middleware/authorize.js';
import { decrypt } from '../services/crypto.js';

const router = Router();

/** PATCH /api/observations/:observationId/verify — clinician verification */
router.patch('/:observationId/verify', auth, allow('admin', 'clinician'), async (req, res, next) => {
  try {
    const found = await db.query(
      'SELECT * FROM observations WHERE id=$1',
      [req.params.observationId],
    );
    if (!found.rows[0]) {
      return res.status(404).json({ error: 'Observation not found.' });
    }

    // Check access to the parent patient
    const { rows: patientRows } = await db.query(
      'SELECT id, owner_user_id, encrypted_profile FROM patients WHERE id = $1',
      [found.rows[0].patient_id],
    );
    const patient = patientRows[0];
    if (
      !patient ||
      !(req.user.role === 'admin' || req.user.role === 'clinician' || patient.owner_user_id === req.user.sub)
    ) {
      return res.status(404).json({ error: 'Observation not found.' });
    }

    await db.query(
      "UPDATE observations SET verified_by=$1, verified_at=now(), provenance=$2 WHERE id=$3",
      [req.user.sub, 'clinician_verified', found.rows[0].id],
    );

    await db.query(
      'INSERT INTO audit_events (patient_id, actor_id, action, metadata) VALUES ($1,$2,$3,$4)',
      [patient.id, req.user.sub, 'observation.verified', { observationId: found.rows[0].id }],
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
