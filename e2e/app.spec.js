const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const routes = ['overview','members','registration','teams','schedule','attendance','payments','messages','facilities','website','join'];

test('workspace routes fit phone, tablet, laptop and desktop widths without browser errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(`/#${route}`);
      await expect(page.locator('#pageContent')).not.toBeEmpty();
      const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth }));
      expect(dimensions.document, `${route} at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
  expect(errors).toEqual([]);
});

test('overview figures and panels come from the local database', async ({ page }) => {
  const snapshot = await page.request.get('/api/bootstrap').then(response => response.json());
  await page.goto('/#overview');
  await expect(page.getByText('Fee collection', { exact: true })).toBeVisible();
  await expect(page.getByText('Upcoming sessions', { exact: true })).toBeVisible();
  await expect(page.getByText('Recent activity', { exact: true })).toBeVisible();
  await expect(page.locator('.stats-grid .stat-card').first().locator('.stat-value')).toHaveText(String(snapshot.members.length));
  const overview = await page.locator('#pageContent').innerText();
  expect(overview).not.toContain('8,460 JOD');
  expect(overview).not.toContain('12% vs last month');
});

test('registration preview opens the real family application', async ({ page }) => {
  await page.goto('/#registration');
  await page.getByRole('button', { name: 'Preview family form' }).click();
  await expect(page).toHaveURL(/#join$/);
  await expect(page.getByRole('heading', { name: 'Find the right team for your child' })).toBeVisible();
});

test('family registration validates, preserves back navigation, confirms and prevents duplicates', async ({ page }) => {
  const athlete = `QA Athlete ${Date.now()}`;
  await page.goto('/#join');
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByLabel('Athlete full name')).toBeVisible();
  await page.getByLabel('Athlete full name').fill(athlete);
  await page.getByRole('spinbutton', { name: 'Age' }).fill('12');
  await page.getByLabel('Program').selectOption({ index: 1 });
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByLabel('Parent or guardian full name').fill('QA Guardian');
  await page.getByLabel('Mobile number').fill('+962 790 123 456');
  await page.getByRole('button', { name: /Review application/ }).click();
  await expect(page.getByText(athlete)).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Parent or guardian full name')).toHaveValue('QA Guardian');
  await page.getByRole('button', { name: /Review application/ }).click();
  await page.getByLabel(/I am the parent or legal guardian/).check();
  await page.getByRole('button', { name: /Send application/ }).click();
  await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible();
  await expect(page.getByText(/M-\d{6}/)).toBeVisible();
  const snapshot = await page.request.get('/api/bootstrap').then(response => response.json());
  const saved = snapshot.registrations.find(row => row.name === athlete);
  expect(saved?.status).toBe('Needs review');
  const duplicate = await page.request.post('/api/registrations', { data: { athlete, age: 12, program: saved.program, guardian: 'QA Guardian', mobile: '+962790123456', consent: 'yes' } });
  expect(duplicate.status()).toBe(409);
});

test('administrator can approve a pending application and fees remain due', async ({ page }) => {
  await page.goto('/#registration');
  await page.locator('[data-registration-id="1"]').click();
  await page.locator('#modalBody').getByRole('button', { name: 'Approved' }).click();
  await expect(page.getByText('Review decision saved')).toBeVisible();
  const snapshot = await page.request.get('/api/bootstrap').then(response => response.json());
  expect(snapshot.registrations.find(row => row.id === 1).status).toBe('Approved');
  expect(snapshot.members.find(row => row.name === 'Leen Nasser')?.status).toBe('Pending');
});

test('registration filters include declined and show only matching records', async ({ page }) => {
  await page.goto('/#registration');
  await page.getByRole('button', { name: /Needs review/ }).click();
  for (const row of await page.locator('.data-table tbody tr:visible').all()) {
    const status = await row.locator('.status-pill').textContent().catch(() => '');
    if (status) expect(status.trim()).toBe('Needs review');
  }
  await expect(page.getByRole('button', { name: 'Declined' })).toBeVisible();
});

test('club staff can record a Cash payment and create a scheduled session', async ({ page }) => {
  await page.goto('/#payments');
  await page.locator('[data-action="record-payment"]').click();
  await page.locator('#actionForm [name="family"]').selectOption({ index: 1 });
  await page.locator('#actionForm [name="amount"]').fill('25');
  await page.locator('#actionForm [name="method"]').selectOption('Cash');
  await page.locator('#actionForm [name="date"]').fill(new Date().toISOString().slice(0,10));
  await page.locator('#actionForm button[type="submit"]').click();
  await expect(page.getByText('Payment recorded')).toBeVisible();
  let snapshot = await page.request.get('/api/bootstrap').then(response => response.json());
  expect(snapshot.payments.find(payment => payment.method === 'Cash' && payment.amount_fils === 25000)).toBeTruthy();

  const title = `QA session ${Date.now()}`;
  await page.goto('/#schedule');
  await page.locator('[data-action="add-event"]').click();
  await page.locator('#actionForm [name="event"]').fill(title);
  await page.locator('#actionForm [name="date"]').fill(new Date().toISOString().slice(0,10));
  await page.locator('#actionForm [name="time"]').fill('16:00');
  await page.locator('#actionForm [name="team"]').selectOption({ index: 1 });
  await page.locator('#actionForm [name="type"]').selectOption({ index: 1 });
  await page.locator('#actionForm button[type="submit"]').click();
  await expect(page.getByText('Calendar event added')).toBeVisible();
  snapshot = await page.request.get('/api/bootstrap').then(response => response.json());
  expect(snapshot.events.some(event => event.title === title)).toBeTruthy();
});

test('workspace search, notifications, profile and help controls are interactive', async ({ page }) => {
  await page.goto('/#overview');
  await page.locator('#searchBtn').click();
  await expect(page).toHaveURL(/#members$/);
  await expect(page.locator('#memberSearch')).toBeFocused();
  await page.locator('#notificationBtn').click();
  await expect(page).toHaveURL(/#registration$/);
  await page.locator('#profileBtn').click();
  await expect(page.locator('#modalBackdrop')).toBeVisible();
  await expect(page.getByText('Workspace profile')).toBeVisible();
  await page.locator('#modalBody [data-action="close-modal"]').click();
  await page.locator('[data-action="help"]').click();
  await expect(page.getByText('Workspace help')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modalBackdrop')).toBeHidden();
});

test('staff can save a family message to the local inbox', async ({ page }) => {
  const message = `QA family notice ${Date.now()}`;
  await page.goto('/#messages');
  await page.locator('[data-action="new-message"]').click();
  await page.locator('#actionForm [name="audience"]').selectOption({ index: 1 });
  await page.locator('#actionForm [name="message"]').fill(message);
  await page.locator('#actionForm button[type="submit"]').click();
  await expect(page.getByText('Message sent to the selected group')).toBeVisible();
  const snapshot = await page.request.get('/api/bootstrap').then(response => response.json());
  expect(snapshot.threads.some(thread => thread.messages.some(item => item.body === message))).toBeTruthy();
});

test('family registration meets WCAG 2.1 A/AA automated checks at phone and desktop widths', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#join');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(results.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }))).toEqual([]);
  }
});
