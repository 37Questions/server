import {Socket} from "socket.io";
import {User} from "../struct/user";
import {SocketUser} from "./helpers";
import {MessageEventHandler} from "./messages";
import {RoomEventHandler} from "./rooms";

function onConnection(socket: Socket, userId: number) {
  let socketUser = new SocketUser(userId);

  let roomHandler = new RoomEventHandler(socket, socketUser);
  let messageHandler = new MessageEventHandler(socket, socketUser);

  console.info(`User #${userId} connected!`);
  socket.join(User.tag(userId));

  roomHandler.leaveCurRoom().then((user) => {
    socket.emit("init", {
      user: user
    });
  }).catch((error) => {
    console.error(`Failed to get newly joined user #${userId}:`, error.message);
  });

  roomHandler.registerRoomEvents();
  messageHandler.registerMessageEvents();
}

export {onConnection};