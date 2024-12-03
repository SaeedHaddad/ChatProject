const { Pool } = require("pg");

//! PostgreSQL Configuration
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "chat_app",
  password: "12345678",
  port: 5432,
});

module.exports = pool;
