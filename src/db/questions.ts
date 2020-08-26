import {Room} from "../struct/room";
import {Question, QuestionState} from "../struct/question";
import pool from "./pool";
import {Util} from "../helpers";
import {User} from "../struct/user";
import {Answer, AnswerState} from "../struct/answers";

class QuestionDBHandler {
  static async get(id: number | string): Promise<Question> {
    let res = await pool.query(`SELECT * FROM questions WHERE id = ?`, [Util.parseId(id)]);
    if (res.length < 1) throw new Error("Invalid Question");

    let row = res[0];
    return new Question(row.id, row.question);
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

    await pool.query(`
      DELETE FROM roomQuestions 
      WHERE roomId = ? AND state = ?
     `, [room.id, QuestionState.SELECTION_OPTION]);

    return true;
  }

  static async submitAnswer(room: Room, user: User, question: Question, answer: string): Promise<void> {
    if (answer.length < 1) throw new Error("Answer too short");

    await pool.query(`
      INSERT INTO roomAnswers (roomId, userId, questionId, answer)
      VALUES (?, ?, ?, ?)
    `, [room.id, user.id, question.id, answer]);
  }

  static async getAnswer(room: Room, user: User, question: Question): Promise<Answer | null> {
    let res = await pool.query(`
      SELECT userId, answer, state, displayPosition, userIdGuess FROM roomAnswers
      WHERE roomId = ? AND userId = ? AND questionId = ?
    `, [room.id, user.id, question.id]);

    if (res.length == 0) return null;
    return new Answer(res[0]);
  }

  static async getAnswers(room: Room, question: Question, forSort = false): Promise<Answer[]> {
    let res = await pool.query(`
      SELECT userId, answer, state, displayPosition, userIdGuess FROM roomAnswers
      WHERE roomId = ? AND questionId = ? AND ${forSort ? `userId IN (
        SELECT userId FROM roomUsers WHERE roomId = ? AND active = TRUE
      )` : `displayPosition IS NOT NULL`}
      ORDER BY ${forSort ? "RAND()" : "displayPosition"}
    `, [room.id, question.id, room.id]);

    let answers: Answer[] = [];

    res.forEach((answer: any) => answers.push(new Answer(answer)));

    return answers;
  }

  static async reorderAnswers(room: Room, question: Question): Promise<Answer[]> {
    let answers = await this.getAnswers(room, question, true);

    for (let pos = 0; pos < answers.length; pos++) {
      let answer = answers[pos];
      await pool.query(`
        UPDATE roomAnswers SET displayPosition = ?
        WHERE roomId = ? AND questionId = ? AND userId = ?
      `, [pos, room.id, question.id, answer.userId]);
      answer.displayPosition = pos;
    }

    return answers;
  }

  static async revealAnswer(room: Room, question: Question, displayPosition: number): Promise<Answer> {
    let res = await pool.query(`
      SELECT userId, answer, state, displayPosition, userIdGuess FROM roomAnswers
      WHERE roomId = ? AND questionId = ? AND state = ? AND displayPosition = ?
    `, [room.id, question.id, AnswerState.SUBMITTED, displayPosition]);
    if (res.length < 1) throw new Error("Invalid Answer");

    let answer = new Answer(res[0]);
    answer.state = AnswerState.REVEALED;

    await pool.query(`
      UPDATE roomAnswers SET state = ?
      WHERE roomId = ? AND questionId = ? AND userId = ?
    `, [AnswerState.REVEALED, room.id, question.id, answer.userId]);

    answer.strip();
    return answer;
  }

  static async clearFavorite(room: Room, question: Question): Promise<boolean> {
    await pool.query(`
      UPDATE roomAnswers SET state = ?
      WHERE roomId = ? AND questionId = ? AND state = ?
    `, [AnswerState.REVEALED, room.id, question.id, AnswerState.FAVORITE]);

    return true;
  }

  static async setFavorite(room: Room, question: Question, displayPosition: number): Promise<boolean> {
    let res = await pool.query(`
      SELECT state FROM roomAnswers
      WHERE roomId = ? AND questionId = ? AND state = ? AND displayPosition = ?
    `, [room.id, question.id, AnswerState.REVEALED, displayPosition]);

    if (res.length < 1) throw new Error("Invalid Answer");

    await this.clearFavorite(room, question);

    res = await pool.query(`
      UPDATE roomAnswers SET state = ?
      WHERE roomId = ? AND questionId = ? AND state = ? AND displayPosition = ?
    `, [AnswerState.FAVORITE, room.id, question.id, AnswerState.REVEALED, displayPosition]);

    return res.affectedRows > 0;
  }
}

export {QuestionDBHandler};