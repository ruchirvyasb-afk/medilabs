/**
 * Classify a numeric value against a reference range string.
 * Returns 'high', 'low', 'normal', or 'unclassified'.
 */
export function statusFor(value, range) {
  if (!range) return 'unclassified';
  const n = (range.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  if (!n.length) return 'unclassified';
  if ((range.includes('<') && value > n[0]) || (n.length > 1 && value > n.at(-1)))
    return 'high';
  if ((range.includes('>') && value < n[0]) || (n.length > 1 && value < n[0]))
    return 'low';
  return 'normal';
}

/**
 * Parse unstructured report text into an array of structured observation objects.
 * Only classifies when the source text includes a usable reference range.
 */
export function parseReport(text, date) {
  const results = [];

  for (const sourceLine of text
    .split(/\n|;/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const m = sourceLine.match(
      /^([^:\d]{2,}?)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*([a-zA-Zµ/%]+)?\s*(?:\(\s*([^\)]+)\s*\))?$/i,
    );
    if (!m) continue;

    let [, testName, rawValue, unit = '', range = ''] = m;
    range = range
      .replace(/^ref(?:erence)?\s*range\s*[:]?\s*/i, '')
      .trim();

    if (!/[<>]|\d+\s*(?:-|–|to)\s*\d+/i.test(range)) range = null;

    results.push({
      testName: testName.trim(),
      value: Number(rawValue),
      unit,
      referenceRange: range,
      status: statusFor(Number(rawValue), range),
      sourceDate: date,
      sourceLine,
    });
  }

  return results;
}
