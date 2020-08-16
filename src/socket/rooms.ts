import {SocketEventHandler} from "./helpers";
import db from "../db/db";
import {Room, RoomState, RoomVisibility} from "../struct/room";
import {Message} from "../struct/message";
import {UserState} from "../struct/user";
import {Util} from "../helpers";

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

    if (this.socketUser.loggedOut) {
      this.socketUser.roomId = undefined;
      return user;
    }

    let room = await db.rooms.get(this.socketUser.roomId, true);
    let roomUser = room.users[user.id];
    let message, additionalUpdate;

    if (roomUser && roomUser.name && roomUser.icon) {
      let messageBody = "Left the room";

      if (room.state === RoomState.PICKING_QUESTION && roomUser.state === UserState.SELECTING_QUESTION) {
        let activeUsers = room.getActiveUsers(roomUser.id);

        if (activeUsers.length > 0) {
          let selectedUser = activeUsers[Util.getRandomInt(0, activeUsers.length - 1)];
          let questions = await db.questions.getSelectionOptions(room);
          await db.rooms.setUserState(selectedUser.id, room.id, UserState.SELECTING_QUESTION);
          messageBody = `Left the room, leaving ${selectedUser.name} to pick a new question`;

          additionalUpdate = {
            event: "userStateChanged",
            data: {
              id: selectedUser.id,
              state: UserState.SELECTING_QUESTION
            }
          };

          this.socket.to(Room.tag(room.id, selectedUser.id)).emit("newQuestionsList", {
            questions: questions
          });
        }
      }

      message = await db.messages.create(roomUser, room, messageBody, true);
    }

    this.socket.to(room.tag).emit("userLeft", {
      id: this.socketUser.id,
      message: message,
      additionalUpdate: additionalUpdate
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
    let activeUsers = room.getActiveUsers();

    user.state = UserState.IDLE;

    if (user.setup && activeUsers.length < 1) {
      if (room.state === RoomState.PICKING_QUESTION) {
        user.state = UserState.SELECTING_QUESTION;
        room.questions = await db.questions.getSelectionOptions(room);
      }
    }

    if (room.users.hasOwnProperty(this.socketUser.id)) {
      this.socket.to(Room.tag(roomId, this.socketUser.id)).emit("forceLogout");
      let existingUser = room.users[this.socketUser.id];
      if (existingUser.active) {
        user.state = existingUser.state;
        if (user.state === UserState.SELECTING_QUESTION) {
          room.questions = await db.questions.getSelectionOptions(room);
        }
      } else {
        await db.rooms.setUserActive(this.socketUser.id, roomId, true, user.state);
      }

      user.score = existingUser.score;

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
      room.questions = await db.questions.getSelectionOptions(room);
      return this.joinSocketRoom(new RoomJoinInfo(room)).then((room) => {
        console.info(`Created room #${room.id}`);
        return {room: room};
      });
    });

    this.listen("joinRoom", async (data) => {
      let info = await this.joinRoom(data.id, data.token);
      let room = await this.joinSocketRoom(info);

      return {room: room};
    });

    this.listen("leaveRoom", async () => {
      if (!this.socketUser.roomId) throw new Error("Not in a room");
      await this.leaveCurRoom();
      return {success: true};
    })

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