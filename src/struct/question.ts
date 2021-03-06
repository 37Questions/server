class Question {
  static MIN_LENGTH = 1;
  static MAX_LENGTH = 160;

  id: number;
  question: string;

  constructor(id: number, question: string) {
    this.id = id;
    this.question = question;
  }
}

enum QuestionState {
  SELECTION_OPTION = "selection_option",
  SELECTED = "selected",
  PLAYED = "played"
}

export {Question, QuestionState};