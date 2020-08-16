import {RoomDBHandler} from "./rooms";
import {UserDBHandler} from "./users";
import {MessageDBHandler} from "./messages";
import {QuestionDBHandler} from "./questions";

class Database {
  rooms = RoomDBHandler;
  users = UserDBHandler;
  messages = MessageDBHandler;
  questions = QuestionDBHandler;
}

const db = new Database();
export default db;