import {Room} from "../struct/room";
import {User} from "../struct/user";
import {Question} from "../struct/question";
import pool from "./pool";
import {Answer, AnswerGuess, AnswerState, FavoriteAnswer} from "../struct/answers";
import db from "./db";
import {Util} from "../helpers";

class AnswerDBHandler {
  static async submit(room: Room, question: Question, user: User, answer: string): Promise<void> {
    if (answer.length < 1) throw new Error("Answer too short");

    await pool.query(`
      INSERT INTO answers (roomId, questionId, userId, answer)
      VALUES (?, ?, ?, ?)
    `, [room.id, question.id, user.id, answer]);
  }

  static async get(room: Room, question: Question, user: User): Promise<Answer | null> {
    let res = await pool.query(`
      SELECT id, answer, state, displayPosition FROM answers
      WHERE roomId = ? AND questionId = ? AND userId = ? 
    `, [room.id, question.id, user.id]);

    if (res.length == 0) return null;

    let answer = new Answer(res[0]);
    answer.userId = user.id;

    return answer;
  }

  static async fromPosition(room: Room, question: Question, displayPosition: number, expectedState?: AnswerState): Promise<Answer> {
    let res = await pool.query(`
      SELECT id, userId, answer, state FROM answers
      WHERE roomId = ? AND questionId = ? AND displayPosition = ?
    `, [room.id, question.id, displayPosition]);

    if (res.length < 1) throw new Error("Invalid Answer");

    let answer = new Answer(res[0]);
    answer.displayPosition = displayPosition;

    if (expectedState && answer.state !== expectedState) throw new Error("Unexpected answer state");
    return answer;
  }

  static async getAll(room: Room, question: Question, withGuesses = false, forSort = false): Promise<Answer[]> {
    let res = await pool.query(`
      SELECT ans.id, ans.userId, ans.answer, ans.state, ans.displayPosition
      ${withGuesses ? `,
        GROUP_CONCAT(
          DISTINCT CONCAT(guesses.userId, ':', guesses.guessedUserId) 
          SEPARATOR ','
        ) AS guesses
      ` : ""}
      FROM answers ans
      ${withGuesses ? `LEFT JOIN answerGuesses guesses ON ans.roomId = guesses.roomId AND ans.questionId = guesses.questionId AND ans.id = guesses.answerId` : ""}
      WHERE ans.roomId = ? AND ans.questionId = ? AND ${forSort ? `ans.userId IN (
        SELECT users.userId FROM roomUsers users WHERE users.roomId = ? AND users.active = TRUE
      )` : `ans.displayPosition IS NOT NULL`}
      ${withGuesses ? "GROUP BY ans.id" : ""}
      ORDER BY ${forSort ? "RAND()" : "ans.displayPosition"}
    `, [room.id, question.id, room.id]);

    let answers: Answer[] = [];

    res.forEach((a: any) => {
      let answer = new Answer(a);

      if (withGuesses && a.guesses) {
        let guessesData = a.guesses.split(",");

        for (let g = 0; g < guessesData.length; g++) {
          let guessData = guessesData[g].split(":");
          answer.guesses.push(new AnswerGuess({
            userId: Util.parseId(guessData[0]),
            guessedUserId: Util.parseId(guessData[1])
          } as AnswerGuess));
        }
      }

      answers.push(answer)
    });

    return answers;
  }

  static async shuffle(room: Room, question: Question): Promise<Answer[]> {
    let answers = await this.getAll(room, question, false, true);

    for (let pos = 0; pos < answers.length; pos++) {
      let answer = answers[pos];
      await pool.query(`
        UPDATE answers SET displayPosition = ?
        WHERE roomId = ? AND questionId = ? AND userId = ?
      `, [pos, room.id, question.id, answer.userId]);
      answer.displayPosition = pos;
    }

    return answers;
  }

  static async reveal(room: Room, question: Question, displayPosition: number): Promise<Answer> {
    let answer = await this.fromPosition(room, question, displayPosition, AnswerState.SUBMITTED);

    await pool.query(`
      UPDATE answers SET state = ?
      WHERE id = ?
    `, [AnswerState.REVEALED, answer.id]);

    answer.state = AnswerState.REVEALED;
    answer.strip();

    return answer;
  }

  static async clearFavorite(room: Room, question: Question): Promise<boolean> {
    await pool.query(`
      UPDATE answers SET state = ?
      WHERE roomId = ? AND questionId = ? AND state = ?
    `, [AnswerState.REVEALED, room.id, question.id, AnswerState.FAVORITE]);

    return true;
  }

  static async setFavorite(room: Room, question: Question, answer: Answer): Promise<Answer> {
    await this.clearFavorite(room, question);

    await pool.query(`
      UPDATE answers SET state = ?
      WHERE id = ?
    `, [AnswerState.FAVORITE, answer.id]);

    answer.state = AnswerState.FAVORITE;
    answer.strip();

    return answer;
  }

  static async getPersonalFavorite(room: Room, question: Question, user: User): Promise<FavoriteAnswer | null> {
    let res = await pool.query(`
      SELECT displayPosition FROM favoriteAnswers
      WHERE roomId = ? AND questionId = ? AND userId = ?
    `, [room.id, question.id, user.id]);

    if (res.length < 1) return null;

    return new FavoriteAnswer({
      userId: user.id,
      displayPosition: res[0].displayPosition
    } as FavoriteAnswer);
  }

  static async setPersonalFavorite(room: Room, question: Question, user: User, answer: Answer): Promise<Answer> {
    let existingFavorite = await this.getPersonalFavorite(room, question, user);

    if (existingFavorite) {
      if (existingFavorite.displayPosition === answer.displayPosition) return answer;

      await pool.query(`
        UPDATE favoriteAnswers SET displayPosition = ?
        WHERE roomId = ? AND questionId = ? AND userId = ?
      `, [answer.displayPosition, room.id, question.id, user.id]);

    } else {
      await pool.query(`
        INSERT INTO favoriteAnswers (roomId, questionId, userId, displayPosition) 
        VALUES (?, ?, ?, ?)
      `, [room.id, question.id, user.id, answer.displayPosition]);
    }
    return answer;
  }

  static async clearPersonalFavorite(room: Room, question: Question, user: User): Promise<void> {
    await pool.query(`
      DELETE FROM favoriteAnswers WHERE roomId = ? AND questionId = ? AND userId = ?
    `, [room.id, question.id, user.id]);
  }

  static async getFavorites(room: Room, question: Question, strip = false): Promise<FavoriteAnswer[]> {
    let res = await pool.query(`
      SELECT userId, displayPosition
      FROM favoriteAnswers
      WHERE roomId = ? AND questionId = ?
    `, [room.id, question.id]);

    let favorites: FavoriteAnswer[] = [];

    for (let i = 0; i < res.length; i++) {
      let favorite = new FavoriteAnswer(res[i]);
      if (strip) favorite.strip();
      favorites.push(favorite);
    }

    return favorites;
  }

  static async getGuesses(room: Room, question: Question, answer: Answer, strip = false): Promise<AnswerGuess[]> {
    let res = await pool.query(`
      SELECT userId, guessedUserId
      FROM answerGuesses
      WHERE roomId = ? AND questionId = ? answerId = ?
    `, [room.id, question.id, answer.id]);

    let guesses: AnswerGuess[] = [];

    for (let i = 0; i < res.length; i++) {
      let guess = new AnswerGuess(res[i]);
      if (strip) guess.strip();
      guesses.push(guess);
    }

    return guesses;
  }

  static async getGuessedAnswerId(room: Room, question: Question, user: User, guessedUser: User): Promise<number> {
    let res = await pool.query(`
      SELECT answerId
      FROM answerGuesses
      WHERE roomId = ? AND questionId = ? AND userId = ? AND guessedUserId = ?
    `, [room.id, question.id, user.id, guessedUser.id]);

    if (res.length < 1) return -1;
    return res[0].answerId;
  }

  static async makeGuess(room: Room, question: Question, user: User, answer: Answer, guessedUser: User): Promise<void> {
    if (guessedUser.id === user.id) throw new Error("Guesses must be for other players");

    let existingGuess = await this.getGuessedAnswerId(room, question, user, guessedUser);

    if (existingGuess === answer.id) return;

    await pool.query(`
      DELETE FROM answerGuesses
      WHERE roomId = ? AND questionId = ? AND userId = ? AND answerId = ?
    `, [room.id, question.id, user.id, answer.id]);

    if (existingGuess >= 0) {
      await pool.query(`
        UPDATE answerGuesses
        SET answerId = ?
        WHERE roomId = ? AND questionId = ? AND userId = ? AND guessedUserId = ?
      `, [answer.id, room.id, question.id, user.id, guessedUser.id]);
    } else {
      await pool.query(`
        INSERT INTO answerGuesses (roomId, questionId, userId, guessedUserId, answerId)
        VALUES (?, ?, ?, ?, ?)
      `, [room.id, question.id, user.id, guessedUser.id, answer.id]);
    }
  }
}


export {AnswerDBHandler};