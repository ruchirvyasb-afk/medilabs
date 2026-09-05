// Wires the "Refresh summary" button to the backend's non-diagnostic summary generator.
document.getElementById('refreshSummaryBtn').addEventListener('click', async () => {
  if (!ML.state.selectedPatientId) return;
  const btn = document.getElementById('refreshSummaryBtn');
  btn.disabled = true;
  try {
    await ML.api(`/patients/${ML.state.selectedPatientId}/summary`, { method: 'POST' });
    await ML.selectPatient(ML.state.selectedPatientId);
    ML.showNotice('<b>Summary refreshed.</b> It reflects only fields already present in the record.');
  } catch (err) {
    ML.showNotice(`<b>Could not refresh summary.</b> ${ML.safe(err.message)}`);
  } finally {
    btn.disabled = false;
  }
});
