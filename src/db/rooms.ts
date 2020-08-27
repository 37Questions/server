import {Room, RoomInfo, RoomState, RoomVisibility} from "../struct/room";
import {Constants, Util, Validation} from "../helpers";
import pool from "./pool";
import {User, UserState} from "../struct/user";
import {Message, MessageLike} from "../struct/message";
import db from "./db";

class RoomDBHandler {
  static async create(userId: number, name: string | undefined, visibility: string, votingMethod: string): Promise<Room> {
    if (!Validation.uint(userId)) throw new Error("Invalid User");
    let user = await db.users.get(userId);

    if (!Room.VisibilityOptions.includes(visibility)) throw new Error("Invalid Visibility Setting");
    if (!Room.VotingMethods.includes(votingMethod)) throw new Error("Invalid Voting Method");

    let isPublic = visibility === RoomVisibility.Public;

    let timestamp = Util.unixTimestamp();
    let token = isPublic ? undefined : Util.makeHash(Constants.TokenLength);

    let props = [];
    if (name) props.push(name);

    props.push(timestamp, visibility, votingMethod);
    if (!isPublic) props.push(token);

    let res = await pool.query(`
      INSERT INTO rooms (${name ? "name, " : ""}lastActive, visibility, votingMethod${isPublic ? "" : ", token"})
      VALUES (${name ? "?, " : ""}?, ?, ?${isPublic ? "" : ", ?"})
    `, props);

    let roomId = res.insertId;

    return this.addUser(userId, roomId, UserState.SELECTING_QUESTION).then(() => {
      user.active = true;
      user.state = UserState.SELECTING_QUESTION;
      user.score = 0;

      let room = new Room({
        id: roomId,
        name: name,
        lastActive: timestamp,
        visibility: visibility,
        votingMethod: votingMethod,
        token: token,
        state: RoomState.PICKING_QUESTION,
        users: {
          [user.id]: user
        }
      } as Room);

      return db.messages.create(user, room, "Created the room", true).then((message) => {
        room.messages = {[message.id]: message};
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

  static async get(id: number | string, withUsers = false, withExtras = false): Promise<Room> {
    let res = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [Util.parseId(id)]);

    if (res.length < 1) throw new Error("Invalid Room ID");
    let room = new Room(res[0]);

    if (withUsers) {
      let users = await pool.query(`
        SELECT * FROM roomUsers
        INNER JOIN users ON roomUsers.userId = users.id
        WHERE roomUsers.roomId = ?
      `, [room.id]);

      room.users = {};

      for (let i = 0; i < users.length; i++) {
        let user = new User(users[i]);
        room.users[user.id] = user;
      }
    }

    if (withExtras) {
      let messages = await pool.query(`
        SELECT 
          msg.id, msg.createdAt, msg.userId, 
          msg.body, msg.type, 
          GROUP_CONCAT(
            DISTINCT CONCAT(likes.userId, ':', likes.since) 
            SEPARATOR ','
          ) AS likes
        FROM messages msg
        LEFT JOIN messageLikes likes ON msg.id = likes.messageId
        WHERE msg.roomId = ?
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
              userId: likeData[0],
              since: likeData[1]
            });
          }
        }
        room.messages[row.id] = new Message({
          id: row.id,
          createdAt: row.createdAt,
          userId: row.userId,
          body: row.body,
          type: row.type,
          likes: likes
        });
        if (msg === messages.length - 1) room.messages[row.id].isChained = false;
      }

      if (room.state !== RoomState.PICKING_QUESTION) {
        let question = await db.questions.getSelected(room);
        if (question) {
          room.questions = [question];

          if (room.state === RoomState.READING_ANSWERS) {
            let answers = await db.answers.getAll(room, question, true);
            answers.forEach((answer) => answer.strip());

            room.answers = answers;

            let roomFavorites = await db.answers.getFavorites(room, question, true);
            let favorites: number[] = [];

            roomFavorites.forEach((favorite) => favorites.push(favorite.displayPosition));
            room.favoriteAnswers = favorites;
          }
        }
      }
    }
    return room;
  }

  static async getList(): Promise<RoomInfo[]> {
    let res = await pool.query(`
      SELECT * FROM rooms WHERE visibility = ?
      LIMIT 15
    `, [RoomVisibility.Public]);

    let rooms: RoomInfo[] = [];

    for (let i = 0; i < res.length; i++) {
      let row = res[i];

      let users = await pool.query(`
        SELECT active FROM roomUsers WHERE roomId = ?
      `, [row.id]);

      let activeUsers = 0;
      users.forEach((user: any) => {
        if (user.active) activeUsers++;
      });

      let lastMessage = await pool.query(`
        SELECT createdAt, body FROM messages WHERE roomId = ? ORDER BY id DESC LIMIT 1
      `, [row.id]);

      let lastActive = row.lastActive;

      if (lastMessage.length > 0) {
        let lastMessageAt = lastMessage[0].createdAt;
        if (lastMessageAt > lastActive) lastActive = lastMessageAt;
      }

      rooms.push(new RoomInfo({
        id: row.id,
        name: row.name,
        lastActive: lastActive,
        visibility: RoomVisibility.Public,
        votingMethod: row.votingMethod,
        players:  users.length,
        activePlayers: activeUsers
      }));
    }

    rooms.sort((a, b) => {
      return b.lastActive - a.lastActive;
    });

    return rooms;
  }

  static async setState(room: Room, state: RoomState): Promise<boolean> {
    let res = await pool.query(`
      UPDATE rooms
      SET state = ?
      WHERE id = ?
    `, [state, room.id]);

    return res.affectedRows > 0;
  }

  static async getUser(id: number | string, roomId: number | string, withToken = false): Promise<User> {
    id = Util.parseId(id);
    roomId = Util.parseId(roomId);

    let res = await pool.query(`
      SELECT * FROM roomUsers
      INNER JOIN users ON roomUsers.userId = users.id
      WHERE roomUsers.userId = ? AND roomUsers.roomId = ?
    `, [id, roomId]);

    if (res.length < 1) throw new Error("Invalid Room or User");
    return new User(res[0], withToken);
  }

  static async setUserActive(userId: number | string, roomId: number | string, active: boolean, state = UserState.IDLE): Promise<boolean> {
    userId = Util.parseId(userId);
    roomId = Util.parseId(roomId);

    let res = await pool.query(`
      UPDATE roomUsers 
      SET active = ?, state = ? 
      WHERE userId = ? AND roomId = ?
    `, [active, state, userId, roomId]);
    return res.affectedRows > 0;
  }

  static async resetRound(room: Room): Promise<void> {
    // TODO: randomly select question in democratic mode
    await this.setState(room, RoomState.PICKING_QUESTION);
    await db.questions.clearFromRoom(room);

    await pool.query(`
      UPDATE roomUsers
      SET state = ?
      WHERE roomId = ?
    `, [UserState.IDLE, room.id]);
  }

  static async startCollectingAnswers(room: Room): Promise<void> {
    await this.setState(room, RoomState.COLLECTING_ANSWERS);
    await pool.query(`
      UPDATE roomUsers
      SET state = ?
      WHERE roomId = ?
    `, [UserState.ANSWERING_QUESTION, room.id]);
  }

  static async setUserState(userId: number | string, roomId: number | string, state: UserState): Promise<boolean> {
    userId = Util.parseId(userId);
    roomId = Util.parseId(roomId);

    let res = await pool.query(`
      UPDATE roomUsers
      SET state = ?
      WHERE userId = ? AND roomId = ?
    `, [state, userId, roomId]);

    return res.affectedRows > 0;
  }

  static async getActiveIdsFor(userId: number | string): Promise<number[]> {
    userId = Util.parseId(userId);

    let rooms = await pool.query(`
      SELECT roomId from roomUsers where userId = ? AND active = true
    `, [userId]);

    let roomIds: number[] = [];

    for (let room = 0; room < rooms.length; room++) {
      roomIds.push(rooms[room].roomId);
    }

    return roomIds;
  }

  static async addUser(userId: number, roomId: number, state = UserState.IDLE) {
    return pool.query(`
      INSERT INTO roomUsers (userId, roomId, state) VALUES (?, ?, ?)
    `, [userId, roomId, state]);
  }
}

export {RoomDBHandler};