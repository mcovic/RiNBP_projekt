# CLAUDE.md

Smjernice za rad na ovom projektu. Pročitaj prije izrade bilo kojeg dijela.

## Što je ovo

Studentski projekt za kolegij **Raspodijeljene i nerelacijske baze podataka (RiNBP)**.
Tema: **Sustav za fantasy ligu** s naglaskom na **MongoDB** (nerelacijska, dokumentna BP).

Cilj je **uredno pokriti zahtjeve kolegija**, a ne izraditi punu "igricu" fantasy lige.
Fokus je na bazi i demonstraciji MongoDB koncepata; web aplikacija je samo tanak sloj
za izvršavanje operacija nad bazom i prikaz rezultata.

> **Princip opsega:** pokrij svaki traženi koncept s **barem jednim jasnim primjerom**.
> Ne ulazi u širinu i ne sitničari. Radije jednostavno i točno nego opširno.

## Tehnologija

- **Baza:** MongoDB
  - **Razvoj:** lokalni `mongod` (već instaliran preko Homebrewa)
  - **Demo/seminar:** MongoDB Atlas (cloud) — pokriva temu "Raspodijeljene CloudDB"
  - Connection string se mijenja preko `.env` (`MONGODB_URI`)
- **Backend:** Node.js (v22) + Express, službeni `mongodb` driver (NE Mongoose — radimo direktno s driverom radi jasnoće MongoDB operacija)
- **Frontend:** EJS + obični HTML/CSS + malo vanilla JS. Minimalan UI: forme za pokretanje operacija i tablice/JSON za prikaz rezultata.

## MongoDB koncepti koje projekt MORA demonstrirati

Svaki s **po jednim reprezentativnim primjerom** (za naprednije ne treba ići u detalje):

1. **CRUD** — kreiranje/čitanje/ažuriranje/brisanje (igrači, korisnici, fantasy momčadi, lige)
2. **Napredno pretraživanje** — operatori (`$gt`, `$in`, `$regex`, `$elemMatch`), projekcije, sort, paginacija, **indeks**
3. **Agregacijski pipeline** — npr. ljestvica lige / top strijelci (`$match`, `$lookup`, `$group`, `$sort`, `$project`)
4. **Transakcije** — multi-document transakcija (npr. transfer igrača) — vidi napomenu o replica setu niže
5. **Denormalizacija / embedding** — namjerni embedding (npr. snapshot igrača u fantasy momčadi) uz objašnjenje trade-offa

## Struktura projekta (ciljana)

```
RiNBP_projekt/
├── CLAUDE.md
├── package.json
├── .env                 # MONGODB_URI (ne commitati)
├── .env.example
├── src/
│   ├── server.js        # Express app, montira rute
│   ├── db.js            # konekcija na MongoDB (singleton)
│   ├── routes/          # po domeni: players, teams, leagues, transfers, stats
│   └── views/           # EJS predlošci (minimalni UI)
├── scripts/
│   └── seed.js          # popunjavanje baze demo podacima
└── docs/
    ├── PLAN.md          # plan izrade / roadmap po fazama
    └── DATA_MODEL.md    # kolekcije, sheme, indeksi, primjeri upita
```

## Domena (kratko)

Kolekcije: `players`, `users`, `fantasyTeams`, `leagues`, `rounds`, `transfers`.
Detaljne sheme, indeksi i primjeri upita su u `docs/DATA_MODEL.md`.

## Konvencije

- Naziv baze: `fantasy_league`
- Sav rad s bazom ide kroz `src/db.js` (jedna konekcija, ponovno korištena)
- Imena polja: `camelCase`; identifikatori veza: `playerId`, `userId`, `leagueId`
- Demo podaci (igrači/klubovi) smiju biti izmišljeni ili realni — nebitno za ocjenu
- Komentari u kodu na hrvatskom (radi seminara), jasni i kratki
- Svaki demonstrirani koncept neka ima primjer i u kodu (ruta) i kao "sirovi" upit u `docs/DATA_MODEL.md` da se lako prenese u seminar

## Važne napomene

- **Transakcije zahtijevaju replica set.** Samostalni lokalni `mongod` ih ne podržava.
  Za demo transakcija koristi **Atlas** (već je replica set) ili lokalno pokreni mongod
  kao jednočvorni replica set. Dokumentiraj odabrani pristup u `docs/DATA_MODEL.md`.
- **Tajne (Atlas URI) idu u `.env`**, nikad u git/seminar. Drži `.env.example` ažuriran.
- Seminar (Word) se radi **tek nakon** funkcionalnog projekta. Struktura seminara je u `docs/PLAN.md`.

## Naredbe

```bash
npm install            # instalacija ovisnosti
npm run seed           # popuni bazu demo podacima
npm start              # pokreni web app (Express)
mongosh fantasy_league # ručni rad s bazom
```

## Radni tijek za Claude

- Slijedi faze iz `docs/PLAN.md` redom; ne preskači ispred dogovorenog.
- Prije dodavanja novog koncepta provjeri pokriva li ga već postojeći primjer.
- Drži stvari minimalnima — jedan dobar primjer po konceptu je dovoljan.
- Kad fetchaš dokumentaciju za library/driver, koristi Context7 (vidi globalna pravila).
