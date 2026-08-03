const mysql = require("mysql2/promise");
require("dotenv").config();

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function getOptionalPositiveInteger(name, defaultValue) {
  const rawValue = process.env[name];

  if (!rawValue || !rawValue.trim()) {
    return defaultValue;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }

  return parsed;
}

const dbPort = getOptionalPositiveInteger("DB_PORT", 3306);

const pool = mysql.createPool({
  host: getRequiredEnv("DB_HOST"),
  port: dbPort,
  user: getRequiredEnv("DB_USER"),
  password: process.env.DB_PASSWORD ?? "",
  database: getRequiredEnv("DB_NAME"),
  waitForConnections: true,
  connectionLimit: getOptionalPositiveInteger("DB_CONNECTION_LIMIT", 10),
  queueLimit: 0,
  connectTimeout: getOptionalPositiveInteger("DB_CONNECT_TIMEOUT_MS", 10000),
  decimalNumbers: true,
  enableKeepAlive: true
});

async function withConnection(handler) {
  const connection = await pool.getConnection();

  try {
    return await handler(connection);
  } finally {
    connection.release();
  }
}

async function withTransaction(handler) {
  return withConnection(async (connection) => {
    await connection.beginTransaction();

    try {
      const result = await handler(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

module.exports = Object.assign(pool, {
  withConnection,
  withTransaction
});
