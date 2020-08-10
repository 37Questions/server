import express = require("express");
import SocketIO from "socket.io";
import db from "./db";
import {Icons} from "./helpers";
import {Icon, User} from "./struct/user";

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

    db.getUser(user.id, false).then(async (oldUser) => {
      let newUser = await db.setupUser(user, req.body.name, icon);
      res.send({success: true});

      let roomIds = await db.getActiveRoomsIdsFor(newUser.id);
      if (roomIds.length === 0) return;

      let messageBody = "Joined the room";

      if (oldUser.name || oldUser.icon) {
        if (!oldUser.name) messageBody = "Changed their icon";
        else if (!oldUser.icon) messageBody = `Changed their username from ${oldUser.name}`;
        else messageBody = "Updated their profile";
      }

      roomIds.forEach((roomId) => {
        db.getRoom(roomId).then(async (room) => {
          let message = await db.createMessage(user, room, messageBody, true);

          io.to(room.tag).emit("userUpdated", {
            id: newUser.id,
            name: newUser.name,
            icon: newUser.icon,
            message: message
          });
        }).catch((error) => {
          console.warn(`Failed to broadcast user update to room #${roomId}:`, error.message);
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