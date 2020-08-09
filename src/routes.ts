import express = require("express");
import SocketIO from "socket.io";
import db from "./db";
import {Icons} from "./helpers";
import {Icon, User} from "./struct/user";
import {Room} from "./struct/room";

function setupRoutes(app: express.Application, io: SocketIO.Server) {
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
  });

  app.post("/setup-acc", (req, res) => {
    if (!req.body.hasOwnProperty("user")) return res.send({error: "Missing Credentials"});
    if (!req.body.hasOwnProperty("icon")) return res.send({error: "Missing Icon Data"});

    let user = new User(req.body.user, true);
    let icon = new Icon(req.body.icon);

    db.setupUser(user, req.body.name, icon).then(async (user) => {
      res.send({success: true});

      let roomIds = await db.getActiveRoomsIdsFor(user.id);

      roomIds.forEach((roomId) => {
        io.to(Room.tag(roomId)).emit("userUpdated", {
          id: user.id,
          name: user.name,
          icon: user.icon
        });
      });
    }).catch((err) => {
      res.send({error: err.message});
    });
  });

  app.get("/validate-token", (req, res) => {
    let queryUser = new User(req.query, true);
    db.validateUser(queryUser).then((valid) => {
      res.send({ valid: valid });
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
      console.warn("Failed to create a new user:", err.message);
      res.send({ error: err.message });
    });
  });
}

export {setupRoutes};