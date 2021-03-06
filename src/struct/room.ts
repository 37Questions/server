import {User} from "./user";
import {Message} from "./message";
import {Question} from "./question";
import {Util} from "../helpers";
import {Answer} from "./answers";

enum RoomVisibility {
  PRIVATE = "private",
  PUBLIC = "public"
}

enum RoomVotingMethod {
  WINNER = "winner",
  ROTATE = "rotate",
  DEMOCRATIC = "democratic"
}

enum RoomState {
  PICKING_QUESTION = "picking_question",
  COLLECTING_ANSWERS = "collecting_answers",
  READING_ANSWERS = "reading_answers",
  VIEWING_RESULTS = "viewing_results"
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

class Room extends BaseRoom {
  static VisibilityOptions = ["private", "public"];
  static VotingMethods = ["winner", "rotate", "democratic"];

  state: RoomState;
  users: Record<number, User>;
  messages: Record<number, Message>;

  // kickVotes[votedUserId] = {userId, userId...}
  kickVotes: Record<number, number[]>;

  questions: Question[];
  answers: Answer[];
  answerUserIds: number[];
  favoriteAnswers: number[];
  guessResults: Record<number, boolean>;

  constructor(room: Room) {
    super(room);
    this.state = room.state;
    this.users = room.users || {};
    this.messages = room.messages || {};

    this.kickVotes = room.kickVotes || {};

    this.questions = room.questions || [];
    this.answers = room.answers || [];
    this.answerUserIds = room.answerUserIds || [];
    this.favoriteAnswers = room.favoriteAnswers || [];
    this.guessResults = room.guessResults || {};
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
    });

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

export {Room, RoomInfo, RoomVisibility, RoomVotingMethod, RoomState};