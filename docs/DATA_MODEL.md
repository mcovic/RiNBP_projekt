# Podatkovni model — Fantasy liga (MongoDB)

Baza: `fantasy_league`. Dokumentna BP, 6 kolekcija. Model namjerno koristi
**i reference i embedding** kako bismo u seminaru mogli objasniti denormalizaciju.

## Pregled kolekcija

| Kolekcija | Svrha | Glavne veze |
|-----------|-------|-------------|
| `players` | Stvarni nogometaši (igrači koje se "kupuje") | — |
| `users` | Korisnici aplikacije (menadžeri) | — |
| `fantasyTeams` | Momčad koju korisnik slaže | `userId`, `leagueId`, embedani igrači |
| `leagues` | Lige u kojima se korisnici natječu | `members[]` → users |
| `rounds` | Kola (gameweekovi) i bodovi po igraču | embedani rezultati |
| `transfers` | Log transfera (za transakcije) | `fantasyTeamId`, `playerId` |

---

## Sheme dokumenata

### players
```json
{
  "_id": ObjectId,
  "name": "Marko Marić",
  "position": "FWD",            // GK | DEF | MID | FWD
  "club": "FC Rijeka",          // denormalizirano (naziv kluba, ne ref)
  "price": 8.5,                 // cijena u milijunima
  "totalPoints": 124,           // ukupni fantasy bodovi (denorm., osvježava se)
  "stats": {                    // embedan agregat sezone
    "goals": 12,
    "assists": 5,
    "minutes": 1980
  },
  "available": true
}
```

### users
```json
{
  "_id": ObjectId,
  "username": "ivan_h",
  "email": "ivan@example.com",
  "createdAt": ISODate
}
```

### fantasyTeams
Primjer **embeddinga/denormalizacije**: u `players` čuvamo snapshot
(ime, pozicija, cijena u trenutku kupnje) da prikaz momčadi ne traži `$lookup`.
```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "leagueId": ObjectId,
  "name": "Dream Team",
  "budget": 100.0,
  "spent": 83.5,
  "totalPoints": 256,           // denorm. zbroj, osvježava se
  "players": [                  // embedani snapshotovi
    { "playerId": ObjectId, "name": "Marko Marić", "position": "FWD", "buyPrice": 8.5 }
  ]
}
```

### leagues
```json
{
  "_id": ObjectId,
  "name": "Liga prijatelja",
  "code": "RIJ2026",            // za pridruživanje
  "createdBy": ObjectId,        // userId
  "members": [ ObjectId ],      // userId-evi
  "createdAt": ISODate
}
```

### rounds (kola / gameweekovi)
```json
{
  "_id": ObjectId,
  "number": 5,
  "deadline": ISODate,
  "status": "finished",         // upcoming | live | finished
  "playerPoints": [             // embedani bodovi po igraču za to kolo
    { "playerId": ObjectId, "points": 9 }
  ]
}
```

### transfers (log za transakcije)
```json
{
  "_id": ObjectId,
  "fantasyTeamId": ObjectId,
  "playerOut": { "playerId": ObjectId, "name": "...", "price": 7.0 },
  "playerIn":  { "playerId": ObjectId, "name": "...", "price": 8.5 },
  "createdAt": ISODate
}
```

---

## Indeksi

```js
db.players.createIndex({ position: 1, price: -1 })   // pretraga po poziciji/cijeni
db.players.createIndex({ name: "text" })             // tekstualna/regex pretraga
db.leagues.createIndex({ code: 1 }, { unique: true })
db.fantasyTeams.createIndex({ leagueId: 1, totalPoints: -1 }) // ljestvica
db.users.createIndex({ email: 1 }, { unique: true })
```

---

## Primjeri upita po konceptu

> Ovi primjeri idu i u kod (rute) i direktno u seminar.

### 1. CRUD
```js
// Create
db.players.insertOne({ name: "Luka B.", position: "MID", club: "HNK", price: 6.5,
                       totalPoints: 0, stats: { goals: 0, assists: 0, minutes: 0 }, available: true })
// Read
db.players.find({ position: "MID" })
// Update
db.players.updateOne({ _id: id }, { $inc: { totalPoints: 8 } })
// Delete
db.players.deleteOne({ _id: id })
```

### 2. Napredno pretraživanje
```js
// Napadači jeftiniji od 9M, sortirani po bodovima, paginacija, indeks (position,price)
db.players.find(
  { position: "FWD", price: { $lt: 9 }, available: true },
  { name: 1, price: 1, totalPoints: 1, _id: 0 }   // projekcija
).sort({ totalPoints: -1 }).skip(0).limit(10)

// $in + $regex + $elemMatch
db.players.find({ position: { $in: ["MID", "FWD"] }, name: { $regex: /^M/i } })
db.fantasyTeams.find({ players: { $elemMatch: { position: "GK", buyPrice: { $gt: 5 } } } })
```

### 3. Agregacijski pipeline — ljestvica lige
```js
db.fantasyTeams.aggregate([
  { $match: { leagueId: leagueId } },
  { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
  { $unwind: "$user" },
  { $sort: { totalPoints: -1 } },
  { $project: { _id: 0, team: "$name", manager: "$user.username", totalPoints: 1 } }
])

// (alternativa) top strijelci
db.players.aggregate([
  { $match: { "stats.goals": { $gt: 0 } } },
  { $sort: { "stats.goals": -1 } },
  { $limit: 5 },
  { $project: { _id: 0, name: 1, club: 1, goals: "$stats.goals" } }
])
```

### 4. Transakcija — transfer igrača
Atomarno: makni igrača iz momčadi, dodaj novog, prilagodi `spent`, upiši u `transfers`.
```js
const session = client.startSession()
try {
  await session.withTransaction(async () => {
    await teams.updateOne({ _id: teamId },
      { $pull: { players: { playerId: outId } } }, { session })
    await teams.updateOne({ _id: teamId },
      { $push: { players: inSnapshot }, $inc: { spent: inPrice - outPrice } }, { session })
    await transfers.insertOne({ fantasyTeamId: teamId, playerOut, playerIn, createdAt: new Date() }, { session })
  })
} finally { await session.endSession() }
```
> **Replica set obavezan.** Atlas radi odmah. Lokalno: pokreni mongod kao jednočvorni
> replica set (`mongod --replSet rs0` + `rs.initiate()`) ili koristi Atlas samo za ovaj demo.

### 5. Denormalizacija / embedding
`fantasyTeams.players[]` čuva snapshot igrača (ime, pozicija, cijena) → prikaz momčadi
bez `$lookup`. Trade-off: brže čitanje, ali snapshot treba osvježiti ako se promijeni
izvorni `players` dokument. Isto vrijedi za `players.club` (denorm. naziv kluba) i
`fantasyTeams.totalPoints` (denorm. zbroj). Ovo je tema iz predavanja
"03 denormalizacija/transakcije".
