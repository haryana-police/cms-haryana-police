# Haryana Police CMS

A mobile-first, AI-assisted case management system for the Haryana Police.

## Developer Quickstart

This project uses React, Vite, Ant Design, Express.js, and SQLite.
All backend logic, database tables, and authentication rely on our local custom Node API.
For development, we use `concurrently` to run the frontend and backend together natively on your machine without Docker.

### Prerequisites
- Node.js (v24+)

### Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
   *This command spins up the Vite frontend and Express backend. It will also automatically generate the SQLite `data.db` file and table schemas if they do not exist.*

### Accessing the System
- **React App:** `http://localhost:5180`
- **Backend API:** `http://localhost:3000`

**Test User:** Use the "Quick Login Options" dynamically visible on the login screen, or type:
- Username: `admin`
- Password: `admin123`

### Rule: Database Architecture
If you need to make changes to the schema, edit the `server/db.js` file and adjust the table creation logic manually. Data persistence is powered directly by SQLite.

Please read `AGENT_INSTRUCTIONS.md` if you are using AI agents.
