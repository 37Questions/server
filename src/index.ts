import express = require("express");
import sio = require("socket.io");
import redis = require("socket.io-redis");
import db from "./db/db";
import {User} from "./struct/user";
import {setupRoutes} from "./routes";
import {onConnection} from "./socket/socket";
import awsHelper from "./aws/helper";
import secrets from "./aws/secrets";

const REDIS_CREDENTIALS_SECRET = "prod/37questions/redis";
const CLIENT_URL = awsHelper.isConnected ? "https://37questions.com" : "http://questions.ddns.net:3001";
const ALLOWED_HEADERS = "Origin, X-Requested-With, X-Forwarded-For,Content-Type, Accept, Host, Upgrade, Connection";
const PORT = process.env.PORT || 3000;

const app: express.Application = express();

app.set("port", PORT);
app.use(express.json());

const http = require("http").createServer(app);
const io = sio(http);

if (awsHelper.isConnected || process.env.REDIS_HOST) {
  secrets.getJson(REDIS_CREDENTIALS_SECRET).then((credentials) => {
    io.adapter(redis({
      host: credentials.host,
      port: credentials.port,
      auth_pass: credentials.password
    }));
  }).catch((err) => {
    console.warn("Failed to connect to aws redis server:", err.message);
    io.adapter(redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT as string) || 6379,
      auth_pass: process.env.REDIS_PASS
    }));
  });
} else {
  console.warn("Redis connection info missing - proceeding in fallback mode");
}

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", CLIENT_URL);
  res.header("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  next();
});

setupRoutes(app, io);

io.origins((origin, callback) => {
  if (origin !== CLIENT_URL) return callback("Invalid origin", false);
  callback(null, true);
});

io.use((socket, next) => {
  db.users.validate(new User(socket.handshake.query, true)).then((valid) => {
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