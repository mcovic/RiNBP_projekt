// MongoDB connection as a singleton.
// Per project convention, all database access goes through this module so the
// app reuses a single MongoClient / Db instance instead of reconnecting.
require("dotenv").config();
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.DB_NAME || "fantasy_league";

const client = new MongoClient(uri);

let db = null;

// Open the connection once and cache the Db handle.
async function connect() {
  if (db) return db;
  await client.connect();
  db = client.db(dbName);
  console.log(`[db] Connected to MongoDB, database: ${dbName}`);
  return db;
}

// Return the already-connected Db; throws if connect() has not run yet.
function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call connect() first.");
  }
  return db;
}

// Expose the client too (needed for sessions/transactions later).
module.exports = { connect, getDb, client };
