import {User} from "./user";
import Message from "./message";

class RoomVisibility {
  static Private = "private";
  static Public = "public";
}

class Room {
  static VisibilityOptions = ["private", "public"];
  static VotingMethods = ["rotate", "democratic"];

  id: number;
  visibility: string;
  votingMethod: string;
  token: string;

  users?: Record<number, User>;
  messages?: Record<number, Message>;

  constructor(room: Room) {
    this.id = room.id;
    this.visibility = room.visibility;
    this.votingMethod = room.votingMethod;
    this.token = room.token;
    this.users = room.users;
    this.messages = room.messages;
  }

  static tag(id: number | string, userId?: number | string): string {
    if (userId) return Room.tag(id) + "-" + User.tag(userId);
    return "room-" + id;
  }

  get tag() {
    return Room.tag(this.id);
  }
}

export {Room, RoomVisibility};