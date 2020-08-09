import {Icons, Validation} from "../helpers";

class User {
  static MIN_NAME_LENGTH = 3;

  id: number;
  token?: string;
  name?: string;
  icon?: Icon;

  // Per-Room data
  active?: boolean;
  score?: number;

  constructor(user: any, withToken = false) {
    this.id = parseInt(user.id);
    if (withToken) this.token = user.token;
    this.name = user.name;
    if (user.iconName && user.iconColor && user.iconBackgroundColor) {
      this.icon = new Icon({
        name: user.iconName,
        color: user.iconColor,
        backgroundColor: user.iconBackgroundColor
      });
    }

    this.active = user.active;
    this.score = user.score;
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