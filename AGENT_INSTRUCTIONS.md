# Haryana Police CMS — AI Agent Instructions

Read these rules before making code changes. Keep changes small, complete, and consistent with
the existing patterns.

## 1. Architecture (CRITICAL)

- **Backend:** Express app at `server/index.js`, listening on port **5000**. Never replace it
  with another backend or a client-side database.
- **Database:** **PostgreSQL** (default database `cms_haryana_police`), accessed via `pg` and
  initialized/migrated in `server/db.js`. SQLite / `data.db` / `better-sqlite3` are not used.
- **API:** The frontend calls the `/api` base URL (from `VITE_API_URL`, default `/api`). In dev,
  Vite runs on port **3000** and proxies `/api`, `/cases`, `/kb-files`, and `/uploads` to
  `http://localhost:5000`. Do not hardcode `http://localhost:3000/api` or use Supabase.
- **Config:** Copy `.env.example` to `.env` for local settings. `JWT_SECRET`, database settings,
  and AI keys come from the environment. Never commit secrets.
- **Seeding:** Use `npm run seed:ios` (`server/seed-ios.js`) and `npm run seed:shos`
  (`server/seed-shos.js`). Default accounts such as `admin` / `admin123`, `io_1` / `io123`, and
  `sho_1` / `sho123` are development-only; change them and `JWT_SECRET` before deployment.

## 2. Tech Stack and Patterns

- **Frontend:** React 19 + Vite (no Next.js, no SSR); Ant Design components and Lucide icons.
- **CSS:** Plain CSS / global overrides; avoid adding Tailwind unless necessary.
- **Authentication:** Custom JWT stored in frontend `localStorage`; enforce roles with
  `RoleGate`-style checks (e.g. `<RoleGate allowedRoles={['io', 'sho']}>`).
- Use plain `fetch` against `/api`; keep the interface mobile-first for tablets and phones.

## 3. Workflow and Quality

- Work on feature branches and submit a Pull Request — never commit directly to `main`.
- Deliver complete, working code; no placeholder comments or stubs.
- Verify with `npm run lint` and `npm run build` before requesting review.
- Common scripts: `npm run dev` (both servers), `npm start` (backend only), `npm run build`,
  `npm run preview`, `npm run lint`, `npm run seed:ios`, `npm run seed:shos`.
- Keep the UI simple, polished, and accessible to non-technical users.
