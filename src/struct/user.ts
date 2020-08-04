class User {
  id: number;
  token?: string;
  room_id?: number;
  name?: string;
  icon?: string;
  score?: number;

  constructor(user: User) {
    this.id = user.id;
    this.token = user.token;
    this.room_id = user.room_id;
    this.name = user.name;
    this.icon = user.icon;
    this.score = user.score || 0;
  }
}

export {User};