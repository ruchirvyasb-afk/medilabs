/**
 * Generate a bounded, non-diagnostic summary from a patient profile and observations.
 * This only describes fields already present — never invents or diagnoses.
 */
export function safeSummary(profile, observations) {
  const flagged = observations
    .filter((x) => ['high', 'low'].includes(x.status))
    .map((x) => x.testName);

  const missing = observations.filter((x) => x.status === 'unclassified').length;

  let text = `This record contains ${observations.length} structured report result${
    observations.length === 1 ? '' : 's'
  } and patient-provided health information.`;

  if (flagged.length) {
    text += ` ${flagged.join(' and ')} ${
      flagged.length === 1 ? 'is' : 'are'
    } marked outside the reference range printed in the source report.`;
  }

  if (missing) {
    text += ` ${missing} result${
      missing === 1 ? ' does' : 's do'
    } not include a usable source range and remain unclassified.`;
  }

  text +=
    ' This is an organizational summary for review, not a diagnosis or treatment recommendation.';

  return text;
}
