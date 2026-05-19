const db = require('./server/db.js');
console.log(db.prepare('SELECT username, role FROM profiles').all());
