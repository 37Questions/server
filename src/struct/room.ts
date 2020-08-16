import {User} from "./user";
import {Message} from "./message";
import {Question} from "./question";
import {Util} from "../helpers";
import {Answer} from "./answers";

class RoomVisibility {
  static Private = "private";
  static Public = "public";
}

class BaseRoom {
  id: number;
  name: string;
  lastActive: number;
  visibility: string;
  votingMethod: string;
  token?: string;

  constructor(room: BaseRoom) {
    this.id = room.id;
    this.name = room.name || ("Room #" + room.id);
    this.lastActive = room.lastActive;
    this.visibility = room.visibility;
    this.votingMethod = room.votingMethod;
    this.token = room.token;
  }
}

enum RoomState {
  PICKING_QUESTION = "picking_question",
  COLLECTING_ANSWERS = "collecting_answers",
  READING_ANSWERS = "reading_answers"
}

class Room extends BaseRoom {
  static VisibilityOptions = ["private", "public"];
  static VotingMethods = ["winner", "rotate", "democratic"];

  state: RoomState;
  users: Record<number, User>;
  messages: Record<number, Message>;

  questions: Question[];
  answers: Answer[];

  constructor(room: Room) {
    super(room);
    this.state = room.state;
    this.users = room.users || {};
    this.messages = room.messages || {};

    this.questions = room.questions || [];
    this.answers = room.answers || [];
  }

  static tag(id: number | string, userId?: number | string): string {
    if (userId) return Room.tag(id) + "-" + User.tag(userId);
    return "room-" + id;
  }

  get tag() {
    return Room.tag(this.id);
  }

  forEachUser(fn: (user: User) => void): void {
    Object.keys(this.users).forEach((userId: string) => {
      fn(this.users[Util.parseId(userId)]);
    });
  }

  getActiveUsers(exclude?: number): User[] {
    let activeUsers: User[] = [];

    this.forEachUser((user) => {
      if (exclude !== user.id && user.active && user.setup) activeUsers.push(user);
    })

    return activeUsers;
  }
}

class RoomInfo extends BaseRoom {
  players: number;
  activePlayers: number;

  constructor(info: RoomInfo) {
    super(info);

    this.players = info.players;
    this.activePlayers = info.activePlayers;
  }
}

export {Room, RoomInfo, RoomVisibility, RoomState};