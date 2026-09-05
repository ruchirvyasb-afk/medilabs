// MedLens frontend — talks to the real backend under /api.
// Shared state and helpers live on window.ML so the other script files
// (summary.js, verifier.js, enhancements.js, more-enhancements.js) can use them.
const ML = (window.ML = {
  state: {
    token: localStorage.getItem('medlens_token') || null,
    user: JSON.parse(localStorage.getItem('medlens_user') || 'null'),
    patients: [],
    selectedPatientId: null,
    patient: null, // { profile, reports, observations, summary }
  },
});

ML.safe = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Fetch wrapper — attaches the bearer token and throws a readable error on failure. */
ML.api = async function api(path, options = {}) {
  const hadToken = Boolean(ML.state.token);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(ML.state.token ? { Authorization: `Bearer ${ML.state.token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // A 401 only means "your session expired" when a token was actually sent.
  // Login/register calls send no token, so their 401s are just wrong
  // credentials / duplicate email and should surface as normal errors.
  if (res.status === 401 && hadToken) {
    ML.logout();
    throw new Error('Session expired. Please sign in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
};

ML.showNotice = function showNotice(text) {
  document.getElementById('noticeText').innerHTML = text;
  document.getElementById('notice').classList.remove('hidden');
};

// ── Auth ─────────────────────────────────────────────

function setSession(token, user) {
  ML.state.token = token;
  ML.state.user = user;
  localStorage.setItem('medlens_token', token);
  localStorage.setItem('medlens_user', JSON.stringify(user));
}

ML.logout = function logout() {
  ML.state.token = null;
  ML.state.user = null;
  localStorage.removeItem('medlens_token');
  localStorage.removeItem('medlens_user');
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
};

async function boot() {
  if (!ML.state.token) return ML.logout();
  try {
    const { user } = await ML.api('/auth/me');
    ML.state.user = { id: user.sub, email: user.email, role: user.role };
    localStorage.setItem('medlens_user', JSON.stringify(ML.state.user));
  } catch {
    return ML.logout();
  }

  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('userChip').innerHTML = `${ML.safe(ML.state.user.email)} <span>⌄</span>`;
  document.getElementById('accessUserName').textContent = ML.state.user.email;
  document.getElementById('accessUserRole').textContent = `${ML.state.user.role} · full access`;

  await ML.loadPatients();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('loginError');
  errorEl.classList.add('hidden');
  try {
    const { token, user } = await ML.api('/auth/login', {
      method: 'POST',
      body: {
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value,
      },
    });
    setSession(token, user);
    await boot();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

document.getElementById('userChip').addEventListener('click', () => {
  if (confirm('Sign out of MedLens?')) ML.logout();
});

document.getElementById('authToggle').addEventListener('click', () => {
  const showingSignup = document.getElementById('signupForm').classList.toggle('hidden') === false;
  document.getElementById('loginForm').classList.toggle('hidden', showingSignup);
  document.getElementById('authToggle').textContent = showingSignup ? 'Already have an account? Sign in' : 'New here? Create an account';
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('signupError');
  errorEl.classList.add('hidden');

  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('signupConfirmPassword').value;
  if (password !== confirmPassword) {
    errorEl.textContent = 'Passwords do not match.';
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    const { token, user } = await ML.api('/auth/register', {
      method: 'POST',
      body: { email: document.getElementById('signupEmail').value.trim(), password },
    });
    setSession(token, user);
    await boot();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

// ── Patients ─────────────────────────────────────────

ML.loadPatients = async function loadPatients() {
  const { patients } = await ML.api('/patients');
  ML.state.patients = patients;
  renderPatientList();

  if (!patients.length) {
    ML.state.selectedPatientId = null;
    ML.state.patient = null;
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('patientView').classList.add('hidden');
    return;
  }

  document.getElementById('emptyState').classList.add('hidden');
  const stillExists = patients.some((p) => p.id === ML.state.selectedPatientId);
  await ML.selectPatient(stillExists ? ML.state.selectedPatientId : patients[0].id);
};

ML.selectPatient = async function selectPatient(id) {
  ML.state.selectedPatientId = id;
  const data = await ML.api(`/patients/${id}`);
  ML.state.patient = data;
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('patientView').classList.remove('hidden');
  renderPatientList();
  renderPatientView();
};

function renderPatientList() {
  const container = document.getElementById('patientList');
  container.innerHTML = ML.state.patients
    .map((p) => {
      const initials = (p.profile.fullName || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
      const selected = p.id === ML.state.selectedPatientId ? 'selected' : '';
      return `<div class="patient-mini ${selected}" data-id="${p.id}"><div class="avatar lavender">${ML.safe(initials)}</div><div><strong>${ML.safe(p.profile.fullName || 'Unnamed patient')}</strong><small>Updated ${new Date(p.createdAt).toLocaleDateString()}</small></div>${selected ? '<span class="dot"></span>' : ''}</div>`;
    })
    .join('');
  container.querySelectorAll('.patient-mini').forEach((el) => {
    el.addEventListener('click', () => ML.selectPatient(el.dataset.id));
  });
}

function renderPatientView() {
  const { patient, observations, summary } = ML.state.patient;
  const profile = patient.profile;

  document.getElementById('crumbPatientName').textContent = profile.fullName || 'Unnamed patient';
  document.getElementById('patientName').innerHTML = `${ML.safe(profile.fullName || 'Unnamed patient')}<button class="edit-name" id="editProfile" aria-label="Edit patient">✎</button>`;
  document.getElementById('patientIdLabel').textContent = `ML-${patient.id.slice(0, 8).toUpperCase()}`;
  document.getElementById('patientAvatar').textContent = (profile.fullName || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('patientMeta').innerHTML = `${profile.age ?? '—'} years · ${ML.safe(profile.sex || 'Not specified')} · Last updated <strong>${new Date(patient.updatedAt || Date.now()).toLocaleString()}</strong>`;

  renderStats(observations, profile);
  renderObservations(observations);
  renderReviewQueue(observations);
  renderProfile(profile);
  renderSummary(summary, observations.length);
  ML.refreshAudit();

  document.getElementById('editProfile').addEventListener('click', () => openModal('intake', 'edit'));
}

function renderStats(observations, profile) {
  const reports = ML.state.patient.reports;
  document.getElementById('statReports').textContent = reports.length;
  document.getElementById('statReportsSub').textContent = reports.length
    ? `${reports.length} source report${reports.length === 1 ? '' : 's'}`
    : 'No reports yet';

  const flagged = observations.filter((o) => o.status === 'high' || o.status === 'low').length;
  document.getElementById('statObservations').textContent = observations.length;
  document.getElementById('statObservationsSub').innerHTML = observations.length
    ? `${observations.length - flagged} in range · ${flagged ? `<b>${flagged} need review</b>` : 'none flagged'}`
    : 'No results yet';

  document.getElementById('statMeds').textContent = (profile.medications || []).length;

  const needsReview = observations.filter((o) => (o.status === 'high' || o.status === 'low' || o.status === 'unclassified') && !o.verifiedAt).length;
  document.getElementById('statReview').textContent = needsReview ? 'Pending' : 'Ready';
  document.getElementById('statReviewSub').textContent = needsReview ? `${needsReview} item${needsReview === 1 ? '' : 's'} flagged for attention` : 'Nothing flagged';
}

function statusPill(status) {
  if (status === 'high') return '<span class="pill high">↑ High</span>';
  if (status === 'low') return '<span class="pill high">↓ Low</span>';
  if (status === 'unclassified') return '<span class="pill normal">No source range</span>';
  return '<span class="pill normal">● Normal</span>';
}

function renderObservations(observations) {
  const body = document.getElementById('resultsBody');
  if (!observations.length) {
    body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">No observations yet — process a report to extract results.</td></tr>';
    return;
  }
  body.innerHTML = observations
    .map((o) => {
      const sourceTag = o.provenance === 'clinician_verified' ? 'Verified' : o.provenance === 'report_extracted' ? 'AI-extracted' : 'Patient-provided';
      return `<tr data-obs-id="${o.id}"><td><strong>${ML.safe(o.testName)}</strong><small>${sourceTag}${o.sourceDate ? ' · ' + ML.safe(o.sourceDate) : ''}</small></td><td class="mono ${o.status === 'high' || o.status === 'low' ? 'high-value' : ''}">${ML.safe(o.value)} <span>${ML.safe(o.unit || '')}</span></td><td class="mono muted">${o.referenceRange ? ML.safe(o.referenceRange) : 'Not provided in source'}</td><td>${statusPill(o.status)}${o.confidence != null ? ` <b class="confidence high-conf">${o.confidence}%</b>` : ''}</td><td><button class="source-link" data-obs-id="${o.id}">${sourceTag === 'Verified' ? '✓ Verified' : 'View source'} <span>↗</span></button></td></tr>`;
    })
    .join('');

  body.querySelectorAll('.source-link').forEach((btn) => {
    btn.addEventListener('click', () => ML.openComparison(btn.dataset.obsId));
  });
}

function renderReviewQueue(observations) {
  const items = observations.filter((o) => (o.status === 'high' || o.status === 'low' || o.status === 'unclassified') && !o.verifiedAt);
  document.getElementById('reviewCount').textContent = `${items.length} open`;
  const list = document.getElementById('reviewList');
  if (!items.length) {
    list.innerHTML = '<p class="empty-profile" style="padding:14px 19px">Nothing needs review right now.</p>';
    return;
  }
  list.innerHTML = items
    .map((o) => {
      const isRange = o.status === 'unclassified';
      return `<article><span class="issue-icon ${isRange ? 'neutral' : ''}">${isRange ? '?' : '!'}</span><div><strong>${ML.safe(o.testName)}</strong><p>${isRange ? 'No reference range was found in the source — confirm before classifying.' : `Reported as ${o.status === 'high' ? 'above' : 'below'} the source-provided reference range.`}</p><small>${o.provenance === 'report_extracted' ? 'AI-extracted' : 'Patient-provided'} · Not a clinical determination</small></div><button class="review-btn" data-obs-id="${o.id}">${ML.state.user.role === 'customer' ? 'Discuss with clinician' : 'Mark verified'}</button></article>`;
    })
    .join('');

  if (ML.state.user.role !== 'customer') {
    list.querySelectorAll('.review-btn').forEach((btn) => {
      btn.addEventListener('click', () => ML.verifyObservation(btn.dataset.obsId));
    });
  }
}

function renderProfile(profile) {
  const tags = document.getElementById('symptomTags');
  tags.innerHTML = (profile.symptoms || []).map((s) => `<b>${ML.safe(s)}</b>`).join('') || '';
  document.getElementById('conditionsValue').textContent = (profile.conditions || []).join(', ') || 'No conditions added';

  document.getElementById('allergyValue').outerHTML = (profile.allergies || []).length
    ? `<div class="allergy" id="allergyValue"><i>!</i><div><strong>${ML.safe(profile.allergies.join(', '))}</strong><small>Patient-provided</small></div></div>`
    : '<div class="empty-profile" id="allergyValue">No allergies added</div>';

  const meds = profile.medications || [];
  document.getElementById('medsList').innerHTML = meds.length
    ? meds.map((m) => `<div class="med"><div class="med-icon">Rx</div><div><strong>${ML.safe(m.name)}</strong><small>${ML.safe(m.dose || '')}${m.dose && m.frequency ? ' · ' : ''}${ML.safe(m.frequency || '')}</small></div><span>Active</span></div>`).join('')
    : '<p class="empty-profile" style="padding:12px 19px">No medications added</p>';
}

function renderSummary(summary, obsCount) {
  document.getElementById('summaryText').textContent = summary
    ? summary.text
    : 'No summary yet. Process a report to generate one.';
  document.getElementById('summaryMeta').textContent = summary
    ? `Generated ${new Date(summary.generatedAt).toLocaleString()} · ${obsCount} observation${obsCount === 1 ? '' : 's'}`
    : '';
}

// ── Modal (shared by "new patient" / "edit profile" / "process report") ──

let modalMode = null; // 'create' | 'edit' | 'report'
const modal = document.getElementById('modal');
const overline = document.getElementById('modalOverline');
const titleEl = document.getElementById('modalTitle');
const descEl = document.getElementById('modalText');
const reportForm = document.getElementById('reportForm');
const intakeForm = document.getElementById('intakeForm');

function openModal(kind, mode) {
  modalMode = kind === 'report' ? 'report' : mode;
  modal.classList.add('open');
  const isReport = kind === 'report';
  reportForm.classList.toggle('hidden', !isReport);
  intakeForm.classList.toggle('hidden', isReport);

  if (isReport) {
    overline.textContent = 'AI-ASSISTED EXTRACTION · REVIEW REQUIRED';
    titleEl.textContent = 'Process a medical report';
    descEl.textContent = 'Paste report text to create a reviewable, source-linked structured record. Nothing here is a diagnosis.';
    document.getElementById('reportDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('reportText').value = '';
  } else {
    overline.textContent = modalMode === 'create' ? 'NEW PATIENT' : 'PATIENT-PROVIDED INFORMATION';
    titleEl.textContent = modalMode === 'create' ? 'Create a new patient' : 'Edit patient information';
    descEl.textContent = modalMode === 'create'
      ? 'Create a new patient record. You can add more details any time.'
      : 'These details are saved as patient-provided information and never merged with AI-extracted report fields.';

    const p = modalMode === 'edit' ? ML.state.patient.patient.profile : {};
    document.getElementById('patientFullName').value = p.fullName || '';
    document.getElementById('patientAge').value = p.age ?? '';
    document.getElementById('patientSex').value = p.sex || '';
    document.getElementById('patientSymptoms').value = (p.symptoms || []).join(', ');
    document.getElementById('patientConditions').value = (p.conditions || []).join(', ');
    document.getElementById('patientAllergies').value = (p.allergies || []).join(', ');
    document.getElementById('patientMeds').value = (p.medications || []).map((m) => [m.name, m.dose, m.frequency].filter(Boolean).join(', ')).join('\n');
  }
}

function closeModal() {
  modal.classList.remove('open');
  document.getElementById('intakeError').classList.add('hidden');
  document.getElementById('reportError').classList.add('hidden');
}

document.getElementById('intakeBtn').addEventListener('click', () => openModal('intake', 'edit'));
document.getElementById('editProfileBtn').addEventListener('click', () => openModal('intake', 'edit'));
document.getElementById('newPatient').addEventListener('click', () => openModal('intake', 'create'));
document.getElementById('processBtn').addEventListener('click', () => openModal('report'));
document.getElementById('closeModal').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.getElementById('dismissNotice').addEventListener('click', () => document.getElementById('notice').classList.add('hidden'));

document.querySelectorAll('.nav-item').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  document.querySelectorAll('.nav-item').forEach((x) => x.classList.remove('active'));
  a.classList.add('active');
}));

function csv(value) {
  return value.split(',').map((x) => x.trim()).filter(Boolean);
}

function parseMeds(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, dose, frequency] = line.split(',').map((x) => x.trim());
      return { name, dose: dose || undefined, frequency: frequency || undefined };
    })
    .filter((m) => m.name);
}

intakeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('intakeError');
  errorEl.classList.add('hidden');

  const age = document.getElementById('patientAge').value;
  const profile = {
    fullName: document.getElementById('patientFullName').value.trim(),
    age: age ? Number(age) : undefined,
    sex: document.getElementById('patientSex').value || undefined,
    symptoms: csv(document.getElementById('patientSymptoms').value),
    conditions: csv(document.getElementById('patientConditions').value),
    allergies: csv(document.getElementById('patientAllergies').value),
    medications: parseMeds(document.getElementById('patientMeds').value),
  };

  try {
    if (modalMode === 'create') {
      if (!profile.fullName) throw new Error('Full name is required.');
      const { patient } = await ML.api('/patients', {
        method: 'POST',
        body: { profile: { ...profile, age: profile.age ?? 0, sex: profile.sex || 'Prefer not to say' }, ownerUserId: ML.state.user.id },
      });
      closeModal();
      const { patients } = await ML.api('/patients');
      ML.state.patients = patients;
      await ML.selectPatient(patient.id);
      ML.showNotice('<b>New patient created.</b>');
    } else {
      await ML.api(`/patients/${ML.state.selectedPatientId}`, { method: 'PATCH', body: profile });
      closeModal();
      await ML.selectPatient(ML.state.selectedPatientId);
      ML.showNotice('<b>Patient-provided information saved.</b> It remains visibly separated from report-extracted data.');
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

document.getElementById('extractBtn').addEventListener('click', async () => {
  const errorEl = document.getElementById('reportError');
  errorEl.classList.add('hidden');
  const text = document.getElementById('reportText').value.trim();
  if (!text) return document.getElementById('reportText').focus();

  try {
    const { observations, summary } = await ML.api(`/patients/${ML.state.selectedPatientId}/reports`, {
      method: 'POST',
      body: {
        text,
        reportDate: document.getElementById('reportDate').value || undefined,
        sourceLabel: 'Pasted report',
      },
    });
    closeModal();
    await ML.selectPatient(ML.state.selectedPatientId);
    ML.showNotice(`<b>${observations.length} structured result${observations.length === 1 ? '' : 's'} extracted for review.</b> Values without source ranges remain unclassified.`);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

boot();
