// Seed script: fills `fantasy_league` with demo data and creates indexes.
// Idempotent: drops the relevant collections first, then repopulates, so
// it can be re-run safely.
require("dotenv").config();
const { connect, getDb, client } = require("../src/db");

let seedState = 123456789;
function rand() {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}
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

const POSITION_PLAN = { GK: 6, DEF: 16, MID: 16, FWD: 12 };

function makePlayer(position) {
  const goals =
    position === "FWD" ? randInt(2, 18)
    : position === "MID" ? randInt(0, 10)
    : position === "DEF" ? randInt(0, 3)
    : 0; // GK
  const assists = position === "GK" ? randInt(0, 1) : randInt(0, 9);
  const minutes = randInt(450, 2700);
  const totalPoints = goals * 5 + assists * 3 + Math.round(minutes / 90) * 2;
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

  const collections = ["players", "users", "fantasyTeams", "leagues", "rounds", "transfers"];
  for (const name of collections) {
    await db.collection(name).deleteMany({});
  }
  for (const name of collections) {
    try {
      await db.collection(name).dropIndexes();
    } catch (_) {
      // collection may not exist yet on a fresh database — ignore
    }
  }

  const now = new Date();
  const userDocs = [
    { username: "ivan_h", email: "ivan@example.com", createdAt: now },
    { username: "marko_k", email: "marko@example.com", createdAt: now },
    { username: "petra_n", email: "petra@example.com", createdAt: now },
  ];
  const usersRes = await db.collection("users").insertMany(userDocs);
  const userIds = Object.values(usersRes.insertedIds);

  const leagueDoc = {
    name: "Liga prijatelja",
    code: "RIJ2026",
    createdBy: userIds[0],
    members: userIds, // all three users join
    createdAt: now,
  };
  const leagueRes = await db.collection("leagues").insertOne(leagueDoc);
  const leagueId = leagueRes.insertedId;

  const playerDocs = [];
  for (const [position, count] of Object.entries(POSITION_PLAN)) {
    for (let i = 0; i < count; i++) {
      playerDocs.push(makePlayer(position));
    }
  }
  const playersRes = await db.collection("players").insertMany(playerDocs);
  const players = await db.collection("players").find({}).toArray();

  const byPos = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of players) byPos[p.position].push(p);

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

  function pointsForRound(pl) {
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

  await db.collection("players").createIndex({ position: 1, price: -1 });
  await db.collection("players").createIndex({ name: "text" });
  await db.collection("leagues").createIndex({ code: 1 }, { unique: true });
  await db.collection("fantasyTeams").createIndex({ leagueId: 1, totalPoints: -1 });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });

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
