import {Room, RoomVisibility} from "../struct/room";
import {Constants, Util, Validation} from "../helpers";
import pool from "./pool";
import {User} from "../struct/user";
import {Message, MessageLike} from "../struct/message";
import db from "./db";

class RoomDBHandler {
  static async create(userId: number, visibility: string, votingMethod: string): Promise<Room> {
    if (!Validation.uint(userId)) throw new Error("Invalid User");
    let user = await db.users.get(userId);

    if (!Room.VisibilityOptions.includes(visibility)) throw new Error("Invalid Visibility Setting");
    if (!Room.VotingMethods.includes(votingMethod)) throw new Error("Invalid Voting Method");

    let token = Util.makeHash(Constants.TokenLength);

    let res = await pool.query(`
      INSERT INTO rooms (visibility, votingMethod, token)
      VALUES (?, ?, ?)
    `, [
      visibility,
      votingMethod,
      token
    ]);

    let roomId = res.insertId;

    return this.addUser(userId, roomId).then(() => {
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

      return db.messages.create(user, room, "Created the room", true).then((message) => {
        room.messages = { [message.id]: message };
        return room;
      }).catch((error) => {
        console.warn(`Failed to create initial message for room #${room.id}:`, error.message);
        room.messages = {};
        return room;
      })
    }).catch(async (error) => {
      console.warn(`Failed to add user #${userId} to newly created room #${roomId}:`, error.message);
      await pool.query(`DELETE FROM rooms WHERE id = ? LIMIT 1`, [roomId]);
      throw error;
    });
  }

  static async get(id: number | string, withUsers = false, withMessages = false): Promise<Room> {
    let res = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [Util.parseId(id)]);

    if (res.length < 1) throw new Error("Invalid Room ID");
    let room = new Room(res[0]);

    if (withUsers) {
      let users = await pool.query(`
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
      let messages = await pool.query(`
        SELECT 
          msg.id, msg.created_at, msg.user_id, 
          msg.body, msg.type, 
          GROUP_CONCAT(
            DISTINCT CONCAT(likes.user_id, ':', likes.since) 
            SEPARATOR ','
          ) AS likes
        FROM messages msg
        LEFT JOIN messageLikes likes ON msg.id = likes.message_id
        WHERE msg.room_id = ?
        GROUP BY msg.id
        ORDER BY msg.id DESC
        LIMIT 50
      `, [room.id]);

      room.messages = {};

      for (let msg = 0; msg < messages.length; msg++) {
        let row = messages[msg];
        let likes: Record<number, MessageLike> = {};
        if (row.likes) {
          let likesData = row.likes.split(",");
          for (let like = 0; like < likesData.length; like++) {
            let likeData = likesData[like].split(":");
            likes[likeData[0]] = new MessageLike({
              user_id: likeData[0],
              since: likeData[1]
            });
          }
        }
        room.messages[row.id] = new Message({
          id: row.id,
          created_at: row.created_at,
          user_id: row.user_id,
          body: row.body,
          type: row.type,
          likes: likes
        });
        if (msg === messages.length - 1) room.messages[row.id].isChained = false;
      }
    }

    return room;
  }

  static async getList(): Promise<Room[]> {
    let res = await pool.query(`
      SELECT * FROM rooms WHERE visibility = ?
      ORDER BY last_active DESC
      LIMIT 15
    `, [RoomVisibility.Public]);

    let rooms = [];

    for (let i = 0; i < res.length; i++) {
      rooms.push(new Room(res[i]));
    }

    return rooms;
  }

  static async getUser(id: number | string, roomId: number | string, withToken = false): Promise<User> {
    id = Util.parseId(id);
    roomId = Util.parseId(roomId);

    let res = await pool.query(`
      SELECT * FROM roomUsers
      INNER JOIN users ON roomUsers.user_id = users.id
      WHERE roomUsers.user_id = ? AND roomUsers.room_id = ?
    `, [id, roomId]);

    if (res.length < 1) throw new Error("Invalid Room or User");
    return new User(res[0], withToken);
  }

  static async setUserActive(userId: number | string, roomId: number | string, active: boolean): Promise<boolean> {
    userId = Util.parseId(userId);
    roomId = Util.parseId(roomId);

    let res = await pool.query(`
      UPDATE roomUsers SET active = ? WHERE user_id = ? AND room_id = ?
    `, [active, userId, roomId]);
    return res.affectedRows > 0;
  }

  static async getActiveIdsFor(userId: number | string): Promise<number[]> {
    userId = Util.parseId(userId);

    let rooms = await pool.query(`
      SELECT room_id from roomUsers where user_id = ? AND active = true
    `, [userId]);

    let roomIds: number[] = [];

    for (let room = 0; room < rooms.length; room++) {
      roomIds.push(rooms[room].room_id);
    }

    return roomIds;
  }

  static async addUser(userId: number, roomId: number) {
    return pool.query(`INSERT INTO roomUsers (user_id, room_id) VALUES (?, ?)`, [userId, roomId]);
  }
}

export {RoomDBHandler};