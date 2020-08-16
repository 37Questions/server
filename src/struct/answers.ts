enum AnswerState {
  SUBMITTED = "submitted",
  REVEALED = "revealed",
  GUESSED = "guessed",
  FAVORITE = "favorite",
  DISCARDED = "discarded"
}

class Answer {
  answer: string;
  userIdGuess: number;
  state: AnswerState;

  constructor(answer: Answer) {
    this.answer = answer.answer;
    this.userIdGuess = answer.userIdGuess;
    this.state = answer.state;
  }
}

export {Answer, AnswerState};