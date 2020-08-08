import express = require("express");
import db from "./db";
import {Icons} from "./helpers";
import {Icon, User} from "./struct/user";

function setupRoutes(app: express.Application) {
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

    db.setupUser(new User(req.body.user), req.body.name, new Icon(req.body.icon)).then((success) => {
      res.send({success: success});
    }).catch((err) => {
      res.send({error: err.message});
    });
  });

  app.get("/validate-token", (req, res) => {
    let queryUser = new User(req.query);
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
}

export {setupRoutes};