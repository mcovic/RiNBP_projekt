// Aggregation routes: league standings and top scorers.
// Demonstrates $match, $lookup, $unwind, $group, $sort, $limit, $project.
const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const db = getDb();

    // Use the (single) seeded league for the standings demo.
    const league = await db.collection("leagues").findOne({});

    // 1) League standings: join teams → users, sort by points, project a clean row.
    let standings = [];
    if (league) {
      standings = await db.collection("fantasyTeams").aggregate([
        { $match: { leagueId: league._id } },
        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        { $sort: { totalPoints: -1 } },
        { $project: { _id: 0, team: "$name", manager: "$user.username", totalPoints: 1, spent: 1 } },
      ]).toArray();
    }

    // 2) Top scorers: filter players with goals, sort, limit, project.
    const topScorers = await db.collection("players").aggregate([
      { $match: { "stats.goals": { $gt: 0 } } },
      { $sort: { "stats.goals": -1 } },
      { $limit: 5 },
      { $project: { _id: 0, name: 1, club: 1, position: 1, goals: "$stats.goals" } },
    ]).toArray();

    // 3) Bonus: total players per club via $group (shows the grouping stage too).
    const playersPerClub = await db.collection("players").aggregate([
      { $group: { _id: "$club", players: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
      { $sort: { players: -1 } },
      { $project: { _id: 0, club: "$_id", players: 1, avgPrice: { $round: ["$avgPrice", 1] } } },
    ]).toArray();

    res.render("stats", {
      title: "Stats & aggregations",
      league,
      standings,
      topScorers,
      playersPerClub,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
