function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds a Set of 4 unique non-negative integers that always includes
 * correctAnswer. Shared primitive used by buildAnswerChoices and MazeGame.
 *
 * @param {number} correctAnswer
 * @returns {Set<number>}
 */
export function buildAnswerSet(correctAnswer) {
  const set = new Set([correctAnswer]);
  let tries = 0;
  while (set.size < 4 && tries < 60) {
    const v = correctAnswer + ((Math.floor(Math.random() * 8) - 4) || 1);
    if (v >= 0) set.add(v);
    tries++;
  }
  for (let i = 1; set.size < 4; i++) {
    if (!set.has(correctAnswer + i))                                 set.add(correctAnswer + i);
    else if (correctAnswer - i >= 0 && !set.has(correctAnswer - i)) set.add(correctAnswer - i);
  }
  return set;
}

/**
 * Builds an array of 4 shuffled answer choices that always includes
 * the correct answer and 3 unique non-negative distractors.
 *
 * @param {number} correctAnswer
 * @returns {{ num: number, isCorrect: boolean, colorIdx: number }[]}
 */
export function buildAnswerChoices(correctAnswer) {
  return shuffle([...buildAnswerSet(correctAnswer)])
    .map((num, i) => ({ num, isCorrect: num === correctAnswer, colorIdx: i }));
}
