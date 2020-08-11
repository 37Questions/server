import {Validation} from "../helpers";
import {Message} from "../struct/message";
import db from "../db";
import {SocketEventHandler} from "./helpers";
import {Room} from "../struct/room";

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
      if (!this.socketUser.roomId) throw new Error("Not in a room");
      let user = await db.getUser(this.socketUser.id);

      let body = this.validateMessageBody(data.body);
      let room = await db.getRoom(this.socketUser.roomId);
      let message = await db.getMessage(data.id, room);

      if (message.user_id !== user.id) throw new Error("Insufficient permission");

      await db.updateMessage(message.id, body);

      message.body = body;

      this.socket.to(room.tag).emit("messageEdited", {message: message});
      return {message: message};
    });

    this.listen("likeMessage", async (data) => {
      if (!this.socketUser.roomId) throw new Error("Not in a room");
      let user = await db.getUser(this.socketUser.id);
      let like = await db.likeMessage(data.id, user);

      this.socket.to(Room.tag(this.socketUser.roomId)).emit("messageLiked", {
        message_id: data.id,
        like: like
      });

      return {like: like};
    });

    this.listen("unlikeMessage", async (data) => {
      if (!this.socketUser.roomId) throw new Error("Not in a room");
      let user = await db.getUser(this.socketUser.id);
      if (!await db.unlikeMessage(data.id, user)) throw new Error("Failed to unlike message");

      this.socket.to(Room.tag(this.socketUser.roomId)).emit("messageUnliked", {
        message_id: data.id,
        user_id: user.id
      });

      return {success: true};
    })
  }
}

export {MessageEventHandler};