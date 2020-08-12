import {SocketEventHandler} from "./helpers";
import db from "../db/db";
import {Room, RoomVisibility} from "../struct/room";
import {Message} from "../struct/message";

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
    let user = await db.users.get(this.socketUser.id, true);
    if (!this.socketUser.roomId) return user;

    this.socket.leave(Room.tag(this.socketUser.roomId));
    this.socket.leave(Room.tag(this.socketUser.roomId, this.socketUser.id));

    if (this.socketUser.loggedOut) return user;

    let room = await db.rooms.get(this.socketUser.roomId);
    let message;

    if (user.name && user.icon) {
      message = await db.messages.create(user, room, "Left the room", true);
    }

    this.socket.to(room.tag).emit("userLeft", {
      id: this.socketUser.id,
      message: message
    });

    await db.rooms.setUserActive(this.socketUser.id, room.id, false).then(() => {
      console.info(`Removed user #${this.socketUser.id} from active room #${room.id}`);
      this.socketUser.roomId = undefined;
    });

    return user;
  }

  async joinRoom(roomId: number | string, token?: number | string) {
    let user = await this.leaveCurRoom();

    let room = await db.rooms.get(roomId, true, true);
    if (!room.users) throw new Error("Corrupt Room (No users found)");
    if (room.visibility !== RoomVisibility.Public && room.token !== token) throw new Error("Invalid Token");

    let shouldCreateMessage = !!(user.name && user.icon);

    if (room.users.hasOwnProperty(this.socketUser.id)) {
      this.socket.to(Room.tag(roomId, this.socketUser.id)).emit("forceLogout");
      await db.rooms.setUserActive(this.socketUser.id, roomId, true);
      user.score = room.users[this.socketUser.id].score;
      shouldCreateMessage = shouldCreateMessage && !room.users[this.socketUser.id].active;
    } else {
      await db.rooms.addUser(user.id, room.id);
      user.score = 0;
    }

    user.active = true;
    room.users[user.id] = user;

    if (!shouldCreateMessage) return new RoomJoinInfo(room);

    let message = await db.messages.create(user, room, "Joined the room", true);
    room.messages[message.id] = message;

    return new RoomJoinInfo(room, message);
  }

  async joinSocketRoom(info: RoomJoinInfo) {
    let user = await db.rooms.getUser(this.socketUser.id, info.room.id);
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
      let name = data.name;
      let visibility = data.visibility;
      let votingMethod = data.votingMethod;

      let room = await db.rooms.create(this.socketUser.id, name, visibility, votingMethod);
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