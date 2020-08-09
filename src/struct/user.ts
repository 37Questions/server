import {Icons, Validation} from "../helpers";

class User {
  id: number;
  token?: string;
  room_id?: number;
  name?: string;
  icon?: Icon;
  score?: number;

  static MIN_NAME_LENGTH = 3;

  constructor(user: any) {
    this.id = parseInt(user.id);
    this.token = user.token;
    this.room_id = user.room_id;
    this.name = user.name;
    if (user.iconName && user.iconColor && user.iconBackgroundColor) {
      this.icon = new Icon(user);
    }
    this.score = user.score || 0;
  }

  static tag(id: number | string) {
    return "user-" + id;
  }

  get tag() {
    return User.tag(this.id);
  }
}

class Icon {
  name: string;
  color: number;
  backgroundColor: number;

  constructor(icon: any) {
    this.name = icon.name;
    this.color = parseInt(icon.color);
    this.backgroundColor = parseInt(icon.backgroundColor);
  }

  get error() {
    if (!Validation.string(this.name)) return "Missing Icon Name";
    if (!Icons.includes(this.name)) return "Invalid Icon Name";
    if (!Validation.uint(this.color)) return "Missing Icon Color";
    if (!Validation.uint(this.backgroundColor)) return "Missing Icon Background Color";
    return undefined;
  }
}

export {User, Icon};