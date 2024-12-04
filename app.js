const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const pool = require("./db.js");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const redisClient = require("./redis.js");

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const io = new Server(server);

//! Secret Key for JWT
const JWT_SECRET = "a2F5wqTh9X$mN7!zQ3pL6jR#kG4bS9fU2hJ5";

//! Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

//! Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    //? Check if user exists
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Username does not exist" });
    }

    const user = result.rows[0];

    //? Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid Password" });
    }

    //? Generate token
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });

    //? Send JSON response with redirect URL
    res.json({
      token,
      username,
      redirectUrl: `/chat?token=${token}&username=${username}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    //* Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
      [username, hashedPassword]
    );

    //* Generate token
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });

    //* Send JSON response with redirect URL
    res.json({
      token,
      username,
      redirectUrl: `/chat?token=${token}&username=${username}`,
    });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      res.status(400).json({ error: "Username Already Exists" });
    } else {
      res.status(500).json({ error: "Server error" });
    }
  }
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

//! Handle Socket.IO connections
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  //? Handle room joining
  socket.on("joinRoom", async (room) => {
    const previousRoom = [...socket.rooms][1]; // Get the first room besides the socket's own room
    if (previousRoom) {
      socket.leave(previousRoom);
      console.log(`User ${socket.id} left room: ${previousRoom}`);
    }

    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);

    //? Fetch previous messages from Redis
    const messageKey = `room:${room}:messages`;
    try {
      //? Get messages from Redis, limiting to the last 10 messages
      const messages = await redisClient.lRange(messageKey, 0, 9); // 0 to 9 to get last 10 messages
      const parsedMessages = messages.map((msg) => JSON.parse(msg)); // Parse each message

      //? Send the previous messages back to the client
      socket.emit("previousMessages", parsedMessages);
    } catch (err) {
      console.error("Error fetching previous messages from Redis:", err);
    }

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

      //? Save Messages to Redis
      const messageKey = `room:${room}:messages`;
      const userMessage = { username, message, timestamp: Date.now() };

      //? Store the message in Redis
      await redisClient.rPush(messageKey, JSON.stringify(userMessage));
      console.log(`Message stored in Redis under key: ${messageKey}`);

      //? Broadcast message to the room
      io.to(room).emit("message", `${username}: ${message}`);
    } catch (err) {
      console.error("Invalid token:", err.message);
      socket.emit("error", "Authentication failed.");
    }
  });

  //? Handle user disconnection
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

//! Start server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
