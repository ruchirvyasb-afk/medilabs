// Comparison + audit-timeline modals, session lock, and record export.
const enhancementModal = document.getElementById('modal');

function modalContent(label, heading, text, html) {
  enhancementModal.classList.add('open', 'wide');
  document.getElementById('modalOverline').textContent = label;
  document.getElementById('modalTitle').textContent = heading;
  document.getElementById('modalText').textContent = text;
  document.getElementById('reportForm').classList.add('hidden');
  document.getElementById('intakeForm').classList.add('hidden');
  let slot = document.getElementById('enhancementSlot');
  if (!slot) {
    slot = document.createElement('div');
    slot.id = 'enhancementSlot';
    enhancementModal.querySelector('.modal').append(slot);
  }
  slot.innerHTML = html;
}

function resetModalSlot() {
  const slot = document.getElementById('enhancementSlot');
  if (slot) slot.remove();
  enhancementModal.classList.remove('wide');
}
document.getElementById('closeModal').addEventListener('click', resetModalSlot);

ML.openComparison = function openComparison(observationId) {
  const obs = ML.state.patient.observations.find((o) => o.id === observationId);
  if (!obs) return;
  const isVerified = Boolean(obs.verifiedAt);
  const canVerify = ML.state.user.role === 'admin' || ML.state.user.role === 'clinician';

  modalContent(
    'SOURCE ↔ STRUCTURED RECORD',
    'Review extraction',
    'Compare the source fragment and its structured field before marking it verified.',
    `<div class="medlens-source"><div><span>ORIGINAL REPORT TEXT</span><pre>${ML.safe(obs.sourceLine || `${obs.testName}: ${obs.value} ${obs.unit || ''}`)}</pre></div><div><span>STRUCTURED FIELD</span><dl><dt>Test</dt><dd>${ML.safe(obs.testName)}</dd><dt>Result</dt><dd>${ML.safe(obs.value)} ${ML.safe(obs.unit || '')}</dd><dt>Reference range</dt><dd>${obs.referenceRange ? ML.safe(obs.referenceRange) : 'Not provided in source'}</dd><dt>Extraction confidence</dt><dd><b class="confidence high-conf">${obs.confidence ?? '—'}% · ${obs.confidence >= 85 ? 'High' : 'Review suggested'}</b></dd></dl></div></div><div class="verify-row">${isVerified ? '<button class="secondary-btn" disabled>✓ Verified</button>' : canVerify ? `<button class="primary-btn" id="verifyField" data-obs-id="${obs.id}">✓ Mark verified</button>` : '<p class="empty-profile">Only clinicians can verify observations.</p>'}</div>`,
  );
};

document.getElementById('timelineBtn').addEventListener('click', () => {
  const events = ML.state.auditEvents || [];
  modalContent(
    'AUDIT HISTORY',
    'Record timeline',
    'Every record-changing event is retained with its actor and provenance.',
    events.length
      ? events
          .map(
            (e) =>
              `<div class="timeline-item"><b>${ML.safe(e.action)}</b><p>${ML.safe(JSON.stringify(e.metadata || {}))}</p><small>${new Date(e.created_at).toLocaleString()} · ${ML.safe(e.actor || 'system')}</small></div>`,
          )
          .join('')
      : '<p class="empty-profile">No activity recorded yet.</p>',
  );
});

ML.refreshAudit = async function refreshAudit() {
  try {
    const { events } = await ML.api(`/patients/${ML.state.selectedPatientId}/audit`);
    ML.state.auditEvents = events;
    document.getElementById('auditLatest').textContent = events[0]
      ? `${events[0].action.replace(/[._]/g, ' ')} · ${new Date(events[0].created_at).toLocaleString()}`
      : 'No activity yet';
  } catch {
    ML.state.auditEvents = [];
  }
};

document.getElementById('lockSession').addEventListener('click', () => {
  document.body.classList.toggle('locked');
  document.getElementById('lockSession').textContent = document.body.classList.contains('locked') ? 'Unlock session' : 'Lock session';
});

document.getElementById('exportBtn').addEventListener('click', () => {
  if (!ML.state.patient) return;
  const { patient, observations, reports, summary } = ML.state.patient;
  const blob = new Blob(
    [
      JSON.stringify(
        {
          patient: patient.profile,
          generatedAt: new Date().toISOString(),
          disclaimer: 'Organizational record only; not diagnosis or treatment advice.',
          reports,
          observations,
          summary,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `medlens-${(patient.profile.fullName || 'patient').toLowerCase().replace(/\s+/g, '-')}-record.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
