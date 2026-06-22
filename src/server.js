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

// Body parsing for HTML form submissions (used by CRUD routes).
app.use(express.urlencoded({ extended: true }));

// Static assets (CSS).
app.use(express.static(path.join(__dirname, "..", "public")));

// Landing page.
app.get("/", (req, res) => {
  res.render("index", { title: "Fantasy League (RiNBP)" });
});

// Domain routes.
app.use("/players", require("./routes/players"));
app.use("/teams", require("./routes/teams"));
app.use("/stats", require("./routes/stats"));
// More routes (leagues, transfers) are mounted in later phases.

// Basic error handler so route failures return a readable 500.
app.use((err, req, res, next) => {
  console.error("[error]", err);
  res.status(500).send("Internal error: " + err.message);
});

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
