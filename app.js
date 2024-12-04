const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt");
const pool = require("./db.js");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const redisClient = require("./redis.js");
const { timeStamp } = require("console");

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const io = new Server(server);

//! Secret Key for JWT
const JWT_SECRET = "a2F5wqTh9X$mN7!zQ3pL6jR#kG4bS9fU2hJ5";

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
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
      [username, hashedPassword]
    );

    console.log(`User registered: ${result.rows[0].username}`);

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });

    // Send the redirect to the chat page with the token
    res.redirect(`/chat?token=${token}&username=${username}`);
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      res.status(400).send("Username Already Exists");
    } else {
      res.status(500).send("Server error.");
    }
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if user exists
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (result.rows.length === 0) {
      console.log("Username does not exist.");
      return res.status(400).send("Username does not exist.");
    }
    const user = result.rows[0];

    // Compare hashed passwords
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("Invalid Password");
      return res.status(400).send("Invalid Password.");
    }
    console.log(`User logged in: ${username}`);
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });

    // Send the username to the chat page
    res.redirect(`/chat?token=${token}&username=${username}`);
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
  socket.on("chatMessage", async ({ token, room, message }) => {
    if (!token) {
      console.error("Token missing in chatMessage event");
      socket.emit("error", "Authentication token is required.");
      return;
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const username = decoded.username;

      //Save Messages to Redis
      const messageKey = `room:${room}:messages`;
      const userMessage = { username, message, timestamp: Date.now() };
      await redisClient
        .rPush(messageKey, JSON.stringify(userMessage))
        .then(() => {
          console.log(`Message stored in Redus under key: ${messageKey}`);
        })
        .catch((err) => {
          console.error("Failed to store message in Redis", err.message);
        });

      console.log(`Message to ${room}: ${message}`);

      // Broadcast message to the room
      io.to(room).emit("message", `${username}: ${message}`);
    } catch (err) {
      console.error("Invalid token:", err.message);
      socket.emit("error", "Authenication failed.");
    }
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
