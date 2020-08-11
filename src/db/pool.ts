import mysql = require("mysql");

class Pool {
  pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.RDS_HOSTNAME || "localhost",
      port: parseInt(process.env.RDS_PORT as string) || 3306,
      user: process.env.RDS_USERNAME || "questions",
      password: process.env.RDS_PASSWORD || "password",
      database: process.env.RDS_DATABASE || "questions_game"
    });
  }

  async query(sql: string, values: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.pool.query(sql, values, (err, res) => {
        if (err) {
          console.warn("Failed to execute query:", sql, err);
          return reject("MySQL Error");
        }
        resolve(res);
      });
    });
  }
}

const pool = new Pool();
export default pool;