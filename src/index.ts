import express = require("express");
import sio = require("socket.io");
import redis = require("socket.io-redis");
import db from "./db";
import {User} from "./struct/user";
import {Icons} from "./helpers";

const CLIENT_URL = process.env.CLIENT_URL || "http://192.168.0.102:3001";
const PORT = process.env.PORT || 3000;

const app: express.Application = express();
app.set("port", PORT);

const http = require("http").createServer(app);
const io = sio(http, {origins: CLIENT_URL});

if (process.env.REDIS_HOST) {
  io.adapter(redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT as string) || 6379,
    auth_pass: process.env.REDIS_PASS
  }));
} else {
  console.warn("Redis connection info missing - proceeding in fallback mode");
}

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", CLIENT_URL);
  next();
});

app.get("/status", (req, res) => {
  res.send({status: "ok"})
});

app.get("/icons", (req, res) => {
  let maxIcons = 15;
  if (maxIcons > Icons.length) maxIcons = Icons.length;

  let icons = [];

  while (icons.length < maxIcons) {
    let icon = Icons[Math.floor(Math.random() * Icons.length)];
    if (icons.indexOf(icon) != -1) continue;
    icons.push(icon);
  }

  res.send({
    icons: icons
  });
})

app.get("/validate-token", (req, res) => {
  const queryUser = User.fromQuery(req.query);
  db.getUser(queryUser.id).then((user) => {
    if (user.id === queryUser.id && user.token === queryUser.token) {
      res.send({
        valid: true,
        user: user
      });
    } else {
      res.send({
        valid: false,
        error: "Invalid Token"
      });
    }
  }).catch((err) => {
    res.send({
      valid: false,
      error: err.message
    });
  });
});

app.post("/user", (req, res) => {
  db.createUser().then((user) => {
    res.send({
      id: user.id,
      token: user.token
    });
  }).catch((err) => {
    console.warn("Failed to create a new user:", err);
    res.send({
      error: err.message
    });
  });
});

io.use((socket, next) => {
  db.validateUser(User.fromQuery(socket.handshake.query)).then((valid) => {
    if (valid) next();
    else next(new Error("Invalid Authentication"));
  }).catch((err) => {
    return next(err);
  });
});

io.on("connection", (socket) => {
  const user = User.fromQuery(socket.handshake.query);
  console.info(`User ${user.id} connected with token #${user.token}!`);

  socket.emit("init", {
    user: user
  });
});

http.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});