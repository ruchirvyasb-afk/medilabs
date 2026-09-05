// Search + "needs review" filter toolbar for the observations table.
const resultToolbar = document.querySelector('.heading-actions');
if (resultToolbar) {
  const search = document.createElement('input');
  search.className = 'result-search';
  search.placeholder = 'Search tests';
  search.setAttribute('aria-label', 'Search structured results');
  const filter = document.createElement('button');
  filter.className = 'filter-btn';
  filter.textContent = 'Needs review';
  resultToolbar.prepend(filter);
  resultToolbar.prepend(search);

  search.oninput = () => {
    const q = search.value.toLowerCase();
    document.querySelectorAll('#resultsBody tr').forEach((row) => {
      row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
  };

  let reviewOnly = false;
  filter.onclick = () => {
    reviewOnly = !reviewOnly;
    filter.textContent = reviewOnly ? 'Show all' : 'Needs review';
    document.querySelectorAll('#resultsBody tr').forEach((row) => {
      const needs = /↑ High|↓ Low|No source range/.test(row.innerText);
      row.style.display = !reviewOnly || needs ? '' : 'none';
    });
  };
}
