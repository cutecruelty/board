const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "database.sqlite");

// Обёртка над встроенным в Node sqlite (node:sqlite, доступен с Node 22.5,
// стабильно без флагов начиная с Node 24). Нативных модулей не требует,
// поэтому не ломается на новых версиях Node.
class Database {
  constructor() {
    this.db = null;
  }

  async connect() {
    this.db = new DatabaseSync(DB_PATH);
    this.db.exec("PRAGMA foreign_keys = ON");
    console.log("Connected to SQLite database");
    await this.initTables();
    return this;
  }

  async initTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        public_hash TEXT UNIQUE,
        is_public INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS board_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(board_id, user_id)
      )`,

      `CREATE TABLE IF NOT EXISTS board_objects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS board_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL,
        user_id INTEGER,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    ];

    const indexQueries = [
      `CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_id)`,
      `CREATE INDEX IF NOT EXISTS idx_boards_public_hash ON boards(public_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_board_access_board ON board_access(board_id)`,
      `CREATE INDEX IF NOT EXISTS idx_board_access_user ON board_access(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_board_objects_board ON board_objects(board_id)`,
      `CREATE INDEX IF NOT EXISTS idx_board_likes_board ON board_likes(board_id)`,
    ];

    try {
      for (const query of queries) {
        await this.run(query);
      }

      for (const query of indexQueries) {
        await this.run(query);
      }

      console.log("Database tables initialized successfully");
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  async run(sql, params = []) {
    const result = this.db.prepare(sql).run(...params);
    return {
      lastID: Number(result.lastInsertRowid),
      changes: Number(result.changes),
    };
  }

  async get(sql, params = []) {
    return this.db.prepare(sql).get(...params);
  }

  async all(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  async close() {
    if (this.db) {
      const dbToClose = this.db;
      this.db = null;
      try {
        dbToClose.close();
        console.log("Database connection closed");
      } catch (err) {
        if (
          err &&
          (err.code === "SQLITE_MISUSE" ||
            String(err.message).includes("closed"))
        ) {
          return;
        }
        throw err;
      }
    }
  }
}

module.exports = new Database();
