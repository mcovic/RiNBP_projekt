const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");

const router = express.Router();
const POSITIONS = ["GK", "DEF", "MID", "FWD"];

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

// ADVANCED SEARCH: filters ($in, $lt, $regex) + projection + sort + pagination.
// The {position:1, price:-1} index backs the position/price filter and sort.
const PAGE_SIZE = 10;

// Walk an explain() winning plan to summarize index usage for the UI hint.
function summarizeExplain(explain) {
  const stages = [];
  let indexName = null;
  (function walk(node) {
    if (!node) return;
    if (node.stage) stages.push(node.stage);
    if (node.indexName) indexName = node.indexName;
    if (node.inputStage) walk(node.inputStage);
    if (Array.isArray(node.inputStages)) node.inputStages.forEach(walk);
  })(explain.queryPlanner && explain.queryPlanner.winningPlan);
  const es = explain.executionStats || {};
  return {
    usedIndex: Boolean(indexName),
    indexName,
    stages: stages.join(" → "),
    nReturned: es.nReturned,
    totalDocsExamined: es.totalDocsExamined,
    totalKeysExamined: es.totalKeysExamined,
  };
}

router.get("/search", async (req, res, next) => {
  try {
    const coll = getDb().collection("players");

    let positions = req.query.position || [];
    if (!Array.isArray(positions)) positions = [positions];
    positions = positions.filter((p) => POSITIONS.includes(p));

    const maxPrice = parseFloat(req.query.maxPrice);
    const name = (req.query.name || "").trim();

    const filter = {};
    if (positions.length) filter.position = { $in: positions }; // $in
    if (!Number.isNaN(maxPrice)) filter.price = { $lt: maxPrice }; // $lt
    if (name) filter.name = { $regex: name, $options: "i" }; // $regex

    const sortField = ["price", "totalPoints", "name"].includes(req.query.sort)
      ? req.query.sort
      : "totalPoints";
    const sortSpec = { [sortField]: sortField === "name" ? 1 : -1 };

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    const projection = { _id: 0, name: 1, position: 1, club: 1, price: 1, totalPoints: 1 };

    const [results, total, explain] = await Promise.all([
      coll.find(filter, { projection }).sort(sortSpec).skip(skip).limit(PAGE_SIZE).toArray(),
      coll.countDocuments(filter),
      coll.find(filter).sort(sortSpec).skip(skip).limit(PAGE_SIZE).explain("executionStats"),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const qs = new URLSearchParams();
    positions.forEach((p) => qs.append("position", p));
    if (!Number.isNaN(maxPrice)) qs.set("maxPrice", req.query.maxPrice);
    if (name) qs.set("name", name);
    qs.set("sort", sortField);

    res.render("players/search", {
      title: "Search players",
      positions: POSITIONS,
      selected: { positions, maxPrice: req.query.maxPrice || "", name, sort: sortField },
      results,
      total,
      page,
      totalPages,
      baseQs: qs.toString(),
      explain: summarizeExplain(explain),
    });
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
