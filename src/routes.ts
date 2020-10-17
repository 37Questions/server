import express = require("express");
import SocketIO from "socket.io";
import db from "./db/db";
import {Constants} from "./helpers";
import {Icon, User, UserState} from "./struct/user";
import {Room, RoomState} from "./struct/room";

function setupRoutes(app: express.Application, io: SocketIO.Server) {
  app.get("/status", (req, res) => {
    res.send({status: "ok"})
  });

  app.get("/icons", (req, res) => {
    let maxIcons = 16;
    if (maxIcons > Constants.Icons.length) maxIcons = Constants.Icons.length;

    let icons = [];

    while (icons.length < maxIcons) {
      let icon = Constants.Icons[Math.floor(Math.random() * Constants.Icons.length)];
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

    db.users.get(user.id, false).then(async (oldUser) => {
      let newUser = await db.users.setup(user, req.body.name, icon);
      res.send({success: true});

      let roomIds = await db.rooms.getActiveIdsFor(newUser.id);
      if (roomIds.length === 0) return;

      let messageBody = "Joined the room";
      let newlyJoined = !oldUser.name && !oldUser.icon;

      if (!newlyJoined) {
        if (!oldUser.name) messageBody = "Changed their icon";
        else if (!oldUser.icon) messageBody = `Changed their username from ${oldUser.name}`;
        else messageBody = "Updated their profile";
      }

      roomIds.forEach((roomId) => {
        db.rooms.get(roomId, newlyJoined).then(async (room) => {
          let newState = undefined;
          if (newlyJoined) {
            let activeUsers = room.getActiveUsers(user.id);
            let roomUser = room.users[user.id];
            if (activeUsers.length == 0) {
              if (room.state === RoomState.PICKING_QUESTION && roomUser.state !== UserState.SELECTING_QUESTION) {
                let questions = await db.questions.getSelectionOptions(room);
                newState = UserState.SELECTING_QUESTION;

                io.to(Room.tag(room.id, user.id)).emit("newQuestionsList", {
                  questions: questions
                });
              } else if (room.state === RoomState.COLLECTING_ANSWERS && roomUser.state !== UserState.ASKING_QUESTION) {
                newState = UserState.ANSWERING_QUESTION;
              }

              if (newState) await db.rooms.setUserState(user.id, room.id, newState);
            }
          }

          let message = await db.messages.create(newUser, room, messageBody, true);

          io.to(room.tag).emit("userUpdated", {
            id: newUser.id,
            name: newUser.name,
            icon: newUser.icon,
            state: newState,
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
    db.users.validate(queryUser).then((valid) => {
      res.send({valid: valid});
    }).catch((err) => {
      res.send({
        valid: false,
        error: err.message
      });
    });
  });

  app.post("/user", (req, res) => {
    db.users.create().then((user) => {
      res.send({
        id: user.id,
        token: user.token
      });
    }).catch((err) => {
      console.warn("Failed to create a new user:", err.message);
      res.send({error: err.message});
    });
  });

  app.get("/rooms", (req, res) => {
    db.rooms.getList().then((rooms) => {
      res.send({rooms: rooms});
    }).catch((err) => {
      console.warn(`Failed to get room list:`, err.message);
      res.send({error: err.message});
    })
  });
}

export {setupRoutes};