import {Socket} from "socket.io";

class SocketUser {
  id: number;
  roomId?: number;
  loggedOut: boolean;

  constructor(userId: number, roomId?: number) {
    this.id = userId;
    this.roomId = roomId;
    this.loggedOut = false;
  }
}

class SocketEventHandler {
  socket: Socket;
  socketUser: SocketUser;

  constructor(socket: Socket, socketUser: SocketUser) {
    this.socket = socket;
    this.socketUser = socketUser;
  }

  listen(event: string, callback: (data: any) => Promise<any | undefined>) {
    this.socket.on(event, (data, fn) => {
      callback(data).then((res) => {
        if (res && fn) fn(res);
      }).catch((error) => {
        console.warn(`Socket event '${event}' returned error:`, error.message);
        if (fn) fn({error: error.message});
      });
    });
  }
}

export {SocketUser, SocketEventHandler};