// Seed script: fills `fantasy_league` with demo data and creates indexes.
// Idempotent: drops the relevant collections first, then repopulates, so it can
// be re-run safely (handy for demos/screenshots).
require("dotenv").config();
const { connect, getDb, client } = require("../src/db");

// Deterministic pseudo-random generator (LCG) so re-runs produce identical data.
let seedState = 123456789;
function rand() {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}
// Integer in [min, max].
function randInt(min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

const CLUBS = [
  "FC Rijeka", "HNK Hajduk", "GNK Dinamo", "NK Osijek",
  "NK Istra", "HNK Gorica", "NK Varaždin", "NK Lokomotiva",
];
const FIRST = [
  "Marko", "Luka", "Ivan", "Ante", "Josip", "Petar", "Filip", "Domagoj",
  "Mateo", "Nikola", "Karlo", "Bruno", "Toni", "Roko", "Fran", "David",
];
const LAST = [
  "Marić", "Horvat", "Kovačević", "Babić", "Jurić", "Novak", "Knežević",
  "Vuković", "Perić", "Šimić", "Galić", "Pavić", "Brkić", "Lovrić",
];

// Squad shape: how many players to create per position (total = 50).
const POSITION_PLAN = { GK: 6, DEF: 16, MID: 16, FWD: 12 };

// Build a player document. Stats/points scale with position so that
// aggregations (top scorers, standings) produce meaningful results.
function makePlayer(position) {
  const goals =
    position === "FWD" ? randInt(2, 18)
    : position === "MID" ? randInt(0, 10)
    : position === "DEF" ? randInt(0, 3)
    : 0; // GK
  const assists = position === "GK" ? randInt(0, 1) : randInt(0, 9);
  const minutes = randInt(450, 2700);
  // Points roughly derived from contributions + appearances.
  const totalPoints = goals * 5 + assists * 3 + Math.round(minutes / 90) * 2;
  // Price scales with attacking output, kept within ~4.0–12.5M.
  const price = Math.min(12.5, 4 + goals * 0.4 + assists * 0.2 + rand() * 1.5);

  return {
    name: `${pick(FIRST)} ${pick(LAST)}`,
    position,
    club: pick(CLUBS), // denormalized club name (not a reference)
    price: Math.round(price * 10) / 10,
    totalPoints,
    stats: { goals, assists, minutes },
    available: rand() > 0.1, // ~10% unavailable (injured/suspended)
  };
}

async function seed() {
  await connect();
  const db = getDb();

  // 1) Clean slate (idempotent re-run).
  const collections = ["players", "users", "fantasyTeams", "leagues", "rounds", "transfers"];
  for (const name of collections) {
    await db.collection(name).deleteMany({});
  }
  // Drop indexes too so createIndex definitions are re-applied cleanly.
  for (const name of collections) {
    try {
      await db.collection(name).dropIndexes();
    } catch (_) {
      // collection may not exist yet on a fresh database — ignore
    }
  }

  // 2) Users (managers).
  const now = new Date();
  const userDocs = [
    { username: "ivan_h", email: "ivan@example.com", createdAt: now },
    { username: "marko_k", email: "marko@example.com", createdAt: now },
    { username: "petra_n", email: "petra@example.com", createdAt: now },
  ];
  const usersRes = await db.collection("users").insertMany(userDocs);
  const userIds = Object.values(usersRes.insertedIds);

  // 3) League (members reference users).
  const leagueDoc = {
    name: "Liga prijatelja",
    code: "RIJ2026",
    createdBy: userIds[0],
    members: userIds, // all three users join
    createdAt: now,
  };
  const leagueRes = await db.collection("leagues").insertOne(leagueDoc);
  const leagueId = leagueRes.insertedId;

  // 4) Players (~50, spread across positions).
  const playerDocs = [];
  for (const [position, count] of Object.entries(POSITION_PLAN)) {
    for (let i = 0; i < count; i++) {
      playerDocs.push(makePlayer(position));
    }
  }
  const playersRes = await db.collection("players").insertMany(playerDocs);
  // Re-read inserted players with their _id for snapshots / round points.
  const players = await db.collection("players").find({}).toArray();

  // Group players by position to pick valid squads.
  const byPos = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of players) byPos[p.position].push(p);

  // 5) Fantasy teams for the first two users (embedding demo).
  // Snapshot = { playerId, name, position, buyPrice } stored inside the team so
  // displaying the squad needs no $lookup. Trade-off documented in DATA_MODEL.md.
  function buildSquad(slice) {
    const chosen = [
      ...slice(byPos.GK, 1),
      ...slice(byPos.DEF, 4),
      ...slice(byPos.MID, 4),
      ...slice(byPos.FWD, 2),
    ];
    const embedded = chosen.map((p) => ({
      playerId: p._id,
      name: p.name,
      position: p.position,
      buyPrice: p.price,
    }));
    const spent = Math.round(embedded.reduce((s, p) => s + p.buyPrice, 0) * 10) / 10;
    const totalPoints = chosen.reduce((s, p) => s + p.totalPoints, 0);
    return { embedded, spent, totalPoints };
  }

  const teamA = buildSquad((arr, n) => arr.slice(0, n));        // top of each pos
  const teamB = buildSquad((arr, n) => arr.slice(n, n + n));    // a different set

  const teamDocs = [
    {
      userId: userIds[0],
      leagueId,
      name: "Dream Team",
      budget: 100.0,
      spent: teamA.spent,
      totalPoints: teamA.totalPoints, // denormalized sum
      players: teamA.embedded,
    },
    {
      userId: userIds[1],
      leagueId,
      name: "Galaktikosi",
      budget: 100.0,
      spent: teamB.spent,
      totalPoints: teamB.totalPoints,
      players: teamB.embedded,
    },
  ];
  await db.collection("fantasyTeams").insertMany(teamDocs);

  // 6) Rounds (gameweeks) with embedded per-player points.
  function pointsForRound(pl) {
    // Small per-round score correlated with season output.
    const base = pl.position === "FWD" ? 3 : pl.position === "MID" ? 2 : 1;
    return base + randInt(0, 8);
  }
  const roundDocs = [
    {
      number: 1,
      deadline: new Date("2026-08-15T18:00:00Z"),
      status: "finished",
      playerPoints: players.map((p) => ({ playerId: p._id, points: pointsForRound(p) })),
    },
    {
      number: 2,
      deadline: new Date("2026-08-22T18:00:00Z"),
      status: "finished",
      playerPoints: players.map((p) => ({ playerId: p._id, points: pointsForRound(p) })),
    },
    {
      number: 3,
      deadline: new Date("2026-08-29T18:00:00Z"),
      status: "upcoming",
      playerPoints: [], // not played yet
    },
  ];
  await db.collection("rounds").insertMany(roundDocs);

  // 7) transfers: empty log — filled by the transaction demo in Phase 5.

  // 8) Indexes (see DATA_MODEL.md).
  await db.collection("players").createIndex({ position: 1, price: -1 });
  await db.collection("players").createIndex({ name: "text" });
  await db.collection("leagues").createIndex({ code: 1 }, { unique: true });
  await db.collection("fantasyTeams").createIndex({ leagueId: 1, totalPoints: -1 });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  // 9) Report.
  console.log("[seed] Done. Document counts:");
  for (const name of collections) {
    const count = await db.collection(name).countDocuments();
    console.log(`  ${name}: ${count}`);
  }

  await client.close();
}

seed().catch(async (err) => {
  console.error("[seed] Failed:", err);
  try { await client.close(); } catch (_) {}
  process.exit(1);
});
