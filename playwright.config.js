const { defineConfig } = require('@playwright/test');
const os = require('node:os');
const path = require('node:path');
const database = path.join(os.tmpdir(), 'malaeb-playwright.sqlite3');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4174', browserName: 'chromium', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'python server.py', cwd: __dirname, url: 'http://127.0.0.1:4174/api/health', reuseExistingServer: false, timeout: 30000, env: { MALAEB_HOST: '127.0.0.1', MALAEB_PORT: '4174', MALAEB_DB_PATH: database } },
  globalTeardown: './e2e/teardown.js'
});
