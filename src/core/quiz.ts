// Mock tests / daily quiz (phase 2 scaffold).
import type { QuizQuestion } from './types';

/** Small deterministic random generator so everyone gets the same daily quiz. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** The day's free quiz: `count` questions picked from all question banks, same for everyone that day. */
export function dailyQuestions(all: QuizQuestion[], day: string, count: number): QuizQuestion[] {
  const rnd = seeded(day);
  return [...all]
    .map((q) => ({ q, k: rnd() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, count)
    .map((x) => x.q);
}

export function score(questions: QuizQuestion[], answers: (number | null)[]): { correct: number; total: number } {
  return { correct: questions.filter((q, i) => answers[i] === q.answer).length, total: questions.length };
}
