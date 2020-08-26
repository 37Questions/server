enum AnswerState {
  SUBMITTED = "submitted",
  REVEALED = "revealed",
  FAVORITE = "favorite",
}

class Answer {
  answer: string;
  state: AnswerState;
  userId?: number;
  displayPosition?: number;
  userIdGuess?: number;

  constructor(answer: Answer) {
    this.answer = answer.answer;
    this.state = answer.state;
    this.userId = answer.userId;
    this.displayPosition = answer.displayPosition;
    this.userIdGuess = answer.userIdGuess;
  }

  strip() {
    if (this.state === AnswerState.SUBMITTED) this.answer = "";
    this.userId = undefined;
  }
}



export {Answer, AnswerState};