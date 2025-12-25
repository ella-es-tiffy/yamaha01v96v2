const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class EQLibraryDB {
    constructor() {
        const dbDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

        this.db = new sqlite3.Database(path.join(dbDir, 'eq_library.db'));
        this.init();
    }

    init() {
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS presets (
                id INTEGER PRIMARY KEY,
                name TEXT,
                type INTEGER,
                att INTEGER,
                low_g INTEGER, low_f INTEGER, low_q INTEGER,
                lmid_g INTEGER, lmid_f INTEGER, lmid_q INTEGER,
                hmid_g INTEGER, hmid_f INTEGER, hmid_q INTEGER,
                high_g INTEGER, high_f INTEGER, high_q INTEGER
            )`);
            this.db.run(`CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`);
        });
    }

    saveSetting(key, value) {
        return new Promise((resolve, reject) => {
            this.db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, JSON.stringify(value)], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    getSetting(key) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT value FROM settings WHERE key = ?", [key], (err, row) => {
                if (err) reject(err);
                else resolve(row ? JSON.parse(row.value) : null);
            });
        });
    }

    savePreset(preset) {
        const { id, name, type, att, eq } = preset;
        return new Promise((resolve, reject) => {
            this.db.run(`INSERT OR REPLACE INTO presets (
                id, name, type, att, 
                low_g, low_f, low_q,
                lmid_g, lmid_f, lmid_q,
                hmid_g, hmid_f, hmid_q,
                high_g, high_f, high_q
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                id, name, type, att,
                eq.low.gain, eq.low.freq, eq.low.q,
                eq.lmid.gain, eq.lmid.freq, eq.lmid.q,
                eq.hmid.gain, eq.hmid.freq, eq.hmid.q,
                eq.high.gain, eq.high.freq, eq.high.q
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    getPreset(id) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM presets WHERE id = ?", [id], (err, row) => {
                if (err) reject(err);
                else resolve(row ? this.mapRow(row) : null);
            });
        });
    }

    getAllPresets() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM presets", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => this.mapRow(row)));
            });
        });
    }

    mapRow(row) {
        return {
            id: row.id,
            name: row.name,
            type: row.type,
            att: row.att,
            eq: {
                low: { gain: row.low_g, freq: row.low_f, q: row.low_q },
                lmid: { gain: row.lmid_g, freq: row.lmid_f, q: row.lmid_q },
                hmid: { gain: row.hmid_g, freq: row.hmid_f, q: row.hmid_q },
                high: { gain: row.high_g, freq: row.high_f, q: row.high_q }
            }
        };
    }
}

module.exports = new EQLibraryDB();
