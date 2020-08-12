import {User} from "./user";
import {Message} from "./message";

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

class Room extends BaseRoom {
  static VisibilityOptions = ["private", "public"];
  static VotingMethods = ["rotate", "democratic"];

  users: Record<number, User>;
  messages: Record<number, Message>;

  constructor(room: Room) {
    super(room);
    this.users = room.users || {};
    this.messages = room.messages || {};
  }

  static tag(id: number | string, userId?: number | string): string {
    if (userId) return Room.tag(id) + "-" + User.tag(userId);
    return "room-" + id;
  }

  get tag() {
    return Room.tag(this.id);
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

export {Room, RoomInfo, RoomVisibility};