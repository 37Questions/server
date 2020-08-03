import mysql = require("mysql");
import Question from "./struct/question";

const pool = mysql.createPool({
  host: process.env.RDS_HOSTNAME,
  port: parseInt(process.env.RDS_PORT as string) || 3306,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE
});

class Database {
  getQuestion(fn: (err?: string, question?: Question) => void): void {
    pool.query(`
      SELECT id, question
      FROM questions
      ORDER BY RAND()
      LIMIT 1;
  `, (err, rows) => {
      if (err) {
        console.warn("Failed to get question:", err.stack);
        return fn("MySQL Error");
      } else if (rows.length == 0) {
        return fn("No Questions Left");
      }
      const row = rows[0];
      return fn(undefined, new Question(row.id, row.question));
    });
  }
}

const db = new Database();
export default db;