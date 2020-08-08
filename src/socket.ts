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
    })
    console.info("Room:", data);
  });
}

export {onConnection};