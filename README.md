# Haryana Police CMS

A mobile-first, AI-assisted case management system for the Haryana Police.

## Stack

- **Frontend:** React 19 + Vite (dev server on port **3000**), Ant Design
- **Backend:** Express.js on port **5000**
- **Database:** PostgreSQL (`cms_haryana_police` by default) — there is no SQLite/`data.db` file
- **Auth:** Custom JWT tokens stored in the frontend `localStorage`

## Prerequisites

- Node.js **20 or newer** (`npm` included)
- A running PostgreSQL server and a database named `cms_haryana_police`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file and edit it:

   ```bash
   cp .env.example .env
   ```

   Set `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `JWT_SECRET`, and optionally
   `GROQ_API_KEY` / `GEMINI_API_KEY` / `CORS_ORIGIN`. Never commit the real `.env`.

3. Start the frontend (port 3000) and backend (port 5000) together:

   ```bash
   npm run dev
   ```

   The Vite dev server proxies `/api`, `/cases`, `/kb-files`, and `/uploads` to
   `http://localhost:5000`. The frontend uses `/api` from `VITE_API_URL` by default; change
   `VITE_API_URL` only if the backend is hosted elsewhere (e.g. `https://example.com/api`).

4. Optionally seed reference users on top of the schema/dev accounts created by `server/db.js`:

   ```bash
   npm run seed:ios   # investigating officers
   npm run seed:shos  # station house officers
   ```

## Accessing the System

- **React app:** `http://localhost:3000`
- **Backend API:** `http://localhost:5000` (use `http://localhost:3000/api` from the browser)

Development-only default logins (defined in `server/db.js`) are `admin` / `admin123`,
`io_1` / `io123`, and `sho_1` / `sho123`. They are for local development only — change
these credentials and `JWT_SECRET` before any real deployment.

## npm scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run Vite and the backend via nodemon together |
| `npm start` | Run the backend only (`node server/index.js`) |
| `npm run build` | Production frontend build |
| `npm run preview` | Preview the production build (proxies to port 5000) |
| `npm run lint` | Lint the frontend sources |
| `npm run seed:ios` | Seed investigating officers |
| `npm run seed:shos` | Seed station house officers |

## Schema changes

Schema initialization lives in `server/db.js` (PostgreSQL). Update the table creation/migration
logic there when the data model changes.

Please read `AGENT_INSTRUCTIONS.md` if you are using AI agents.
