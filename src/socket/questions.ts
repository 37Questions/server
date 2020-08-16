import {SocketEventHandler} from "./helpers";
import db from "../db/db";
import {RoomState} from "../struct/room";
import {UserState} from "../struct/user";

class QuestionEventHandler extends SocketEventHandler {
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
      if (!this.socketUser.roomId) throw new Error("Not in a room");

      let room = await db.rooms.get(this.socketUser.roomId);
      if (room.state !== RoomState.COLLECTING_ANSWERS) throw new Error("Unexpected room state");

      let user = await db.rooms.getUser(this.socketUser.id, room.id);
      if (user.state !== UserState.ANSWERING_QUESTION) throw new Error("Unexpected user state");

      let question = await db.questions.getSelected(room);
      if (!question) throw new Error("No question selected");

      await db.questions.submitAnswer(room, user, question, data.answer);
      await db.rooms.setUserState(user.id, room.id, UserState.IDLE);

      this.io.to(room.tag).emit("userStateChanged", {
        id: user.id,
        state: UserState.IDLE
      });

      return {success: true};
    });

    this.listen("startReadingAnswers", async () => {
      if (!this.socketUser.roomId) throw new Error("Not in a room");

      let room = await db.rooms.get(this.socketUser.roomId);
      if (room.state !== RoomState.COLLECTING_ANSWERS) throw new Error("Unexpected room state");

      let user = await db.rooms.getUser(this.socketUser.id, room.id);
      if (user.state !== UserState.ASKING_QUESTION) throw new Error("Unexpected user state");

      let question = await db.questions.getSelected(room);
      if (!question) throw new Error("No question selected");

      let answers = await db.questions.reorderAnswers(room, question);
      //answers.forEach((answer) => answer.strip(answer.state === AnswerState.SUBMITTED));

      await db.rooms.setState(room, RoomState.READING_ANSWERS);
      await db.rooms.setUserState(user.id, room.id, UserState.READING_ANSWERS);

      this.io.to(room.tag).emit("startReadingAnswers", {
        answers: answers
      });

      return {success: true};
    });
  }
}

export default QuestionEventHandler;