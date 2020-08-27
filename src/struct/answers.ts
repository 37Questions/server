enum AnswerState {
  SUBMITTED = "submitted",
  REVEALED = "revealed",
  FAVORITE = "favorite",
}

class StrippableAnswer {
  userId?: number;

  constructor(strippable: StrippableAnswer) {
    this.userId = strippable.userId;
  }

  strip() {
    this.userId = undefined;
  }
}

class Answer extends StrippableAnswer {
  id?: number;
  answer: string;
  state: AnswerState;
  displayPosition?: number;
  guesses: AnswerGuess[] = [];

  constructor(answer: Answer) {
    super(answer);
    this.id = answer.id;
    this.answer = answer.answer;
    this.state = answer.state;
    this.displayPosition = answer.displayPosition;
  }

  strip() {
    super.strip();
    this.id = undefined;
    if (this.state === AnswerState.SUBMITTED) this.answer = "";
    this.guesses.forEach((guess) => guess.strip());
  }
}

class AnswerGuess extends StrippableAnswer {
  guessedUserId: number;

  constructor(guess: AnswerGuess) {
    super(guess);
    this.guessedUserId = guess.guessedUserId;
  }
}

class FavoriteAnswer extends StrippableAnswer {
  displayPosition: number;

  constructor(favorite: FavoriteAnswer) {
    super(favorite);
    this.displayPosition = favorite.displayPosition;
  }
}

export {Answer, AnswerState, AnswerGuess, FavoriteAnswer};