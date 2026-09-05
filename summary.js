// A bounded, non-diagnostic summary generator for the local prototype.
// It only describes fields already present in the structured record.
document.getElementById('extractBtn').addEventListener('click', () => {
  setTimeout(() => {
    const rows = [...document.querySelectorAll('#resultsBody tr')];
    const newRows = rows.filter(row => row.innerText.includes('AI-extracted'));
    if (!newRows.length) return;
    const flagged = newRows.filter(row => /↑ High|↓ Low/.test(row.innerText)).map(row => row.cells[0].querySelector('strong').textContent);
    const withoutRange = newRows.filter(row => row.innerText.includes('No source range')).length;
    const summary = document.querySelector('.summary-body p');
    let copy = `MedLens added ${newRows.length} result${newRows.length === 1 ? '' : 's'} from the pasted report dated <b>${document.getElementById('reportDate').value || 'an undated report'}.</b> `;
    copy += flagged.length ? `<mark>${flagged.join(' and ')} ${flagged.length === 1 ? 'is' : 'are'} flagged relative to the range printed in that source.</mark> ` : 'The newly extracted results with source-provided ranges are shown as within range. ';
    if (withoutRange) copy += `${withoutRange} result${withoutRange === 1 ? ' has' : 's have'} no reference range in the source and remain unclassified. `;
    copy += 'This is an organizational summary for review, not a diagnosis or treatment recommendation.';
    summary.innerHTML = copy;
    document.querySelector('.summary-meta span').textContent = `Generated from ${newRows.length + 3} sources`;
  }, 0);
});
