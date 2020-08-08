import {Socket} from "socket.io";
import db from "./db";

function onConnection(socket: Socket, userId: number) {
  console.info(`Received socket connection from user #${userId}`);

  socket.emit("init", {
    userId: userId
  });

  socket.on("createRoom", (data, fn) => {
    let visibility = data.visibility;
    let votingMethod = data.votingMethod;

    db.createRoom(userId, visibility, votingMethod).then((room) => {
      console.info(`Created room #${room.id}:`, room);
      fn({ room: room });
    }).catch((error) => {
      console.warn(`Failed to create room with visibility ${visibility} and voting method ${votingMethod}:`, error);
      fn({ error: error.message });
    });
  });

  socket.on("joinRoom", (data, fn) => {
    db.joinRoom(userId, data.id, data.token).then((room) => {
      // TODO: join logic
      console.info(`Added user #${userId} to room #${room.id}!`);
      fn({ room: room });
    }).catch((error) => {
      console.warn(`Failed to add user #${userId} to room #${data.id}:`, error);
      fn({ error: error.message });
    });
  });

  socket.on("rejoinRoom", (data, fn) => {
    db.getUser(userId).then((user) => {
      if (!user.room_id) throw new Error("Not in a room");

      return db.getRoom(user.room_id).then((room) => {
        // TODO: rejoin logic
        console.info(`Rejoined room #${room.id} as user ${user.id}`);
        fn({ room: room });
      });
    }).catch((error) => {
      console.warn(`Failed to rejoin room:`, error);
      fn({ error: error.message });
    })
  });
}

export {onConnection};