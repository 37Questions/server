import mysql = require("mysql");
import secrets from "../aws/secrets";

const DB_CREDENTIALS_SECRET = "rds-db-credentials/cluster-CWMSZREPCU6WFJOGL7PI6AWR6Y/questions";

class Pool {
  pool?: mysql.Pool;

  constructor() {
    secrets.getJson(DB_CREDENTIALS_SECRET).then((credentials) => {
      this.pool = mysql.createPool({
        host: credentials.host,
        port: credentials.port,
        user: credentials.username,
        password: credentials.password,
        database: "questions"
      });
    }).catch((err) => {
      console.warn("Failed to initialize db from secret data:", err.message);
      this.pool = mysql.createPool({
        host: process.env.RDS_HOSTNAME || "localhost",
        port: parseInt(process.env.RDS_PORT as string) || 3306,
        user: process.env.RDS_USERNAME || "questions",
        password: process.env.RDS_PASSWORD || "password",
        database: process.env.RDS_DATABASE || "questions"
      });
    })
  }

  async query(sql: string, values: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.pool) return reject(new Error("Database not initialized!"));
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