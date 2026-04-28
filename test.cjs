const db = require('better-sqlite3')('data.db');
console.log(db.prepare("SELECT * FROM profiles WHERE role='io'").all());
