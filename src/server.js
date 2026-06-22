// Express application entry point.
// Thin web layer over MongoDB: connects to the database, then starts the HTTP
// server. Domain routes are mounted here as they are added in later phases.
require("dotenv").config();
const path = require("path");
const express = require("express");
const { connect } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// View engine: EJS, templates in src/views.
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Body parsing for HTML form submissions (used by CRUD routes later).
app.use(express.urlencoded({ extended: true }));

// Landing page.
app.get("/", (req, res) => {
  res.render("index", { title: "Fantasy League (RiNBP)" });
});

// Routes per domain are mounted here (players, teams, leagues, transfers, stats).
// Added in later phases.

// Start: connect to MongoDB first, then listen.
async function start() {
  await connect();
  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
