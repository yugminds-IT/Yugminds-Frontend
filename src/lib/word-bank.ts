/** Bank chips still available after the ones placed in blanks are removed (multiset, so repeated words work). */
export function availableWordChips(
  wordBank: string[],
  answers: (string | null | undefined)[],
  blankCount: number,
): { word: string; i: number }[] {
  const used = answers.slice(0, blankCount).filter((a): a is string => !!a);
  return wordBank
    .map((word, i) => ({ word, i }))
    .filter(({ word }) => {
      const at = used.indexOf(word);
      if (at === -1) return true;
      used.splice(at, 1);
      return false;
    });
}
