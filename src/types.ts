export interface QuizOption {
  letter: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
  correct_answer?: string;
  explanation?: string;
}

export interface Quiz {
  title: string;
  path: string;
  topic: string;
  questions: QuizQuestion[];
}
