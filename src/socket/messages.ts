import {Validation} from "../helpers";
import {Message} from "../struct/message";
import db from "../db";
import {SocketEventHandler} from "./helpers";

class MessageEventHandler extends SocketEventHandler {
  validateMessageBody(body: string): string {
    if (!Validation.string(body)) throw new Error("Missing message body");
    if (body.length < Message.MIN_LENGTH) throw new Error(`Message must be at least ${Message.MIN_LENGTH} character(s) long`);
    if (body.length > Message.MAX_LENGTH) throw new Error(`Message cannot be longer than ${Message.MAX_LENGTH} characters`);
    return body;
  }

  registerMessageEvents() {
    this.listen("sendMessage", async (data) => {
      let user = await db.getUser(this.socketUser.id);
      if (!this.socketUser.roomId) throw new Error("Not in a room");

      let body = this.validateMessageBody(data.body);
      let room = await db.getRoom(this.socketUser.roomId);
      let message = await db.createMessage(user, room, body);

      this.socket.to(room.tag).emit("messageSent", {message: message});
      return {message: message};
    });

    this.listen("editMessage", async (data) => {
      let user = await db.getUser(this.socketUser.id);
      if (!this.socketUser.roomId) throw new Error("Not in a room");

      let body = this.validateMessageBody(data.body);
      let room = await db.getRoom(this.socketUser.roomId);
      let message = await db.getMessage(data.id, room);

      if (message.user_id !== user.id) throw new Error("Insufficient permission");

      await db.updateMessage(message.id, room, body);

      message.body = body;

      this.socket.to(room.tag).emit("messageEdited", {message: message});
      return {message: message};
    });
  }
}

export {MessageEventHandler};