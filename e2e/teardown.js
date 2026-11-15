const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = async () => {
  const database = path.join(os.tmpdir(), 'malaeb-playwright.sqlite3');
  for (const file of [database, `${database}-wal`, `${database}-shm`]) {
    try { fs.rmSync(file, { force: true }); } catch {}
  }
};
