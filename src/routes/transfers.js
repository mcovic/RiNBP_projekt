// Transfer route: swaps one player out and another in for a fantasy team as a
// single multi-document transaction (requires a replica set — see DATA_MODEL.md).
const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb, client } = require("../db");

const router = express.Router();

// Show the transfer form (for a chosen team) plus the transfer history.
router.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const teams = await db.collection("fantasyTeams").find({}).sort({ name: 1 }).toArray();

    let team = null;
    let candidates = [];
    if (req.query.teamId) {
      team = await db.collection("fantasyTeams").findOne({ _id: new ObjectId(req.query.teamId) });
      if (team) {
        const ownedIds = team.players.map((p) => p.playerId);
        candidates = await db
          .collection("players")
          .find({ available: true, _id: { $nin: ownedIds } })
          .sort({ position: 1, price: -1 })
          .toArray();
      }
    }

    // History: newest first, with team name for context.
    const history = await db.collection("transfers").aggregate([
      { $lookup: { from: "fantasyTeams", localField: "fantasyTeamId", foreignField: "_id", as: "team" } },
      { $unwind: "$team" },
      { $sort: { createdAt: -1 } },
      { $project: { _id: 0, team: "$team.name", playerOut: 1, playerIn: 1, createdAt: 1 } },
    ]).toArray();

    res.render("transfers", {
      title: "Transfers",
      teams,
      team,
      candidates,
      history,
      message: req.query.msg || null,
    });
  } catch (err) {
    next(err);
  }
});

// Perform the transfer atomically.
router.post("/", async (req, res, next) => {
  const db = getDb();
  const teamId = new ObjectId(req.body.teamId);
  const outId = new ObjectId(req.body.outPlayerId);
  const inId = new ObjectId(req.body.inPlayerId);

  // Validate / gather data before opening the transaction.
  const team = await db.collection("fantasyTeams").findOne({ _id: teamId });
  if (!team) return res.status(404).send("Team not found");
  const outSnap = team.players.find((p) => p.playerId.equals(outId));
  if (!outSnap) return res.redirect(`/transfers?teamId=${req.body.teamId}&msg=Outgoing+player+not+in+squad`);
  const inPlayer = await db.collection("players").findOne({ _id: inId });
  if (!inPlayer) return res.status(404).send("Incoming player not found");

  const inSnap = {
    playerId: inPlayer._id,
    name: inPlayer.name,
    position: inPlayer.position,
    buyPrice: inPlayer.price,
  };
  const priceDelta = inPlayer.price - outSnap.buyPrice;

  const session = client.startSession();
  try {
    // withTransaction commits on success and aborts (rolls back) on throw.
    await session.withTransaction(async () => {
      const teams = db.collection("fantasyTeams");
      const transfers = db.collection("transfers");

      // 1) Remove the outgoing player from the embedded squad.
      await teams.updateOne({ _id: teamId }, { $pull: { players: { playerId: outId } } }, { session });
      // 2) Add the incoming snapshot and adjust the denormalized `spent`.
      await teams.updateOne(
        { _id: teamId },
        { $push: { players: inSnap }, $inc: { spent: priceDelta } },
        { session }
      );
      // 3) Log the transfer in the same transaction.
      await transfers.insertOne(
        {
          fantasyTeamId: teamId,
          playerOut: { playerId: outSnap.playerId, name: outSnap.name, price: outSnap.buyPrice },
          playerIn: { playerId: inSnap.playerId, name: inSnap.name, price: inSnap.buyPrice },
          createdAt: new Date(),
        },
        { session }
      );
    });
    res.redirect(`/transfers?teamId=${req.body.teamId}&msg=Transfer+completed`);
  } catch (err) {
    next(err); // transaction already rolled back
  } finally {
    await session.endSession();
  }
});

module.exports = router;
