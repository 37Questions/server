import express = require("express");
import sio = require("socket.io");
import redis = require("socket.io-redis");
import db from "./db";

const app: express.Application = express();
app.set("port", process.env.PORT || 3000);

const http = require("http").createServer(app);
const io = sio(http, {origins: "*:*"});

io.adapter(redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT as string) || 6379,
  auth_pass: process.env.REDIS_PASS
}));

app.get("/status", (req, res) => {
  res.send({status: "ok"})
});

app.get("/question", (req, res) => {
  db.getQuestion((err, question) => {
    if (err || !question) {
      return res.send({error: err});
    }
    res.send({
      id: question.id,
      question: question.question,
    });
  });
});

io.on("connection", (socket) => {
  console.info("Received Socket Connection!");
  socket.emit("init", {
    hello: true
  });
});

const server = http.listen(process.env.PORT || 3000, () => {
  console.log("Listening on port %d.", server.address().port);
});