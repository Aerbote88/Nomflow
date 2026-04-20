# NômFlow

**Live at [nomflow.app](https://nomflow.app).**

An advanced study tool for learning **chữ Nôm** — the classical Vietnamese vernacular script. NômFlow combines a spaced-repetition engine, line-by-line readers for canonical texts, writing practice with animated stroke diagrams, and a gamified challenge mode to help learners build real fluency with Nôm characters and the literary works they appear in.

The initial corpus is drawn from classical works including *Truyện Kiều* and *Lục Vân Tiên*.

## Features

- **Spaced repetition (SRS)** — SM-2–style review algorithm with learning steps, ease-factor adjustment, and per-item interval tracking. Reviews can be undone.
- **Line- and character-level study** — learn individual chữ Nôm characters or whole lines of classical poetry; progress is tracked separately for each item type.
- **Reader** — browse source texts line by line with Quốc Ngữ and per-character dictionary lookups.
- **Writing practice** — animated stroke-order diagrams powered by `hanzi-writer` and a custom stroke-data ingestion pipeline.
- **Challenge mode** — Progress through texts line by line, typing the Quốc ngữ for each line, with sudden-death / normal scoring mode, persistent challenge sessions, and per-text leaderboards.
- **Study lists** — build custom lists of characters or lines.
- **Gamification** — XP, daily streaks, global and per-text leaderboards.
- **Guest mode** — try the app without creating an account.
- **Accounts & auth** — JWT auth, password reset via email (Resend), rate limiting.
- **Automated daily database backups** via APScheduler.

## Tech stack

**Backend**
- FastAPI + Uvicorn
- SQLModel / SQLAlchemy
- PostgreSQL in production (Supabase), SQLite for local development
- JWT auth (`python-jose`) with `passlib` (pbkdf2_sha256) password hashing
- `slowapi` rate limiting
- `APScheduler` for scheduled jobs (daily backups, cache warming)
- `resend` for transactional email

**Frontend**
- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS v4
- `hanzi-writer` for stroke-order animation

**Infra**
- Dockerfile for container builds
- Railway deploy config (`Procfile`, `railway.json`)
- GitHub Actions workflow for syncing stroke data from a companion repo

## Repository layout

```
backend/
  main.py              # FastAPI app, all routes, lifespan setup
  models.py            # SQLModel schema (users, progress, texts, lists, leaderboards, etc.)
  database.py          # Engine + session factory (Postgres or SQLite)
  auth.py              # JWT + password hashing
  srs_logic.py         # SRS algorithm (learning steps, ease factor, intervals)
  backup_db.py         # Daily DB backup job
  seed_data.py         # Seed source texts / dictionary data
  seed_curated_lists.py
  nom_grades_data.py
  scripts/
    ingest_stroke_data.py  # Ingests stroke data from make-me-a-chunom
  migrations/

frontend/
  src/
    app/               # Next.js App Router routes
      study/ reader/ flashcards/ challenge/
      writing-practice/ library/ leaderboard/
      dashboard/ login/ register/ settings/ …
    components/        # Dashboard, Dictionary, Library, Navigation, Study, WritingPractice, ui
    hooks/             # useDictionarySidebar, useGuestOrAuthGuard
    lib/               # api.ts, logger.ts, strokeData.ts
    public/            # Nôm Na Tông font, wordmark

.github/workflows/
  sync-stroke-data.yml # Manual workflow to re-ingest stroke data

Dockerfile
Procfile
railway.json
requirements.txt
```

## Getting started (local development)

### Prerequisites

- Python 3.11+
- Node.js 20+ and npm
- (Optional) PostgreSQL — otherwise the app falls back to a local SQLite file

### 1. Clone and install

```bash
git clone https://github.com/Aerbote88/Nomflow.git
cd Nomflow

# Backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
cd ..
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

At minimum you need `SECRET_KEY` (any random string for local dev). Leave `DATABASE_URL` unset to use a local SQLite file (`learning.db`).

### 3. Seed the database

```bash
python -m backend.seed_data
python -m backend.seed_curated_lists
```

If you have access to stroke data (see [`make-me-a-chunom`](https://github.com/Aerbote88/make-me-a-chunom) — currently private), also run:

```bash
STROKE_DATA_SOURCE=/path/to/stroke-data python -m backend.scripts.ingest_stroke_data
```

### 4. Run

In two terminals:

```bash
# Backend — http://localhost:8000
uvicorn backend.main:app --reload

# Frontend — http://localhost:3000
cd frontend && npm run dev
```

Open http://localhost:3000.

## Deployment

The repo ships with a `Dockerfile`, `Procfile`, and `railway.json` for Railway. Any platform that can run a Python container and serve a Next.js frontend (Vercel, Fly.io, Render, etc.) will work.

Required environment variables in production:

| Variable        | Purpose                                                      |
| --------------- | ------------------------------------------------------------ |
| `SECRET_KEY`    | JWT signing key (must be set, app refuses to boot otherwise) |
| `DATABASE_URL`  | PostgreSQL connection string                                 |
| `FRONTEND_URL`  | Allowed CORS origin for the frontend                         |
| `RESEND_API_KEY`| Transactional email (password reset)                         |
| `BACKUP_EMAIL`  | Recipient for daily DB backups                               |
| `MAINTENANCE_MODE` | Set to `true` to return 503 on all API routes             |

## SRS algorithm

The review engine lives in `backend/srs_logic.py` and is a variant of SM-2:

- **Learning phase** — two steps (1 min, 10 min) before graduation. Graduating interval is 1 day; pressing *Easy* graduates immediately with a 4-day interval.
- **Review phase** — quality grades (Again / Hard / Good / Easy) adjust a per-item *ease factor* (min 1.3). Intervals grow by `interval × ease × modifier`, with a +1.3× bonus for *Easy*. *Again* sends the card back to the learning phase and docks ease by 0.20.
- **Undo** — every review snapshot stores the previous SRS state on `UserProgress`, so the last action can be reversed.

## Contributing & suggestions

NômFlow is built primarily for the Vietnamese studies community — students, teachers, and researchers working with chữ Nôm texts. Input from both **domain experts** (scholars of Hán-Nôm, premodern Vietnamese literature, pedagogy) and **developers** is very welcome.

Ways to help:

- **Report bugs or suggest features** — open an [issue](https://github.com/Aerbote88/Nomflow/issues). Screenshots and reproduction steps are especially helpful for UI bugs.
- **Corrections to the corpus** — if you spot a transcription, Quốc Ngữ reading, translation, or dictionary entry that should be fixed, please file an issue describing the line/character and the correction (with a reference where possible).
- **New texts or curated lists** — proposals for additional source texts, graded lists, or pedagogical sequences are welcome. Please open an issue first to discuss scope.
- **Code contributions** — pull requests are welcome. For non-trivial changes, open an issue first so we can align on approach. Keep PRs focused; run `npm run lint` in `frontend/` before submitting.
- **Feedback from learners** — if you use the app and something feels off (pacing, UX, difficulty, anything), that's valuable signal. The in-app feedback form writes to the `feedback` table, or you can open an issue.

If you're a Vietnamese studies researcher or teacher who'd like to collaborate more directly on curriculum or corpus work, feel free to reach out via GitHub.

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgements

- **Nôm Na Tông** font used throughout the UI.
- Stroke-order data ingested from the companion [`make-me-a-chunom`](https://github.com/Aerbote88/make-me-a-chunom) project, with newly generated Nôm-only data maintained in [`chunom-stroke-data`](https://github.com/Aerbote88/chunom-stroke-data).
- The broader Hán-Nôm preservation community make projects like this possible.
