// CRUD routes for the `fantasyTeams` collection.
// Shows working with embedded player snapshots (denormalization): adding/removing
// a player mutates the embedded `players[]` array and the denormalized `spent`.
const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");

const router = express.Router();

// READ: list all teams.
router.get("/", async (req, res, next) => {
  try {
    const teams = await getDb()
      .collection("fantasyTeams")
      .find({})
      .sort({ totalPoints: -1 })
      .toArray();
    res.render("teams/list", { title: "Fantasy teams", teams });
  } catch (err) {
    next(err);
  }
});

// CREATE form: needs users and leagues to reference.
router.get("/new", async (req, res, next) => {
  try {
    const db = getDb();
    const [users, leagues] = await Promise.all([
      db.collection("users").find({}).toArray(),
      db.collection("leagues").find({}).toArray(),
    ]);
    res.render("teams/form", { title: "New team", users, leagues });
  } catch (err) {
    next(err);
  }
});

// CREATE: insert an empty team (squad filled later via add-player).
router.post("/", async (req, res, next) => {
  try {
    const team = {
      userId: new ObjectId(req.body.userId),
      leagueId: new ObjectId(req.body.leagueId),
      name: (req.body.name || "").trim(),
      budget: parseFloat(req.body.budget) || 100.0,
      spent: 0,
      totalPoints: 0,
      players: [], // embedded snapshots, added later
    };
    const { insertedId } = await getDb().collection("fantasyTeams").insertOne(team);
    res.redirect(`/teams/${insertedId}`);
  } catch (err) {
    next(err);
  }
});

// READ one: team detail + form to add an available player.
router.get("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const team = await db
      .collection("fantasyTeams")
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!team) return res.status(404).send("Team not found");

    // Offer only players that are available and not already in the squad.
    const ownedIds = team.players.map((p) => p.playerId);
    const candidates = await db
      .collection("players")
      .find({ available: true, _id: { $nin: ownedIds } })
      .sort({ position: 1, price: -1 })
      .toArray();

    res.render("teams/detail", { title: team.name, team, candidates });
  } catch (err) {
    next(err);
  }
});

// ADD player: push an embedded snapshot and bump `spent` (denormalized).
router.post("/:id/players", async (req, res, next) => {
  try {
    const db = getDb();
    const teamId = new ObjectId(req.params.id);
    const player = await db
      .collection("players")
      .findOne({ _id: new ObjectId(req.body.playerId) });
    if (!player) return res.status(404).send("Player not found");

    const snapshot = {
      playerId: player._id,
      name: player.name,
      position: player.position,
      buyPrice: player.price, // price captured at purchase time
    };
    await db.collection("fantasyTeams").updateOne(
      { _id: teamId },
      { $push: { players: snapshot }, $inc: { spent: snapshot.buyPrice } }
    );
    res.redirect(`/teams/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// REMOVE player: pull the snapshot and reduce `spent` by its stored buyPrice.
router.post("/:id/players/:playerId/delete", async (req, res, next) => {
  try {
    const db = getDb();
    const teamId = new ObjectId(req.params.id);
    const playerId = new ObjectId(req.params.playerId);

    const team = await db.collection("fantasyTeams").findOne({ _id: teamId });
    if (!team) return res.status(404).send("Team not found");
    const snap = team.players.find((p) => p.playerId.equals(playerId));
    if (!snap) return res.redirect(`/teams/${req.params.id}`);

    await db.collection("fantasyTeams").updateOne(
      { _id: teamId },
      { $pull: { players: { playerId } }, $inc: { spent: -snap.buyPrice } }
    );
    res.redirect(`/teams/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// DELETE team.
router.post("/:id/delete", async (req, res, next) => {
  try {
    await getDb().collection("fantasyTeams").deleteOne({ _id: new ObjectId(req.params.id) });
    res.redirect("/teams");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
