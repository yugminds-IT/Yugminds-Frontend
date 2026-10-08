export type MarkedQuestion = { id?: string; marks?: number };

export function sumQuestionMarks(
  questions: MarkedQuestion[],
  exceptId?: string,
): number {
  return questions.reduce((sum, q) => {
    if (exceptId && q.id === exceptId) return sum;
    const n = Number(q.marks);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

/** Marks still available under the assignment cap. `exceptId` is the question being edited. */
export function remainingAssignmentMarks(
  maxScore: number,
  questions: MarkedQuestion[],
  exceptId?: string,
): number {
  const cap = Number(maxScore);
  if (!Number.isFinite(cap) || cap <= 0) return 0;
  return Math.max(0, cap - sumQuestionMarks(questions, exceptId));
}

export function defaultQuestionMarks(remaining: number): string {
  if (remaining <= 0) return "1";
  if (remaining < 1) return String(remaining);
  return "1";
}

export function marksExceedCap(
  maxScore: number,
  usedByOthers: number,
  marks: number,
): boolean {
  const cap = Number(maxScore);
  if (!Number.isFinite(cap) || cap <= 0) return false;
  return usedByOthers + marks > cap + 1e-9;
}
