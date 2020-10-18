import {SocketEventHandler} from "./helpers";
import db from "../db/db";
import {Room, RoomState, RoomVotingMethod} from "../struct/room";
import {User, UserState} from "../struct/user";
import {Util, Validation} from "../helpers";
import {Question} from "../struct/question";
import {Answer} from "../struct/answers";

class QuestionInfo {
  room: Room;
  user: User;
  question: Question;

  constructor(room: Room, user: User, question: Question) {
    this.room = room;
    this.user = user;
    this.question = question;
  }
}

class AnswerInfo extends QuestionInfo {
  answer: Answer;

  constructor(room: Room, user: User, question: Question, answer: Answer) {
    super(room, user, question);
    this.answer = answer;
  }
}

class QuestionEventHandler extends SocketEventHandler {
  private async getQuestionInfo(expectedRoomState: RoomState, expectedUserState: UserState, getAllUsers = false): Promise<QuestionInfo> {
    if (!this.socketUser.roomId) throw new Error("Not in a room");

    let room = await db.rooms.get(this.socketUser.roomId, getAllUsers);
    if (room.state !== expectedRoomState) throw new Error("Unexpected room state");

    let user: User;
    if (getAllUsers) user = room.users[this.socketUser.id];
    else {
      user = await db.rooms.getUser(this.socketUser.id, room.id);
      if (user.state !== expectedUserState) throw new Error("Unexpected user state");
    }

    let question = await db.questions.getSelected(room);
    if (!question) throw new Error("No question selected");

    return new QuestionInfo(room, user, question);
  }

  private async getAnswerInfo(displayPosition: number): Promise<AnswerInfo> {
    if (!Validation.uint(displayPosition)) throw new Error("Invalid Answer Position");

    let info = await this.getQuestionInfo(RoomState.READING_ANSWERS, UserState.READING_ANSWERS);
    let answer = await db.answers.fromPosition(info.room, info.question, displayPosition);

    return new AnswerInfo(info.room, info.user, info.question, answer);
  }

  registerQuestionEvents() {
    this.listen("suggestQuestion", async (data) => {
      let id = await db.questions.suggest(this.socketUser.id, data.question);
      return {
        success: true,
        questionId: id
      };
    });

    this.listen("submitQuestion", async (data) => {
      if (!this.socketUser.roomId) throw new Error("Not in a room");
      let question = await db.questions.get(data.id);

      let room = await db.rooms.get(this.socketUser.roomId);
      if (room.state !== RoomState.PICKING_QUESTION) throw new Error("Unexpected room state");

      let user = await db.rooms.getUser(this.socketUser.id, room.id);
      if (user.state !== UserState.SELECTING_QUESTION) throw new Error("Unexpected user state");

      await db.questions.select(question, room);
      await db.rooms.startCollectingAnswers(room);
      await db.rooms.setUserState(user.id, room.id, UserState.ASKING_QUESTION);

      this.io.to(room.tag).emit("questionSelected", {
        question: question,
        selectedBy: user.id
      });

      return {success: true};
    });

    this.listen("submitAnswer", async (data) => {
      let info = await this.getQuestionInfo(RoomState.COLLECTING_ANSWERS, UserState.ANSWERING_QUESTION);

      await db.answers.submit(info.room, info.question, info.user, data.answer);
      await db.rooms.setUserState(info.user.id, info.room.id, UserState.IDLE);

      this.io.to(info.room.tag).emit("userStateChanged", {
        id: info.user.id,
        state: UserState.IDLE
      });

      return {success: true};
    });

    this.listen("startReadingAnswers", async () => {
      let info = await this.getQuestionInfo(RoomState.COLLECTING_ANSWERS, UserState.ASKING_QUESTION);

      let answers = await db.answers.shuffle(info.room, info.question);
      let answerUserIds: number[] = [];
      answers.forEach((answer) => {
        if (answer.userId) answerUserIds.push(answer.userId);
        answer.strip();
      });

      await db.rooms.setState(info.room, RoomState.READING_ANSWERS);
      await db.rooms.setUserState(info.user.id, info.room.id, UserState.READING_ANSWERS);

      this.io.to(info.room.tag).emit("startReadingAnswers", {
        answers: answers,
        answerUserIds: answerUserIds
      });

      return {success: true};
    });

    this.listen("revealAnswer", async (data) => {
      let info = await this.getAnswerInfo(data.displayPosition);

      if (isNaN(info.answer.displayPosition as number)) throw new Error("Failed to reveal answer");
      let answer = await db.answers.reveal(info.room, info.question, info.answer.displayPosition as number);

      this.io.to(info.room.tag).emit("answerRevealed", {
        answer: answer
      });

      return {success: true};
    });

    this.listen("setFavoriteAnswer", async (data) => {
      let info = await this.getAnswerInfo(data.displayPosition);
      await db.answers.setPersonalFavorite(info.room, info.question, info.user, info.answer);

      this.io.to(info.room.tag).emit("answerFavorited", {
        displayPosition: info.answer.displayPosition
      });

      return {success: true};
    });

    this.listen("clearFavoriteAnswer", async () => {
      let info = await this.getQuestionInfo(RoomState.READING_ANSWERS, UserState.READING_ANSWERS);
      await db.answers.clearPersonalFavorite(info.room, info.question, info.user);

      this.io.to(info.room.tag).emit("favoriteAnswerCleared", {});
      return {success: true};
    });

    this.listen("makeAuthorGuess", async (data) => {
      let info = await this.getAnswerInfo(data.displayPosition);
      let guessedUser = await db.rooms.getUser(data.guessedUserId, info.room.id);
      await db.answers.makeGuess(info.room, info.question, info.user, info.answer, guessedUser);

      this.io.to(info.room.tag).emit("answerGuessed", {
        displayPosition: info.answer.displayPosition,
        guessedUserId: guessedUser.id
      });
      return {success: true};
    });

    this.listen("finalizeGuesses", async () => {
      let info = await this.getQuestionInfo(RoomState.READING_ANSWERS, UserState.READING_ANSWERS, true);
      let favoriteAnswers = await db.answers.getFavorites(info.room, info.question);
      if (favoriteAnswers.length === 0) throw new Error("A favorite answer is required to complete guessing");

      let answers = await db.answers.getAll(info.room, info.question, true);
      let guessResults: Record<number, boolean> = {};
      let winnerId: number = -1;

      answers.forEach((answer) => {
        if (answer.displayPosition === undefined) throw new Error("Answers must be sorted before they can be finalized");
        if (answer.guesses.length === 0) throw new Error("All answers must be guessed before guessing can be finalized");

        // TODO: democratic voting
        if (answer.displayPosition === favoriteAnswers[0].displayPosition && answer.userId !== undefined) {
          db.answers.setFavorite(info.room, info.question, answer);
          winnerId = answer.userId;
        }
        guessResults[answer.displayPosition] = answer.userId === answer.guesses[0].guessedUserId;
      });

      if (winnerId === -1) throw new Error("Failed to determine a winner for the round");

      await db.rooms.setState(info.room, RoomState.VIEWING_RESULTS);
      await db.rooms.setUserState(info.user.id, info.room.id, UserState.ASKED_QUESTION);
      await db.rooms.setUserState(winnerId, info.room.id, UserState.WINNER);

      let data = {
        guessResults: guessResults,
        winnerId: winnerId,
        askingNextId: -1
      };

      // Try and find the player who will ask the next question
      if (info.room.votingMethod === RoomVotingMethod.ROTATE) {
        let userIds = Object.keys(info.room.users);
        // Start searching at the current selected player
        let startIndex = userIds.indexOf(info.user.id.toString());
        for (let u = startIndex; u < userIds.length; u++) {
          let user = info.room.users[Util.parseId(userIds[u])];
          if (user.setup && user.active && user.id !== info.user.id) {
            data.askingNextId = user.id;
            break;
          }
        }

        // If no suitable players were found, restart the search at the beginning of the player array
        if (data.askingNextId === -1) {
          for (let u = 0; u < startIndex; u++) {
            let user = info.room.users[Util.parseId(userIds[u])];
            if (user.setup && user.active && user.id !== info.user.id) {
              data.askingNextId = user.id;
              break;
            }
          }
        }

        // If a suitable player still hasn't been found, panic
        if (data.askingNextId === -1) {
          // TODO: show results temporarily and then reset
          console.warn("Unable to find a suitable player to ask the next question");
          throw new Error("Failed to find a suitable player to ask the next question");
        } else {
          await db.rooms.setUserState(data.askingNextId, info.room.id, UserState.ASKING_NEXT);
        }
      }

      this.io.to(info.room.tag).emit("startViewingResults", data);
      return {success: true};
    });
  }
}

export default QuestionEventHandler;