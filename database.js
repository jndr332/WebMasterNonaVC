const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cursosphe.db');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS inscripciones (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT    NOT NULL,
      correo      TEXT    NOT NULL,
      celular     TEXT    NOT NULL,
      cedula      TEXT    NOT NULL UNIQUE,
      curso       TEXT    NOT NULL,
      estado_pago INTEGER NOT NULL DEFAULT 0,
      asistencia  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_cedula ON inscripciones(cedula)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_correo ON inscripciones(correo)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_curso   ON inscripciones(curso)");
}

module.exports = { getDb };
