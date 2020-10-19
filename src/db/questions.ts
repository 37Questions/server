import {Room} from "../struct/room";
import {Question, QuestionState} from "../struct/question";
import pool from "./pool";
import {Util} from "../helpers";
import db from "./db";

class QuestionDBHandler {
  static async get(id: number | string): Promise<Question> {
    let res = await pool.query(`SELECT * FROM questions WHERE id = ?`, [Util.parseId(id)]);
    if (res.length < 1) throw new Error("Invalid Question");

    let row = res[0];
    return new Question(row.id, row.question);
  }

  static async suggest(userId: number, question: string): Promise<number> {
    if (question.length < Question.MIN_LENGTH) throw new Error("Question must be at least " + Question.MIN_LENGTH + " characters long!");
    else if (question.length > Question.MAX_LENGTH) throw new Error("Question cannot be longer than " + Question.MAX_LENGTH + " characters!");
    let res = await pool.query(`INSERT INTO questionSuggestions (question, userId) VALUES (?, ?)`, [question, userId]);
    return res.insertId;
  }

  static async getFromRoom(room: Room, state: QuestionState): Promise<Question[]> {
    let res = await pool.query(`
      SELECT * FROM questions
      WHERE id IN (
        SELECT questionId
        FROM roomQuestions
        WHERE roomId = ? AND state = ?
      )
    `, [room.id, state]);

    return this.parse(res);
  }

  static async clearFromRoom(room: Room): Promise<void> {
    await pool.query(`
      DELETE FROM roomQuestions WHERE roomId = ? AND state = ?
    `, [room.id, QuestionState.SELECTION_OPTION]);

    await pool.query(`
      UPDATE roomQuestions SET state = ? WHERE state = ? AND roomId = ?
    `, [QuestionState.PLAYED, QuestionState.SELECTED, room.id]);
  }

  static async getSelected(room: Room): Promise<Question | null> {
    let questions = await this.getFromRoom(room, QuestionState.SELECTED);
    if (questions.length < 1) return null;
    return questions[0];
  }

  static parse(rows: Question[]): Question[] {
    let questions: Question[] = [];

    for (let q = 0; q < rows.length; q++) {
      let row = rows[q];

      questions.push(new Question(row.id, row.question));
    }

    return questions;
  }

  static async getSelectionOptions(room: Room): Promise<Question[]> {
    let res = await this.getFromRoom(room, QuestionState.SELECTION_OPTION);
    if (res.length > 0) return res;

    res = await pool.query(`
      SELECT * FROM questions 
      WHERE id NOT IN (
        SELECT questionId 
        FROM roomQuestions 
        WHERE roomId = ?
      )
      ORDER BY RAND()
      LIMIT 3
    `, [room.id]);

    // TODO: handle running out of questions
    if (res.length < 1) throw new Error("No questions left!");

    let questions: Question[] = [];
    let sql = [];

    for (let q = 0; q < res.length; q++) {
      let row = res[q];

      questions.push(new Question(row.id, row.question));
      sql.push(`(${room.id}, ${row.id})`);
    }

    await pool.query(`INSERT INTO roomQuestions (roomId, questionId) VALUES ${sql.join(",")}`, []);

    return questions;
  }

  static async select(question: Question, room: Room): Promise<boolean> {
    let res = await pool.query(`
      UPDATE roomQuestions
      SET state = ?
      WHERE roomId = ? AND questionId = ? AND state = ?
    `, [QuestionState.SELECTED, room.id, question.id, QuestionState.SELECTION_OPTION]);

    if (res.affectedRows < 1) throw new Error("Invalid question choice");

    await db.rooms.markActive(room);
    await pool.query(`
      DELETE FROM roomQuestions 
      WHERE roomId = ? AND state = ?
     `, [room.id, QuestionState.SELECTION_OPTION]);

    return true;
  }
}

export {QuestionDBHandler};