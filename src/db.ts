import mysql = require("mysql");
import {Util, Validation} from "./helpers";
import {User} from "./struct/user";

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
        console.warn("Failed to execute query:", sql, err.stack);
        return reject("MySQL Error");
      }
      resolve(res);
    });
  });
}

const TOKEN_LENGTH = 8;

class Database {
  async createUser(): Promise<User> {
    let token = Util.makeHash(TOKEN_LENGTH);
    return query(`
      INSERT INTO users (token) VALUES (?);
    `, [token]).then((res) => {
      if (res.affectedRows == 0) {
        console.warn("Tried to create a user but no change was made!");
        throw new Error("User Creation Failed");
      }

      let user = new User({
        id: res.insertId,
        token: token
      });

      console.info(`Created user #${user.id} with token #${user.token}`);
      return user;
    });
  }


  async getUser(id: number | string): Promise<User> {
    if (typeof id === "string") id = parseInt(id);
    if (!Validation.uint(id)) throw new Error("Invalid User ID");

    return query(`
      SELECT * FROM users
      WHERE id = ?
    `, [id]).then((res) => {
      if (res.length < 1) {
        throw new Error("Invalid User");
      } else return new User(res[0]);
    });
  }

  async validateUser(user: User): Promise<boolean> {
    if (!user || !Validation.uint(user.id) || !Validation.hash(user.token, TOKEN_LENGTH)) {
      throw new Error("Missing Credentials");
    }

    return query(`
      SELECT token FROM users
      WHERE id = ?
    `, [user.id, user.token]).then((res) => {
      if (res.length < 1) {
        throw new Error("Invalid User");
      } else if (res[0].token != user.token) {
        throw new Error("Invalid Token");
      } else return true;
    });
  }
}

const db = new Database();
export default db;