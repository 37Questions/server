import {Icon, User} from "../struct/user";
import {Constants, Util, Validation} from "../helpers";
import pool from "./pool";

class UserDBHandler {
  static async create(): Promise<User> {
    let token = Util.makeHash(Constants.TokenLength);
    let res = await pool.query(`INSERT INTO users (token) VALUES (?);`, [token]);

    if (res.affectedRows == 0) {
      console.warn("Tried to create a user but no change was made!");
      throw new Error("User Creation Failed");
    }

    let user = new User({
      id: res.insertId,
      token: token
    }, true);

    console.info(`Created user #${user.id} with token #${user.token}`);
    return user;
  }

  static async get(id: number | string, withToken = false): Promise<User> {
    let res = await pool.query(`SELECT * FROM users WHERE id = ?`, [Util.parseId(id)]);

    if (res.length < 1) throw new Error("Invalid User");
    return new User(res[0], withToken);
  }

  static async validate(user: User): Promise<boolean> {
    if (!user || !Validation.uint(user.id) || !Validation.hash(user.token, Constants.TokenLength)) {
      throw new Error("Missing Credentials");
    }

    let res = await pool.query(`SELECT token FROM users WHERE id = ?`, [user.id, user.token]);

    if (res.length < 1) {
      throw new Error("Invalid User");
    } else if (res[0].token != user.token) {
      throw new Error("Invalid Token");
    } else return true;
  }

  static async setup(user: User, name: any, icon: Icon): Promise<User> {
    if (!Validation.string(name)) throw new Error("Invalid Name");
    name = Util.stripHTML(name);
    if (name.length < User.MIN_NAME_LENGTH) throw new Error(`Username must be at least ${User.MIN_NAME_LENGTH} characters!`);
    if (name.length > User.MAX_NAME_LENGTH) throw new Error(`Username cannot be longer than ${User.MAX_NAME_LENGTH} characters!`)
    if (name.includes(" ")) throw new Error("Username cannot contain spaces");

    let iconError = icon.error;
    if (iconError) throw new Error(iconError);

    let valid = await this.validate(user);
    if (!valid) throw new Error("Invalid User");

    await pool.query(`
      UPDATE users
      SET name = ?, iconName = ?, iconColor = ?, iconBackgroundColor = ?
      WHERE id = ?
    `, [
      name,
      icon.name,
      icon.color,
      icon.backgroundColor,
      user.id
    ]);

    return this.get(user.id);
  }
}

export {UserDBHandler};