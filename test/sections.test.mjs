import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySections, suggestLyricsTags } from '../src/sections.mjs';

test('classifies a structured energy curve with bounded heuristic confidence', () => {
  const energyCurve = Array.from({ length: 120 }, (_, index) => {
    if (index < 10) return { timeSeconds: index, value: 0.15 };
    if (index < 35) return { timeSeconds: index, value: 0.42 };
    if (index < 60) return { timeSeconds: index, value: 0.88 };
    if (index < 82) return { timeSeconds: index, value: 0.3 };
    if (index < 110) return { timeSeconds: index, value: 0.84 };
    return { timeSeconds: index, value: 0.18 };
  });
  const sections = classifySections({ energyCurve, durationSeconds: 120 });
  assert.ok(sections.length >= 3);
  assert.equal(sections[0].label, 'intro');
  assert.ok(sections.some((section) => section.label === 'chorus'));
  assert.equal(sections.at(-1).label, 'outro');
  assert.ok(sections.every((section) => section.confidence >= 0.38 && section.confidence <= 0.78));
  assert.ok(sections.every((section, index) => index === 0 || section.startSeconds >= sections[index - 1].endSeconds));
});

test('does not invent labels for very short tracks', () => {
  const sections = classifySections({ energyCurve: Array.from({ length: 10 }, (_, timeSeconds) => ({ timeSeconds, value: 0.5 })), durationSeconds: 10 });
  assert.deepEqual(sections, []);
});

test('uses explicit lyric section tags as stronger anchors', () => {
  const energyCurve = Array.from({ length: 120 }, (_, timeSeconds) => ({ timeSeconds, value: timeSeconds < 15 ? 0.2 : timeSeconds < 55 ? 0.45 : timeSeconds < 90 ? 0.85 : 0.35 }));
  const sections = classifySections({
    energyCurve,
    durationSeconds: 120,
    lyrics: '[Intro]\nOpening\n\n[Verse 1]\nA line\n\n[Chorus]\nThe hook\n\n[Bridge]\nA change\n\n[Outro]\nEnd'
  });
  assert.ok(sections.some((section) => section.label === 'chorus' && section.confidence === 0.72));
  assert.ok(sections.some((section) => section.label === 'bridge' && section.confidence === 0.72));
});

test('creates a reviewable tagged copy from unstructured lyric prose', () => {
  const result = suggestLyricsTags('First passage\nwith two lines.\n\nRepeated hook\nkeep this phrase\n\nRepeated hook\nkeep this phrase');
  assert.equal(result.mode, 'auto_tag');
  assert.match(result.text, /^\[Verse 1\]/);
  assert.equal(result.suggestions[1].label, 'Chorus');
  assert.equal(result.suggestions[1].confidence, 0.65);
});
