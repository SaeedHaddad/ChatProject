const redis = require("redis");
//! Redis Configuration

const redisClient = redis.createClient({
  url: "redis://localhost:6379",
});
redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.connect().then(() => console.log("Connected to Redis"));

module.exports = redisClient;
