require("dotenv").config();
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.DB_NAME || "fantasy_league";

const client = new MongoClient(uri);

let db = null;

async function connect() {
  if (db) return db;
  await client.connect();
  db = client.db(dbName);
  console.log(`[db] Connected to MongoDB, database: ${dbName}`);
  return db;
}

function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call connect() first.");
  }
  return db;
}

module.exports = { connect, getDb, client };
