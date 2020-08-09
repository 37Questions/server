import mysql = require("mysql");
import {Util, Validation} from "./helpers";
import {Icon, User} from "./struct/user";
import {Room} from "./struct/room";
import Message from "./struct/message";

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
        console.warn("Failed to execute query:", sql, err);
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
    }, true);

    console.info(`Created user #${user.id} with token #${user.token}`);
    return user;
  }

  async getUser(id: number | string, withToken = false): Promise<User> {
    let res = await query(`SELECT * FROM users WHERE id = ?`, [parseId(id)]);

    if (res.length < 1) throw new Error("Invalid User");
    return new User(res[0], withToken);
  }

  async getRoomUser(id: number | string, roomId: number | string, withToken = false): Promise<User> {
    id = parseId(id);
    roomId = parseId(roomId);

    let res = await query(`
      SELECT * FROM roomUsers
      INNER JOIN users ON roomUsers.user_id = users.id
      WHERE roomUsers.user_id = ? AND roomUsers.room_id = ?
    `, [id, roomId]);

    if (res.length < 1) throw new Error("Invalid Room or User");
    return new User(res[0], withToken);
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
    if (name.length > User.MAX_NAME_LENGTH) throw new Error(`Username cannot be longer than ${User.MAX_NAME_LENGTH} characters!`)
    if (name.includes(" ")) throw new Error("Username cannot contain spaces");

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

  async addUserToRoom(userId: number, roomId: number) {
    return query(`INSERT INTO roomUsers (user_id, room_id) VALUES (?, ?)`, [userId, roomId]);
  }

  async createRoom(userId: number, visibility: string, votingMethod: string): Promise<Room> {
    if (!Validation.uint(userId)) throw new Error("Invalid User");
    let user = await this.getUser(userId);

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

    return this.addUserToRoom(userId, roomId).then(() => {
      user.active = true;
      user.score = 0;

      let room = new Room({
        id: roomId,
        visibility: visibility,
        votingMethod: votingMethod,
        token: token,
        users: {
          [user.id]: user
        }
      } as Room);

      return this.createMessage(user, room, "Created the room", true).then((message) => {
        room.messages = { [message.id]: message };
        return room;
      }).catch((error) => {
        console.warn(`Failed to create initial message for room #${room.id}:`, error.message);
        room.messages = {};
        return room;
      })
    }).catch(async (error) => {
      console.warn(`Failed to add user #${userId} to newly created room #${roomId}:`, error.message);
      await query(`DELETE FROM rooms WHERE id = ? LIMIT 1`, [roomId]);
      throw error;
    });
  }

  async getRoom(id: number | string, withUsers = false, withMessages = false): Promise<Room> {
    let res = await query(`SELECT * FROM rooms WHERE id = ?`, [parseId(id)]);

    if (res.length < 1) throw new Error("Invalid Room ID");
    let room = new Room(res[0]);

    if (withUsers) {
      let users = await query(`
        SELECT * FROM roomUsers
        INNER JOIN users ON roomUsers.user_id = users.id
        WHERE roomUsers.room_id = ?
      `, [room.id]);

      room.users = {};

      for (let i = 0; i < users.length; i++) {
        let user = new User(users[i]);
        room.users[user.id] = user;
      }
    }

    if (withMessages) {
      let messages = await query(`
        SELECT * FROM messages
        WHERE room_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `, [room.id]);

      room.messages = {};

      for (let i = 0; i < messages.length; i++) {
        let message = new Message(messages[i]);
        room.messages[message.id] = message;
      }
    }

    return room;
  }

  async setRoomUserActive(userId: number | string, roomId: number | string, active: boolean): Promise<boolean> {
    userId = parseId(userId);
    roomId = parseId(roomId);

    let res = await query(`
      UPDATE roomUsers SET active = ? WHERE user_id = ? AND room_id = ?
    `, [active, userId, roomId]);
    return res.affectedRows > 0;
  }

  async getActiveRoomsIdsFor(userId: number | string): Promise<number[]> {
    userId = parseId(userId);

    let rooms = await query(`
      SELECT room_id from roomUsers where user_id = ? AND active = true
    `, [userId]);

    let roomIds: number[] = [];

    for (let room = 0; room < rooms.length; room++) {
      roomIds.push(rooms[room].room_id);
    }

    return roomIds;
  }

  async createMessage(user: User, room: Room, body: string, isSystemMsg = false): Promise<Message> {
    if (body.length < Message.MIN_LENGTH) throw new Error(`Messages must be at least ${Message.MIN_LENGTH} character(s) long`);
    if (body.length > Message.MAX_LENGTH) throw new Error(`Messages cannot be longer than ${Message.MAX_LENGTH} characters`);

    let res = await query(`
      INSERT INTO messages (user_id, room_id, body, isSystemMsg) VALUES (?, ?, ?, ?)
    `, [user.id, room.id, body, isSystemMsg]);

    return new Message({
      id: res.insertId,
      created_at: new Date().toISOString(),
      user_id: user.id,
      room_id: room.id,
      body: body,
      isSystemMsg: isSystemMsg
    });
  }
}

const db = new Database();
export default db;