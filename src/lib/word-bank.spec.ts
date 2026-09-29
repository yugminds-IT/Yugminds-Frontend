import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { availableWordChips } from './word-bank.ts';

const words = (chips: { word: string }[]) => chips.map((c) => c.word);

describe('availableWordChips', () => {
  it('removes a placed word from the bank', () => {
    assert.deepEqual(words(availableWordChips(['move', 'say', 'hide'], ['say'], 1)), ['move', 'hide']);
  });

  it('only removes one copy when a word appears twice', () => {
    assert.deepEqual(words(availableWordChips(['go', 'go', 'stop'], ['go'], 2)), ['go', 'stop']);
  });

  it('ignores empty and sparse blanks', () => {
    assert.deepEqual(words(availableWordChips(['a', 'b'], [, 'b', null], 3)), ['a']);
  });

  it('ignores answers beyond the number of blanks', () => {
    assert.deepEqual(words(availableWordChips(['a', 'b'], ['a', 'b'], 1)), ['b']);
  });
});
