import {Socket} from "socket.io";
import db from "./db";
import {Room, RoomVisibility} from "./struct/room";
import {User} from "./struct/user";
import {Util, Validation} from "./helpers";
import Message from "./struct/message";

function onConnection(socket: Socket, userId: number) {
  let curRoomId: number | null = null;
  let loggedOut = false;

  const leaveCurRoom = async () => {
    return db.getUser(userId, true).then(async (user) => {
      if (curRoomId) {
        socket.leave(Room.tag(curRoomId));
        socket.leave(Room.tag(curRoomId, userId));

        if (loggedOut) return user;

        let room = await db.getRoom(curRoomId);
        let message;

        if (user.name && user.icon) {
          message = await db.createMessage(user, room, "Left the room", true);
        }

        socket.to(room.tag).emit("userLeft", {
          id: userId,
          message: message
        });

        await db.setRoomUserActive(userId, room.id, false).then(() => {
          console.info(`Removed user #${userId} from active room #${room.id}`);
          curRoomId = null;
        });
      }
      return user;
    });
  }

  const joinRoom = async (roomId: number | string, token?: number | string) => {
    let user = await leaveCurRoom();

    let room = await db.getRoom(roomId, true, true);
    if (!room.users) throw new Error("Corrupt Room (No users found)");
    if (room.visibility !== RoomVisibility.Public && room.token !== token) throw new Error("Invalid Token");

    if (room.users.hasOwnProperty(userId)) {
      socket.to(Room.tag(roomId, userId)).emit("forceLogout");
      await db.setRoomUserActive(userId, roomId, true);
      user.score = room.users[userId].score;
    } else {
      await db.addUserToRoom(user.id, room.id);
      user.score = 0;
    }

    user.active = true;
    room.users[user.id] = user;

    return room;
  }

  const joinSocketRoom = async (room: Room) => {
    return db.getRoomUser(userId, room.id).then((user) => {
      curRoomId = room.id;

      socket.join(room.tag);
      socket.join(Room.tag(room.id, userId));

      socket.to(room.tag).emit("userJoined", {
        user: user
      });

      return room;
    });
  };

  console.info(`User #${userId} connected!`);

  socket.join(User.tag(userId));

  leaveCurRoom().then((user) => {
    socket.emit("init", {
      user: user
    });
  }).catch((error) => {
    console.error(`Failed to get newly joined user #${userId}:`, error.message);
  });

  socket.on("disconnect", (reason) => {
    leaveCurRoom().then(() => {
      console.info(`User #${userId} disconnected:`, reason);
    });
  });

  socket.on("forcedLogout", () => {
    console.info(`Logging out user #${userId}`);
    loggedOut = true;
    socket.disconnect(true);
  });

  socket.on("createRoom", (data, fn) => {
    let visibility = data.visibility;
    let votingMethod = data.votingMethod;

    db.createRoom(userId, visibility, votingMethod).then((room) => {
      return joinSocketRoom(room).then((room) => {
        console.info(`Created room #${room.id}`);
        fn({room: room});
      });
    }).catch((error) => {
      console.warn(`Failed to create room with settings ${data}:`, error.message);
      fn({error: error.message});
    });
  });

  socket.on("joinRoom", (data, fn) => {
    joinRoom(data.id, data.token).then((room) => {
      return joinSocketRoom(room).then((room) => {
        console.info(`Added user #${userId} to room #${room.id}!`);
        fn({room: room});
      });
    }).catch((error) => {
      console.warn(`Failed to add user #${userId} to room #${data.id}:`, error.message);
      fn({error: error.message});
    });
  });

  socket.on("sendMessage", (data, fn) => {
    db.getUser(userId).then(async (user) => {
      if (!curRoomId) throw new Error("Not in a room");

      let body = data.body;
      if (!Validation.string(body)) throw new Error("Missing message body");
      if (body.length < Message.MIN_LENGTH) throw new Error(`Message must be at least ${Message.MIN_LENGTH} character(s) long`);
      if (body.length > Message.MAX_LENGTH) throw new Error(`Message cannot be longer than ${Message.MAX_LENGTH} characters`);

      let room = await db.getRoom(curRoomId);
      let message = await db.createMessage(user, room, body);

      fn({message: message});
      socket.to(room.tag).emit("chatMessage", { message: message });
    }).catch((error) => {
      console.warn(`Failed to send message:`, error.message);
      fn({error: error.message});
    })
  });
}

export {onConnection};