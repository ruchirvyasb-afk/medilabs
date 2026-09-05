// Clinician verification — backed by PATCH /api/observations/:id/verify.
ML.verifyObservation = async function verifyObservation(observationId) {
  try {
    await ML.api(`/observations/${observationId}/verify`, { method: 'PATCH' });
    await ML.selectPatient(ML.state.selectedPatientId);
    ML.showNotice('<b>Observation marked verified.</b> The audit trail now records this review action.');
  } catch (err) {
    ML.showNotice(`<b>Could not verify observation.</b> ${ML.safe(err.message)}`);
  }
};

document.addEventListener('click', (event) => {
  if (event.target.id === 'verifyField') {
    ML.verifyObservation(event.target.dataset.obsId);
    document.getElementById('closeModal').click();
  }
});
