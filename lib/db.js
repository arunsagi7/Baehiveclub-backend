const sqlite3 = require("sqlite3");

const db = new sqlite3.Database(
    "database.sqlite"
);


db.run(`
CREATE TABLE IF NOT EXISTS bookings (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT,
 email TEXT,
 event TEXT,
 ticket_no TEXT
)
`);


module.exports = db;