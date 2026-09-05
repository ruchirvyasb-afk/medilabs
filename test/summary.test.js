import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeSummary } from '../src/services/summary.js';

test('safeSummary names flagged observations without diagnosing', () => {
  const text = safeSummary({ fullName: 'Jane Doe' }, [
    { testName: 'LDL Cholesterol', status: 'high' },
    { testName: 'Glucose', status: 'normal' },
  ]);
  assert.ok(text.includes('LDL Cholesterol'));
  assert.ok(text.includes('not a diagnosis'));
});

test('safeSummary reports unclassified results without inventing a status', () => {
  const text = safeSummary({ fullName: 'Jane Doe' }, [
    { testName: 'Vitamin D', status: 'unclassified' },
  ]);
  assert.ok(/do(es)? not include a usable source range/.test(text));
});
