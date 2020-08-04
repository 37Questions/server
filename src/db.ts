import mysql = require("mysql");
import Question from "./struct/question";
import {Util} from "./helpers";
import {User} from "./struct/user";

const pool = mysql.createPool({
  host: process.env.RDS_HOSTNAME || "localhost",
  port: parseInt(process.env.RDS_PORT as string) || 3306,
  user: process.env.RDS_USERNAME || "questions",
  password: process.env.RDS_PASSWORD || "password",
  database: process.env.RDS_DATABASE || "questions_game"
});

class Database {
  createUser(fn: (err?: string, user?: User) => void): void {
    let token = Util.makeHash(8);
    pool.query(`
      INSERT INTO users (token) VALUES (?);
    `, [token], (err, res) => {
      if (err || res.affectedRows == 0) {
        console.warn("Failed to create user:", err);
        return fn("MySQL Error");
      }

      let user = new User({
        id: res.insertId,
        token: token
      });

      console.info(`Created user #${user.id} with token #${user.token}`);
      return fn(undefined, user);
    });
  }
}

const db = new Database();
export default db;