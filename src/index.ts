import express = require("express");
import sio = require("socket.io");
import redis = require("socket.io-redis");
import db from "./db";
import {User} from "./struct/user";
import {setupRoutes} from "./routes";
import {onConnection} from "./socket";

const CLIENT_URL = process.env.CLIENT_URL || "http://192.168.0.102:3001";
const PORT = process.env.PORT || 3000;

const app: express.Application = express();

app.set("port", PORT);
app.use(express.json());

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
  res.header("Access-Control-Allow-Origin", CLIENT_URL);
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

setupRoutes(app, io);

io.use((socket, next) => {
  db.validateUser(new User(socket.handshake.query, true)).then((valid) => {
    if (valid) next();
    else next(new Error("Invalid Authentication"));
  }).catch((err) => {
    return next(err);
  });
});


io.on("connection", (socket) => {
  let userId = parseInt(socket.handshake.query.id);
  onConnection(socket, userId);
});

http.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});