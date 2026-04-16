import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initHcReplyDb } from './db/hcReplySchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Open database in the root folder
const db = new Database(join(__dirname, '../data.db'), { verbose: console.log });

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    full_name TEXT NOT NULL,
    badge_number TEXT,
    rank TEXT,
    station_id TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert seed data if profiles is empty
const count = db.prepare('SELECT COUNT(*) as c FROM profiles').get().c;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO profiles (id, username, password, role, full_name, badge_number, rank, station_id)
    VALUES (@id, @username, @password, @role, @full_name, @badge_number, @rank, @station_id)
  `);

  const users = [
    {
      id: 'usr-1', username: 'admin', password: 'admin123', role: 'admin',
      full_name: 'Test Admin', badge_number: 'ADM-001', rank: 'SP', station_id: 'hq'
    },
    {
      id: 'usr-2', username: 'io_1', password: 'io123', role: 'io',
      full_name: 'Investigating Officer Singh', badge_number: 'IO-101', rank: 'SI', station_id: 'stn-1'
    },
    {
      id: 'usr-3', username: 'sho_1', password: 'sho123', role: 'sho',
      full_name: 'SHO Kumar', badge_number: 'SHO-201', rank: 'Inspector', station_id: 'stn-1'
    }
  ];

  const transaction = db.transaction((users) => {
    for (const user of users) insert.run(user);
  });
  
  transaction(users);
  console.log('Seed users created.');
}

initHcReplyDb(db);

export default db;
