const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt");
const pool = require("./db.js");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const io = new Server(server);

//! Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

//! Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    //? Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
      [username, hashedPassword]
    );

    console.log(`User registered: ${result.rows[0].username}`);
    res.status(201).send("User registered successfully!");
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      //? Unique constraint violation
      res.status(400).send("Username Already Exists");
    } else {
      res.status(500).send("Server error.");
    }
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    //? Check if user exists
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (result.rows.length === 0) {
      console.log("Username does not exist.");
      return res.status(400).send("Username does not exist.");
    }
    const user = result.rows[0];

    //? Compare hashed passwords
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("Invalid Password");
      return res.status(400).send("Invalid Password.");
    }
    console.log(`User logged in: ${username}`);
    res.redirect("/chat");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error.");
  }
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

//! Handle Socket.IO connections
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  //? Handle room joining
  socket.on("joinRoom", (room) => {
    const previousRoom = [...socket.rooms][1]; // Get the first room besides the socket's own room
    if (previousRoom) {
      socket.leave(previousRoom);
      console.log(`User ${socket.id} left room: ${previousRoom}`);
    }

    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
    socket.emit("message", `Welcome to the ${room} room!`);
    socket.to(room).emit("message", `A new user has joined the ${room} room.`);
  });

  //? Handle chat messages
  socket.on("chatMessage", ({ room, message }) => {
    console.log(`Message to ${room}: ${message}`);
    io.to(room).emit("message", message); // Broadcast message to the room
  });

  //?Handle user disconnection
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

//! Start server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
