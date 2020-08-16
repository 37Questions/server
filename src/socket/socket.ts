import SocketIO, {Socket} from "socket.io";
import {User} from "../struct/user";
import {SocketUser} from "./helpers";
import {MessageEventHandler} from "./messages";
import {RoomEventHandler} from "./rooms";
import QuestionEventHandler from "./questions";

function onConnection(io: SocketIO.Server, socket: Socket, userId: number) {
  let socketUser = new SocketUser(userId);

  let roomHandler = new RoomEventHandler(io, socket, socketUser);
  let messageHandler = new MessageEventHandler(io, socket, socketUser);
  let questionHandler = new QuestionEventHandler(io, socket, socketUser);

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
  questionHandler.registerQuestionEvents();
}

export {onConnection};