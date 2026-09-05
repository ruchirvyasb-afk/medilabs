import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusFor, parseReport } from '../src/services/parser.js';

test('statusFor classifies above an upper-bound range as high', () => {
  assert.equal(statusFor(118, '< 100 mg/dL'), 'high');
});

test('statusFor classifies within a two-sided range as normal', () => {
  assert.equal(statusFor(92, '70 - 99 mg/dL'), 'normal');
});

test('statusFor classifies below a lower-bound range as low', () => {
  assert.equal(statusFor(5, '> 10 mg/dL'), 'low');
});

test('statusFor never classifies when no range is given', () => {
  assert.equal(statusFor(28, null), 'unclassified');
  assert.equal(statusFor(28, ''), 'unclassified');
});

test('parseReport extracts a value with a reference range and classifies it', () => {
  const [result] = parseReport('LDL Cholesterol: 118 mg/dL (< 100 mg/dL)', '2026-01-01');
  assert.equal(result.testName, 'LDL Cholesterol');
  assert.equal(result.value, 118);
  assert.equal(result.unit, 'mg/dL');
  assert.equal(result.referenceRange, '< 100 mg/dL');
  assert.equal(result.status, 'high');
});

test('parseReport never invents a reference range when the source has none', () => {
  const [result] = parseReport('Vitamin D: 28 ng/mL', '2026-01-01');
  assert.equal(result.referenceRange, null);
  assert.equal(result.status, 'unclassified');
});

test('parseReport skips lines it cannot confidently parse', () => {
  const results = parseReport('Patient reports feeling fine today', '2026-01-01');
  assert.equal(results.length, 0);
});
