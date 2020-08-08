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

  constructor(room: Room) {
    this.id = room.id;
    this.visibility = room.visibility;
    this.votingMethod = room.votingMethod;
    this.token = room.token;
  }
}

export {Room, RoomVisibility};