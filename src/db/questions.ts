import {Room} from "../struct/room";
import {Question, QuestionState} from "../struct/question";
import pool from "./pool";

class QuestionsDBHandler {
  static async getSelectionOptions(room: Room): Promise<Question[]> {
    let usingExisting = true;
    let res = await pool.query(`
      SELECT * from questions
      WHERE ID IN (
        SELECT question_id
        FROM roomQuestions
        WHERE room_id = ? AND state = ?
      )
    `, [room.id, QuestionState.SELECTION_OPTION]);

    if (res.length < 1) {
      usingExisting = false;
      res = await pool.query(`
        SELECT * FROM questions 
        WHERE id NOT IN (
          SELECT question_id 
          FROM roomQuestions 
          WHERE room_id = ?
        )
        ORDER BY RAND()
        LIMIT 3
      `, [room.id]);
    }

    // TODO: handle running out of questions
    if (res.length < 1) throw new Error("No questions left!");

    let questions: Question[] = [];
    let sql = [];

    for (let q = 0; q < res.length; q++) {
      let row = res[q];

      questions.push(new Question(row.id, row.question));
      sql.push(`(${room.id}, ${row.id})`);
    }

    if (!usingExisting) {
      await pool.query(`INSERT INTO roomQuestions (room_id, question_id) VALUES ${sql.join(",")}`, []);
    }

    return questions;
  }
}

export {QuestionsDBHandler};