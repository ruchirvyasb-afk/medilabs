const storageKey='medlens-patient-demo-v1';
const enhancementModal=document.getElementById('modal');
function modalContent(label, heading, text, html){
  enhancementModal.classList.add('open','wide');
  document.getElementById('modalOverline').textContent=label;
  document.getElementById('modalTitle').textContent=heading;
  document.getElementById('modalText').textContent=text;
  document.getElementById('reportForm').classList.add('hidden');
  document.getElementById('intakeForm').classList.add('hidden');
  let slot=document.getElementById('enhancementSlot');
  if(!slot){slot=document.createElement('div');slot.id='enhancementSlot';enhancementModal.querySelector('.modal').append(slot)}
  slot.innerHTML=html;
}
function resetModalSlot(){const slot=document.getElementById('enhancementSlot');if(slot)slot.remove();enhancementModal.classList.remove('wide')}
document.getElementById('closeModal').addEventListener('click',resetModalSlot);
document.getElementById('comparisonBtn').onclick=()=>modalContent('SOURCE ↔ STRUCTURED RECORD','Review extraction','Compare a source fragment and its structured field before marking it verified.',`<div class="medlens-source"><div><span>ORIGINAL REPORT TEXT</span><pre>Comprehensive Metabolic Panel\nALT (SGPT): 42 U/L\nReference range: 7 – 35 U/L</pre></div><div><span>STRUCTURED FIELD</span><dl><dt>Test</dt><dd>ALT (SGPT)</dd><dt>Result</dt><dd>42 U/L</dd><dt>Reference range</dt><dd>7 – 35 U/L</dd><dt>Extraction confidence</dt><dd><b class="confidence high-conf">94% · High</b></dd></dl></div></div><div class="verify-row"><button class="secondary-btn" id="editField">Edit field</button> <button class="primary-btn" id="verifyField">✓ Mark verified</button></div>`);
document.getElementById('timelineBtn').onclick=()=>modalContent('AUDIT HISTORY','Record timeline','Every record-changing event is retained with its actor and provenance.',`<div class="timeline-item"><b>Report processed</b><p>3 values extracted from Lipid & Metabolic Panel</p><small>Today · 10:42 AM · AI-assisted</small></div><div class="timeline-item"><b>Patient details updated</b><p>Symptoms and medication list reviewed</p><small>Sep 04 · 3:18 PM · Dr. Arun Rao</small></div><div class="timeline-item"><b>Record created</b><p>Patient profile added to MedLens</p><small>Sep 03 · 11:05 AM · Dr. Arun Rao</small></div>`);
document.querySelectorAll('.source-link').forEach(button=>button.addEventListener('click',()=>document.getElementById('comparisonBtn').click()));
document.querySelectorAll('.review-btn').forEach(button=>button.onclick=()=>{button.textContent='✓ Resolved';button.style.color='#23845d';button.style.borderColor='#bfe2cc';button.parentElement.style.opacity='.62';localStorage.setItem(storageKey,'review-resolved')});
document.getElementById('lockSession').onclick=()=>{document.body.classList.toggle('locked');document.getElementById('lockSession').textContent=document.body.classList.contains('locked')?'Unlock session':'Lock session'};
document.querySelector('.export-btn').onclick=()=>{const rows=[...document.querySelectorAll('#resultsBody tr')].map(row=>({test:row.cells[0].innerText,result:row.cells[1].innerText,referenceRange:row.cells[2].innerText,status:row.cells[3].innerText,source:row.cells[4].innerText}));const blob=new Blob([JSON.stringify({patient:'Elena Martinez',generatedAt:new Date().toISOString(),disclaimer:'Organizational record only; not diagnosis or treatment advice.',observations:rows},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='medlens-elena-martinez-record.json';link.click();URL.revokeObjectURL(link.href)};
document.getElementById('extractBtn').addEventListener('click',()=>setTimeout(()=>localStorage.setItem('medlens-last-extraction',document.getElementById('resultsBody').innerHTML),50));
if(localStorage.getItem('medlens-last-extraction')){ /* source-backed additions are retained locally for this prototype session */ }
