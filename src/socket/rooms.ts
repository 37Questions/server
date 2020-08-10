import {SocketEventHandler} from "./helpers";
import db from "../db";
import {Room, RoomVisibility} from "../struct/room";
import Message from "../struct/message";

class RoomJoinInfo {
  room: Room;
  message?: Message;

  constructor(room: Room, message?: Message) {
    this.room = room;
    this.message = message;
  }
}

class RoomEventHandler extends SocketEventHandler {
  async leaveCurRoom() {
    let user = await db.getUser(this.socketUser.id, true);
    if (!this.socketUser.roomId) return user;

    this.socket.leave(Room.tag(this.socketUser.roomId));
    this.socket.leave(Room.tag(this.socketUser.roomId, this.socketUser.id));

    if (this.socketUser.loggedOut) return user;

    let room = await db.getRoom(this.socketUser.roomId);
    let message;

    if (user.name && user.icon) {
      message = await db.createMessage(user, room, "Left the room", true);
    }

    this.socket.to(room.tag).emit("userLeft", {
      id: this.socketUser.id,
      message: message
    });

    await db.setRoomUserActive(this.socketUser.id, room.id, false).then(() => {
      console.info(`Removed user #${this.socketUser.id} from active room #${room.id}`);
      this.socketUser.roomId = undefined;
    });

    return user;
  }

  async joinRoom(roomId: number | string, token?: number | string) {
    let user = await this.leaveCurRoom();

    let room = await db.getRoom(roomId, true, true);
    if (!room.users) throw new Error("Corrupt Room (No users found)");
    if (room.visibility !== RoomVisibility.Public && room.token !== token) throw new Error("Invalid Token");

    let message, shouldCreateMessage;

    if (room.users.hasOwnProperty(this.socketUser.id)) {
      this.socket.to(Room.tag(roomId, this.socketUser.id)).emit("forceLogout");
      await db.setRoomUserActive(this.socketUser.id, roomId, true);
      user.score = room.users[this.socketUser.id].score;
      shouldCreateMessage = !room.users[this.socketUser.id].active;
    } else {
      await db.addUserToRoom(user.id, room.id);
      user.score = 0;
      shouldCreateMessage = !!(user.name && user.icon);
    }

    user.active = true;
    room.users[user.id] = user;

    if (shouldCreateMessage) {
      message = await db.createMessage(user, room, "Joined the room", true);
      room.messages[message.id] = message;
    }

    return new RoomJoinInfo(room, message);
  }

  async joinSocketRoom(info: RoomJoinInfo) {
    let user = await db.getRoomUser(this.socketUser.id, info.room.id);
    this.socketUser.roomId = info.room.id;

    this.socket.join(info.room.tag);
    this.socket.join(Room.tag(info.room.id, this.socketUser.id));

    this.socket.to(info.room.tag).emit("userJoined", {
      user: user,
      message: info.message
    });

    return info.room;
  };

  registerRoomEvents() {
    this.listen("createRoom", async (data) => {
      let visibility = data.visibility;
      let votingMethod = data.votingMethod;

      let room = await db.createRoom(this.socketUser.id, visibility, votingMethod);
      return this.joinSocketRoom(new RoomJoinInfo(room)).then((room) => {
        console.info(`Created room #${room.id}`);
        return {room: room};
      });
    });

    this.listen("joinRoom", async (data) => {
      let info = await this.joinRoom(data.id, data.token);
      let room = await this.joinSocketRoom(info);

      console.info(`Added user #${this.socketUser.id} to room #${room.id}!`);
      return {room: room};
    });

    this.listen("disconnect", async (reason) => {
      await this.leaveCurRoom();
      console.info(`User #${this.socketUser.id} disconnected:`, reason);
    });

    this.listen("forcedLogout", async () => {
      console.info(`Logging out user #${this.socketUser.id}`);
      this.socketUser.loggedOut = true;
      this.socket.disconnect(true);
    });
  }
}

export {RoomEventHandler};