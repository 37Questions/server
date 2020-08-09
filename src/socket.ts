import {Socket} from "socket.io";
import db from "./db";
import {Room} from "./struct/room";
import {User} from "./struct/user";

function onConnection(socket: Socket, userId: number) {
  const joinRoom = async (room: Room) => {
    return db.getUser(userId).then((user) => {
      socket.join(room.tag);
      socket.to(room.tag).emit("userJoined", {
        user: user
      });

      return room;
    });
  };

  console.info(`Received socket connection from user #${userId}`);

  // TODO: handle logout
  socket.to(User.tag(userId)).emit("logout");
  socket.join(User.tag(userId));

  db.getUser(userId).then(async (user) => {
    if (user.room_id) await db.leaveRoom(userId).then((success) => {
      console.info(`Removed user #${userId} from room #${user.room_id} (successfully? ${success})`);
      user.room_id = undefined;
    });

    socket.emit("init", {
      user: user
    });
  });


  socket.on("logout", () => {
    console.info(`Logging out user #${userId}`);
    socket.disconnect(true);
  });

  socket.on("createRoom", (data, fn) => {
    let visibility = data.visibility;
    let votingMethod = data.votingMethod;

    db.createRoom(userId, visibility, votingMethod).then((room) => {
      return joinRoom(room).then((room) => {
        console.info(`Created room #${room.id}:`, room);
        fn({ room: room });
      });
    }).catch((error) => {
      console.warn(`Failed to create room with visibility ${visibility} and voting method ${votingMethod}:`, error);
      fn({ error: error.message });
    });
  });

  socket.on("joinRoom", (data, fn) => {
    db.joinRoom(userId, data.id, data.token).then((room) => {
      return joinRoom(room).then((room) => {
        console.info(`Added user #${userId} to room #${room.id}!`);
        fn({ room: room });
      });
    }).catch((error) => {
      console.warn(`Failed to add user #${userId} to room #${data.id}:`, error);
      fn({ error: error.message });
    });
  });

  socket.on("rejoinRoom", (data, fn) => {
    db.getUser(userId).then((user) => {
      if (!user.room_id) throw new Error("Not in a room");

      return db.getRoom(user.room_id).then((room) => {
        return joinRoom(room).then((room) => {
          console.info(`Rejoined room #${room.id} as user ${user.id}`);
          fn({ room: room });
        });
      });
    }).catch((error) => {
      console.warn(`Failed to rejoin room:`, error);
      fn({ error: error.message });
    })
  });
}

export {onConnection};