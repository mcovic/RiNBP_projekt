// CRUD routes for the `players` collection.
// Demonstrates create / read / update / delete with the native MongoDB driver.
const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");

const router = express.Router();
const POSITIONS = ["GK", "DEF", "MID", "FWD"];

// Parse the player form body into a typed document.
function parsePlayerBody(body) {
  return {
    name: (body.name || "").trim(),
    position: body.position,
    club: (body.club || "").trim(),
    price: parseFloat(body.price) || 0,
    totalPoints: parseInt(body.totalPoints, 10) || 0,
    stats: {
      goals: parseInt(body.goals, 10) || 0,
      assists: parseInt(body.assists, 10) || 0,
      minutes: parseInt(body.minutes, 10) || 0,
    },
    available: body.available === "on", // checkbox
  };
}

// READ: list all players (newest-priced first for a stable view).
router.get("/", async (req, res, next) => {
  try {
    const players = await getDb()
      .collection("players")
      .find({})
      .sort({ position: 1, price: -1 })
      .toArray();
    res.render("players/list", { title: "Players", players });
  } catch (err) {
    next(err);
  }
});

// CREATE form.
router.get("/new", (req, res) => {
  res.render("players/form", {
    title: "New player",
    positions: POSITIONS,
    player: null, // empty form
  });
});

// CREATE: insert one player.
router.post("/", async (req, res, next) => {
  try {
    await getDb().collection("players").insertOne(parsePlayerBody(req.body));
    res.redirect("/players");
  } catch (err) {
    next(err);
  }
});

// EDIT form.
router.get("/:id/edit", async (req, res, next) => {
  try {
    const player = await getDb()
      .collection("players")
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!player) return res.status(404).send("Player not found");
    res.render("players/form", { title: "Edit player", positions: POSITIONS, player });
  } catch (err) {
    next(err);
  }
});

// UPDATE: replace editable fields of one player.
router.post("/:id", async (req, res, next) => {
  try {
    await getDb()
      .collection("players")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: parsePlayerBody(req.body) });
    res.redirect("/players");
  } catch (err) {
    next(err);
  }
});

// DELETE: remove one player.
router.post("/:id/delete", async (req, res, next) => {
  try {
    await getDb().collection("players").deleteOne({ _id: new ObjectId(req.params.id) });
    res.redirect("/players");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
