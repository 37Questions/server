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
      await db.rooms.setState(room, RoomState.COLLECTING_ANSWERS);
      await db.rooms.setUserState(user.id, room.id, UserState.ASKING_QUESTION);

      this.io.to(room.tag).emit("questionSelected", {
        question: question,
        selectedBy: user.id
      });

      return {success: true};
    });
  }
}

export default QuestionEventHandler;