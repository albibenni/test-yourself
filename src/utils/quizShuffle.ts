import type { QuizQuestion } from "../types";

/**
 * Creates the option order for one quiz session without changing the parsed
 * Markdown quiz. The display letters are reassigned after shuffling, so the
 * answer key stays correct for this session.
 */
export function shuffleQuizQuestions(
  questions: QuizQuestion[],
  random: () => number = Math.random,
): QuizQuestion[] {
  return questions.map((question) => {
    const letters = question.options.map((option) => option.letter);
    const options = [...question.options];

    for (let index = options.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [options[index], options[swapIndex]] = [
        options[swapIndex],
        options[index],
      ];
    }

    // Avoid an invisible shuffle for questions with two or more options.
    if (
      options.length > 1 &&
      options.every((option, index) => option.letter === letters[index])
    ) {
      options.push(options.shift()!);
    }

    const correctOption = options.find(
      (option) => option.letter === question.correct_answer,
    );

    return {
      ...question,
      options: options.map((option, index) => ({
        ...option,
        letter: letters[index]!,
      })),
      correct_answer: correctOption
        ? letters[options.indexOf(correctOption)]!
        : question.correct_answer,
    };
  });
}
