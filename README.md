# Fantasy liga — RiNBP projekt

Studentski projekt za kolegij **Raspodijeljene i nerelacijske baze podataka (RiNBP)**.
Demonstrira ključne **MongoDB** koncepte na primjeru sustava za fantasy ligu.
Web aplikacija je tanak sloj nad bazom — forme za operacije i tablice/JSON za prikaz.

## Tehnologija

- **Baza:** MongoDB (lokalno za razvoj, MongoDB Atlas za cloud demo)
- **Backend:** Node.js v22 + Express, službeni `mongodb` driver (bez Mongoosea)
- **Frontend:** EJS + minimalni HTML/CSS

## Pokriveni MongoDB koncepti

| Koncept | Gdje (kod) | Ruta |
|---------|------------|------|
| CRUD | `src/routes/players.js`, `src/routes/teams.js` | `/players`, `/teams` |
| Napredno pretraživanje (`$in`, `$lt`, `$regex`, projekcija, sort, paginacija, indeks) | `src/routes/players.js` | `/players/search` |
| Agregacija (`$match`, `$lookup`, `$unwind`, `$group`, `$sort`, `$project`) | `src/routes/stats.js` | `/stats` |
| Transakcija (multi-document) | `src/routes/transfers.js` | `/transfers` |
| Denormalizacija / embedding | `fantasyTeams.players[]` snapshot | `/teams/:id` |

## Preduvjeti

- Node.js v22+
- MongoDB 6+ (lokalno preko Homebrewa: `brew install mongodb-community`)

## Instalacija

```bash
npm install
cp .env.example .env   # po potrebi prilagodi MONGODB_URI
```

## Pokretanje (lokalni razvoj)

Transakcije zahtijevaju **replica set** — samostalni mongod ih ne podržava.
Lokalni mongod je zato pokrenut kao **jednočvorni replica set `rs0`** (postupak je
dokumentiran u `docs/DATA_MODEL.md`). Ukratko:

```bash
# 1) U /opt/homebrew/etc/mongod.conf dodaj:
#    replication:
#      replSetName: rs0
brew services restart mongodb-community

# 2) Jednokratna inicijalizacija replica seta:
mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })'
```

`.env` (lokalno):

```
MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
DB_NAME=fantasy_league
PORT=3000
```

Zatim:

```bash
npm run seed    # popuni bazu demo podacima (idempotentno) + kreira indekse
npm start       # pokreni web app na http://localhost:3000
```

Ručni rad s bazom: `mongosh "mongodb://127.0.0.1:27017/fantasy_league?replicaSet=rs0"`

## Pokretanje (MongoDB Atlas — cloud demo)

Atlas cluster je već replica set, pa transakcije rade bez dodatnog podešavanja.
U `.env` postavi Atlas connection string (lozinku ne commitati):

```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?appName=<app>
```

pa pokreni `npm run seed` i `npm start` kao i lokalno.

## Struktura

```
src/
  server.js          # Express app, montira rute
  db.js              # konekcija na MongoDB (singleton)
  routes/            # players, teams, stats, transfers
  views/             # EJS predlošci
scripts/
  seed.js            # demo podaci + indeksi
docs/
  DATA_MODEL.md      # kolekcije, sheme, indeksi, primjeri upita
```

## Naredbe

```bash
npm install   # instalacija ovisnosti
npm run seed  # popuni bazu demo podacima
npm start     # pokreni web app
```
