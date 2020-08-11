import {RoomDBHandler} from "./rooms";
import {UserDBHandler} from "./users";
import {MessageDBHandler} from "./messages";

class Database {
  rooms = RoomDBHandler;
  users = UserDBHandler;
  messages = MessageDBHandler;
}

const db = new Database();
export default db;