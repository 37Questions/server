import {RoomDBHandler} from "./rooms";
import {UserDBHandler} from "./users";
import {MessageDBHandler} from "./messages";
import {QuestionsDBHandler} from "./questions";

class Database {
  rooms = RoomDBHandler;
  users = UserDBHandler;
  messages = MessageDBHandler;
  questions = QuestionsDBHandler;
}

const db = new Database();
export default db;