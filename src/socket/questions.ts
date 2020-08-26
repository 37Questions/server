import {SocketEventHandler} from "./helpers";
import db from "../db/db";
import {Room, RoomState} from "../struct/room";
import {User, UserState} from "../struct/user";
import {Validation} from "../helpers";
import {Question} from "../struct/question";

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
  displayPosition: number;

  constructor(room: Room, user: User, question: Question, displayPosition: number) {
    super(room, user, question);
    this.displayPosition = displayPosition;
  }
}

class QuestionEventHandler extends SocketEventHandler {

  private async getQuestionInfo(expectedRoomState: RoomState, expectedUserState: UserState): Promise<QuestionInfo> {
    if (!this.socketUser.roomId) throw new Error("Not in a room");

    let room = await db.rooms.get(this.socketUser.roomId);
    if (room.state !== expectedRoomState) throw new Error("Unexpected room state");

    let user = await db.rooms.getUser(this.socketUser.id, room.id);
    if (user.state !== expectedUserState) throw new Error("Unexpected user state");

    let question = await db.questions.getSelected(room);
    if (!question) throw new Error("No question selected");

    return new QuestionInfo(room, user, question);
  }

  private async getAnswerInfo(displayPosition: number): Promise<AnswerInfo> {
    if (!Validation.uint(displayPosition)) throw new Error("Invalid Answer Position");
    let info = await this.getQuestionInfo(RoomState.READING_ANSWERS, UserState.READING_ANSWERS);
    return new AnswerInfo(info.room, info.user, info.question, displayPosition);
  }

  registerQuestionEvents() {
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

      await db.questions.submitAnswer(info.room, info.user, info.question, data.answer);
      await db.rooms.setUserState(info.user.id, info.room.id, UserState.IDLE);

      this.io.to(info.room.tag).emit("userStateChanged", {
        id: info.user.id,
        state: UserState.IDLE
      });

      return {success: true};
    });

    this.listen("startReadingAnswers", async () => {
      let info = await this.getQuestionInfo(RoomState.COLLECTING_ANSWERS, UserState.ASKING_QUESTION);

      let answers = await db.questions.reorderAnswers(info.room, info.question);
      answers.forEach((answer) => answer.strip());

      await db.rooms.setState(info.room, RoomState.READING_ANSWERS);
      await db.rooms.setUserState(info.user.id, info.room.id, UserState.READING_ANSWERS);

      this.io.to(info.room.tag).emit("startReadingAnswers", {
        answers: answers
      });

      return {success: true};
    });

    this.listen("revealAnswer", async (data) => {
      let info = await this.getAnswerInfo(data.displayPosition);

      let answer = await db.questions.revealAnswer(info.room, info.question, info.displayPosition);

      this.io.to(info.room.tag).emit("answerRevealed", {
        answer: answer
      });

      return {success: true};
    });

    this.listen("setFavoriteAnswer", async (data) => {
      let info = await this.getAnswerInfo(data.displayPosition);

      await db.questions.setFavorite(info.room, info.question, info.displayPosition);

      this.io.to(info.room.tag).emit("answerFavorited", {
        displayPosition: info.displayPosition
      });

      return {success: true};
    });

    this.listen("clearFavoriteAnswer", async () => {
      let info = await this.getQuestionInfo(RoomState.READING_ANSWERS, UserState.READING_ANSWERS);
      await db.questions.clearFavorite(info.room, info.question);

      this.io.to(info.room.tag).emit("favoriteAnswerCleared", {});
      return {success: true};
    })
  }
}

export default QuestionEventHandler;