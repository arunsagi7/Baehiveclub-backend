const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'database.sqlite');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Enable WAL mode for better concurrency
db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA foreign_keys=ON');

// Initialize schema
const initSchema = () => {
  db.serialize(() => {
    // Admin Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        profileImage TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating admin_users table:', err);
      else console.log('✅ admin_users table ready');
    });

    // Events table
    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'General',
        image TEXT,
        location TEXT,
        venue TEXT,
        date TEXT,
        startTime TEXT,
        endTime TEXT,
        price REAL DEFAULT 0,
        totalSeats INTEGER DEFAULT 0,
        remainingSeats INTEGER DEFAULT 0,
        organizer TEXT,
        phone TEXT,
        email TEXT,
        status TEXT DEFAULT 'upcoming',
        featured INTEGER DEFAULT 0,
        tags TEXT,
        requirements TEXT,
        mapLink TEXT,
        isDeleted INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating events table:', err);
      else console.log('✅ events table ready');
    });

    // Registrations table
    db.run(`
      CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventId INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        tickets INTEGER DEFAULT 1,
        amount REAL DEFAULT 0,
        paymentId TEXT,
        orderId TEXT,
        signature TEXT,
        ticket_no TEXT,
        paymentStatus TEXT DEFAULT 'pending',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (eventId) REFERENCES events(id)
      )
    `, (err) => {
      if (err) console.error('Error creating registrations table:', err);
      else console.log('✅ registrations table ready');
    });

    // Bookings table
    db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        event TEXT,
        ticket_no TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating bookings table:', err);
      else console.log('✅ bookings table ready');
    });

    // Ensure ticket_no column exists in existing sqlite database
    db.run(`ALTER TABLE registrations ADD COLUMN ticket_no TEXT`, () => {});


  });
};

initSchema();

// Promise wrapper for db.run
db.runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Promise wrapper for db.get
db.getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Promise wrapper for db.all
db.allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = db;
