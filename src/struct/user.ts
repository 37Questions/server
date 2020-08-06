class User {
  id: number;
  token?: string;
  room_id?: number;
  name?: string;
  icon?: string;
  score?: number;

  constructor(user: any) {
    this.id = parseInt(user.id);
    this.token = user.token;
    this.room_id = user.room_id;
    this.name = user.name;
    this.icon = user.icon;
    this.score = user.score || 0;
  }

  static fromQuery(query: any) {
    return new User({
      id: query.id,
      token: query.token
    });
  }
}

export {User};