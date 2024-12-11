const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const pool = require("./db.js");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const redisClient = require("./redis.js");
const multer = require("multer");
const AWS = require("aws-sdk");
require("dotenv").config();

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const io = new Server(server);

//! Secret Key for JWT
const JWT_SECRET = "a2F5wqTh9X$mN7!zQ3pL6jR#kG4bS9fU2hJ5";

//! AWS S3 Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

//! Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

//! Multer Setup (for file uploads)
const storage = multer.memoryStorage(); //? Store file in memory temporarily
const upload = multer({ storage });

//! Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Username does not exist" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid Password" });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
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
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [
      username,
      hashedPassword,
    ]);

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
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

//! Handle file upload and generate signed URL for access
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileKey = `chat-files/${Date.now()}-${req.file.originalname}`;

  //! Upload file to S3 (without using ACLs)
  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileKey,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
    Expires: 60 * 5, //* Signed URL expiration time (5 minutes)
  };

  try {
    await s3.upload(uploadParams).promise();

    //! Generate a signed URL for the uploaded file to allow temporary access
    const signedUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
      Expires: 60 * 5, //! URL valid for 5 minutes
    });

    res.json({
      fileUrl: signedUrl, //! Send the signed URL to the client for use in chat
    });
  } catch (err) {
    console.error("Error uploading file:", err);
    res.status(500).json({ error: "Error uploading file to S3" });
  }
});

//! Handle Socket.IO connections
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("chatMessage", async ({ token, room, message, imageUrl }) => {
    if (!token) {
      socket.emit("error", "Authentication token is required.");
      return;
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const username = decoded.username;

      const messageKey = `room:${room}:messages`;
      const userMessage = {
        username,
        message,
        timestamp: Date.now(),
        imageUrl,
      };

      await redisClient.rPush(messageKey, JSON.stringify(userMessage));

      io.to(room).emit("message", {
        username,
        message,
        timestamp: new Date().toISOString(),
        imageUrl,
      });
    } catch (err) {
      console.error("Invalid token:", err.message);
      socket.emit("error", "Authentication failed.");
    }
  });

  socket.on("joinRoom", async (room) => {
    const previousRoom = [...socket.rooms][1];
    if (previousRoom) {
      socket.leave(previousRoom);
      console.log(`User ${socket.id} left room: ${previousRoom}`);
    }

    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);

    const messageKey = `room:${room}:messages`;
    try {
      const messages = await redisClient.lRange(messageKey, 0, -1);
      const parsedMessages = messages.map((msg) => JSON.parse(msg));

      socket.emit("previousMessages", parsedMessages);
    } catch (err) {
      console.error("Error fetching messages from Redis:", err);
    }

    socket.emit("message", {
      system: true,
      message: `Welcome to the ${room} room!`,
      timestamp: new Date().toISOString(),
    });

    socket.to(room).emit("message", {
      system: true,
      message: `A new user has joined the ${room} room.`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

//! Start server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
