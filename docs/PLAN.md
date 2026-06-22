# Plan izrade — Fantasy liga (RiNBP)

Plan po fazama. Svaka faza je samostalno provjerljiva. Ne komplicirati — cilj je
uredno pokriti zahtjeve kolegija s minimalnim, jasnim primjerima.

## Faze

### Faza 0 — Postavljanje (skeleton)
- [ ] `package.json` (express, mongodb, ejs, dotenv) + npm skripte
- [ ] `.env.example` i `.env` (`MONGODB_URI`, `PORT`)
- [ ] `src/db.js` — konekcija (singleton), baza `fantasy_league`
- [ ] `src/server.js` — Express, EJS, montiranje ruta
- [ ] `.gitignore` (node_modules, .env)

### Faza 1 — Podaci i shema
- [ ] `scripts/seed.js` — ubaci demo igrače, korisnike, ligu, kola
- [ ] Kreiraj indekse (vidi `DATA_MODEL.md`)
- [ ] Provjera: `mongosh fantasy_league` pokazuje popunjene kolekcije

### Faza 2 — CRUD (igrači + momčadi)
- [ ] Rute + minimalne EJS forme za CRUD nad `players`
- [ ] CRUD nad `fantasyTeams` (kreiraj momčad, dodaj/makni igrača)

### Faza 3 — Napredno pretraživanje
- [ ] Ruta za pretragu igrača: filtri (pozicija, max cijena), sort, paginacija
- [ ] Demonstrirati `$in`, `$regex`, projekciju i korištenje indeksa

### Faza 4 — Agregacija
- [ ] Ljestvica lige (`$lookup` + `$sort` + `$project`)
- [ ] Top strijelci (alternativni pipeline)
- [ ] Prikaz rezultata u tablici

### Faza 5 — Transakcija
- [ ] Transfer igrača kao multi-document transakcija
- [ ] Odluka o replica setu (Atlas vs lokalni rs0) — dokumentirati
- [ ] Upis u `transfers` log unutar iste transakcije

### Faza 6 — Polirање + Atlas demo
- [ ] Kratki README s uputama za pokretanje
- [ ] Prebaciti `MONGODB_URI` na Atlas i provjeriti da sve radi (uklj. transakcije)
- [ ] Provjera da svaki koncept ima radni primjer

### Faza 7 — Seminar (tek nakon projekta)
- [ ] Popuniti Word po strukturi niže, koristeći screenshotove i upite iz `DATA_MODEL.md`

---

## Mapiranje zahtjeva kolegija → projekt

| Gradivo (predavanja/vježbe) | Gdje je pokriveno |
|------------------------------|-------------------|
| Dokumentne BP / NoSQL | Cijeli model (MongoDB) |
| JSON | Dokumenti kolekcija |
| CRUD (vj. 08) | Faza 2 |
| Napredno pretraživanje (vj. 09) | Faza 3 |
| Agregacija (vj. 10) | Faza 4 |
| Denormalizacija/transakcije (pred. 03) | Faza 5 + embedding u modelu |
| Raspodijeljene CloudDB (pred. 06) | Atlas demo, Faza 6 |

---

## Struktura seminara (Word) — za kasnije

1. Naslovna stranica
2. Sadržaj
3. **Uvod** — kratak opis projektnog zadatka (fantasy liga, MongoDB)
4. **Razvojna tehnologija**
   - 2.1 Opis korištene BP — MongoDB (dokumentna, NoSQL, Atlas/cloud)
   - 2.2 Back-end i front-end — Node.js + Express + EJS
5. **Realizacija projekta**
   - 3.1 Relacijska BP — *nije korištena* (kratko obrazložiti)
   - 3.2 Nerelacijska BP
     - 3.2.1 Definiranje kolekcija (iz `DATA_MODEL.md`)
     - 3.2.2 Izrada BP (seed, indeksi, primjeri CRUD/pretrage/agregacije/transakcije)
   - 3.3 Opis aplikacije (screenshotovi UI-a + objašnjenje operacija)
6. **Zaključak**

> Napomena: template je u `seminarski-template.doc` u rootu projekta.
