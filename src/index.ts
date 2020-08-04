import express = require("express");
import sio = require("socket.io");
import redis = require("socket.io-redis");
import db from "./db";

const app: express.Application = express();
app.set("port", process.env.PORT || 3000);

const http = require("http").createServer(app);
const io = sio(http, {origins: "*:*"});

if (process.env.REDIS_HOST) {
  io.adapter(redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT as string) || 6379,
    auth_pass: process.env.REDIS_PASS
  }));
} else {
  console.warn("Redis connection info missing - proceeding in fallback mode");
}

app.get("/status", (req, res) => {
  res.send({status: "ok"})
});

io.on("connection", (socket) => {
  console.info("Received Socket Connection!");

  db.createUser((err, user) => {
    if (err || !user) {
      return console.warn("Failed to create a new user:", err);
    }
    socket.emit("init", {
      user: user
    });
  });
});

const server = http.listen(process.env.PORT || 3000, () => {
  console.log("Listening on port %d.", server.address().port);
});