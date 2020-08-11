import {User} from "../struct/user";
import {Room} from "../struct/room";
import {Message, MessageLike, MessageType} from "../struct/message";
import {Util} from "../helpers";
import pool from "./pool";

class MessageDBHandler {
  static async create(user: User, room: Room, body: string, isSystemMsg = false): Promise<Message> {
    if (!user.setup) throw new Error("A name and icon is required to create messages");

    if (body.length < Message.MIN_LENGTH) throw new Error(`Messages must be at least ${Message.MIN_LENGTH} character(s) long`);
    if (body.length > Message.MAX_LENGTH) throw new Error(`Messages cannot be longer than ${Message.MAX_LENGTH} characters`);

    let timestamp = Util.unixTimestamp();
    let type = isSystemMsg ? MessageType.System : MessageType.Normal;

    if (!isSystemMsg) {
      let lastMessage = await pool.query(`
        SELECT user_id, body, type 
        FROM messages WHERE room_id = ? 
        ORDER BY id DESC LIMIT 1
      `, [room.id]);

      if (lastMessage.length > 0) {
        let msg = lastMessage[0];
        if (msg.user_id === user.id && msg.type !== MessageType.System) {
          type = MessageType.Chained;
        }
      }
    }

    let res = await pool.query(`
      INSERT INTO messages (created_at, user_id, room_id, body, type) VALUES (?, ?, ?, ?, ?)
    `, [timestamp, user.id, room.id, body, type]);

    return new Message({
      id: res.insertId,
      created_at: timestamp,
      user_id: user.id,
      body: body,
      type: type
    });
  }

  static async get(id: number | string, room: Room, withLikes = false): Promise<Message> {
    id = Util.parseId(id);

    let res = await pool.query(`
      SELECT * FROM messages WHERE id = ? AND room_id = ?
    `, [id, room.id]);

    if (res.length < 1) throw new Error("Invalid Message");

    let message = new Message(res[0]);
    if (withLikes) message.likes = await this.getLikes(id);

    return message;
  }

  static async getLikes(id: number): Promise<Record<number, MessageLike>> {
    id = Util.parseId(id);

    let res = await pool.query(`
      SELECT user_id, since FROM messageLikes WHERE message_id = ?
    `, [id]);

    let likes: Record<number, MessageLike> = {};

    for (let i = 0; i < res.length; i++) {
      let like = new MessageLike(res[i]);
      likes[like.user_id] = like;
    }

    return likes;
  }

  static async update(id: number | string, body: string): Promise<boolean> {
    id = Util.parseId(id);

    let res = await pool.query(`
      UPDATE messages SET body = ? WHERE id = ?
    `, [body, id]);

    return res.affectedRows > 0;
  }

  static async like(id: number | string, user: User): Promise<MessageLike> {
    id = Util.parseId(id);

    let existing = await pool.query(`
      SELECT since FROM messageLikes
      WHERE message_id = ? AND user_id = ?
   `, [id, user.id]);
    if (existing.length > 0) throw new Error("Message was already liked");

    let timestamp = Util.unixTimestamp();
    await pool.query(`
      INSERT INTO messageLikes (message_id, user_id, since)
      VALUES (?, ?, ?)
    `, [id, user.id, timestamp]);

    return new MessageLike({
      user_id: user.id,
      since: timestamp
    });
  }

  static async unlike(id: number | string, user: User): Promise<boolean> {
    id = Util.parseId(id);

    let res = await pool.query(`
      DELETE FROM messageLikes
      WHERE message_id = ? AND user_id = ?
    `, [id, user.id]);

    return res.affectedRows > 0;
  }

  static async delete(message: Message, room: Room): Promise<Message | undefined> {
    let res = await pool.query(`DELETE from messages WHERE id = ?`, [message.id]);

    if (res.affectedRows < 1) throw new Error("Failed to delete message");
    if (message.isChained || message.isSystemMsg) return;

    let nextMessage = await pool.query(`
      SELECT id, user_id, type, body FROM messages WHERE id > ? AND room_id = ?
      ORDER BY id ASC LIMIT 1
    `, [message.id, room.id]);

    if (nextMessage.length < 1) return;
    let msg = new Message(nextMessage[0]);

    if (msg.user_id !== message.user_id || !msg.isChained || msg.isSystemMsg) return;

    await pool.query(`
      UPDATE messages SET type = ? WHERE id = ?
    `, [MessageType.Normal, msg.id]);

    console.info(`Unchained message #${msg.id}`);

    msg.isChained = false;
    return msg;
  }
}

export {MessageDBHandler};