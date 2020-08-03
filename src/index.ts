import express = require("express");

const app: express.Application = express();
app.set("port", process.env.PORT || 3000);
app.use(express.json());

const http = require("http").createServer(app);

app.get("/status", (req, res) => {
    res.send({
        status: "ok"
    })
});

const server = http.listen(process.env.PORT || 3000, () => {
    console.log("Listening on port %d.", server.address().port);
});