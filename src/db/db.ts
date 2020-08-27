import {RoomDBHandler} from "./rooms";
import {UserDBHandler} from "./users";
import {MessageDBHandler} from "./messages";
import {QuestionDBHandler} from "./questions";
import {AnswerDBHandler} from "./answers";

class Database {
  rooms = RoomDBHandler;
  users = UserDBHandler;
  messages = MessageDBHandler;
  questions = QuestionDBHandler;
  answers = AnswerDBHandler;
}

const db = new Database();
export default db;