import mysql = require("mysql");
import {Util, Validation} from "./helpers";
import {Icon, User} from "./struct/user";
import {Room, RoomVisibility} from "./struct/room";

const pool = mysql.createPool({
  host: process.env.RDS_HOSTNAME || "localhost",
  port: parseInt(process.env.RDS_PORT as string) || 3306,
  user: process.env.RDS_USERNAME || "questions",
  password: process.env.RDS_PASSWORD || "password",
  database: process.env.RDS_DATABASE || "questions_game"
});

async function query(sql: string, values: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    pool.query(sql, values, (err, res) => {
      if (err) {
        console.warn("Failed to execute query:", sql, err.stack);
        return reject("MySQL Error");
      }
      resolve(res);
    });
  });
}


function parseId(id: number | string): number {
  if (typeof id === "string") id = parseInt(id);
  if (!Validation.uint(id)) throw new Error("Invalid ID");
  return id;
}

const TOKEN_LENGTH = 8;

class Database {
  async createUser(): Promise<User> {
    let token = Util.makeHash(TOKEN_LENGTH);
    let res = await query(`INSERT INTO users (token) VALUES (?);`, [token]);

    if (res.affectedRows == 0) {
      console.warn("Tried to create a user but no change was made!");
      throw new Error("User Creation Failed");
    }

    let user = new User({
      id: res.insertId,
      token: token
    });

    console.info(`Created user #${user.id} with token #${user.token}`);
    return user;
  }


  async getUser(id: number | string, withToken = false): Promise<User> {
    let res = await query(`SELECT * FROM users WHERE id = ?`, [parseId(id)]);

    if (res.length < 1) {
      throw new Error("Invalid User");
    } else {
      let user = new User(res[0]);
      if (!withToken) user.token = undefined;

      return user;
    }
  }

  async validateUser(user: User): Promise<boolean> {
    if (!user || !Validation.uint(user.id) || !Validation.hash(user.token, TOKEN_LENGTH)) {
      throw new Error("Missing Credentials");
    }

    let res = await query(`SELECT token FROM users WHERE id = ?`, [user.id, user.token]);

    if (res.length < 1) {
      throw new Error("Invalid User");
    } else if (res[0].token != user.token) {
      throw new Error("Invalid Token");
    } else return true;
  }

  async setupUser(user: User, name: any, icon: Icon): Promise<User> {
    if (!Validation.string(name)) throw new Error("Invalid Name");
    name = Util.stripHTML(name);
    if (name.length < User.MIN_NAME_LENGTH) throw new Error(`Username must be at least ${User.MIN_NAME_LENGTH} characters!`);

    let iconError = icon.error;
    if (iconError) throw new Error(iconError);

    let valid = await this.validateUser(user);
    if (!valid) throw new Error("Invalid User");

    await query(`
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

    return this.getUser(user.id);
  }

  async createRoom(userId: number, visibility: string, votingMethod: string): Promise<Room> {
    if (!Validation.uint(userId)) throw new Error("Invalid User");
    if (!Room.VisibilityOptions.includes(visibility)) throw new Error("Invalid Visibility Setting");
    if (!Room.VotingMethods.includes(votingMethod)) throw new Error("Invalid Voting Method");

    let token = Util.makeHash(TOKEN_LENGTH);

    let res = await query(`
      INSERT INTO rooms (visibility, votingMethod, token)
      VALUES (?, ?, ?)
    `, [
      visibility,
      votingMethod,
      token
    ]);

    let roomId = res.insertId;

    return query(`
      UPDATE users
      SET room_id = ?
      WHERE id = ?
    `, [roomId, userId]).then(() => {
      return new Room({
        id: roomId,
        visibility: visibility,
        votingMethod: votingMethod,
        token: token
      } as Room);
    }).catch(async (error) => {
      console.warn(`Failed to add user #${userId} to newly created room #${roomId}:`, error);
      await query(`DELETE FROM rooms WHERE id = ? LIMIT 1`, [roomId]);
      throw error;
    });
  }

  async getRoom(id: number | string): Promise<Room> {
    let res = await query(`SELECT * FROM rooms WHERE id = ?`, [parseId(id)]);

    if (res.length < 1) throw new Error("Invalid Room ID");
    return new Room(res[0]);
  }

  async joinRoom(userId: number | string, roomId: number | string, token: string): Promise<Room> {
    let room = await this.getRoom(roomId);
    if (room.visibility !== RoomVisibility.Public && room.token !== token) throw new Error("Invalid Token");

    let user = await this.getUser(userId);

    if (room.id === user.room_id) return room;
    if (user.room_id) throw new Error("Already in a room!");

    await query(`UPDATE users SET room_id = ? WHERE id = ?`, [room.id, user.id]);
    return room;
  }

  async leaveRoom(userId: number | string): Promise<boolean> {
    userId = parseId(userId);

    let res = await query(`UPDATE users SET room_id = NULL WHERE id = ?`, [userId]);
    return res.affectedRows > 0;
  }
}

const db = new Database();
export default db;