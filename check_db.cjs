const Database = require('better-sqlite3');
const db = new Database('./server/database.sqlite');
console.log(db.prepare('SELECT username, role FROM profiles').all());
