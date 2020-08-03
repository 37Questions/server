import express = require("express");
import mysql = require("mysql");

const app: express.Application = express();
app.set("port", process.env.PORT || 3000);
app.use(express.json());

const http = require("http").createServer(app);

const pool = mysql.createPool({
  host: process.env.RDS_HOSTNAME,
  port: parseInt(process.env.RDS_PORT as string),
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE
});

class Question {
  id: number;
  question: string;

  constructor(id: number, question: string) {
    this.id = id;
    this.question = question;
  }
}

function getQuestion(fn: (err?: string, question?: Question) => void): void {
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

app.get("/status", (req, res) => {
  res.send({
    status: "ok"
  })
});

app.get("/question", (req, res) => {
  getQuestion((err, question) => {
    if (err || !question) {
      return res.send({error: err});
    }
    res.send({
      id: question.id,
      question: question.question,
    });
  });
})

const server = http.listen(process.env.PORT || 3000, () => {
  console.log("Listening on port %d.", server.address().port);
});