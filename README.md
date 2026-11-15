# Malaeb Club HQ

A local, bilingual sports-club operations app for Jordan. The admin workspace and family application form run against a persistent SQLite database on this computer.

## Start it

1. Install Python 3.10 or newer if it is not already installed.
2. Double-click `start-malaeb.bat`, or run `.\start-malaeb.ps1` in PowerShell.
3. Keep the terminal window open. It prints the address for this PC and the address for other devices on the same Wi-Fi.
4. Use **Registration → Preview family form** to open the parent intake flow. New applications appear in the admin review queue.

The app runtime uses Python's standard library and SQLite. `data/schema.sql` describes the local database; the app creates `data/malaeb.sqlite3` and fictional seed records on first run. JOD values are stored as integer fils (1 JOD = 1,000 fils), consistent with Jordan's official currency denomination. ([Jordan Ministry of Foreign Affairs](https://mfa.gov.jo/wps/contents/official-currency))

## Developer setup

1. Install Python 3.10+ and Node.js 20+.
2. Install the development tools with `npm ci`.
3. Install the Playwright browser once with `npx playwright install chromium`.
4. Run the app with `python server.py` or the Windows launcher above.
5. Run the browser regression suite with `npm test`.

The browser suite starts its own server and temporary SQLite database; it does not use or modify your normal club database. It covers the main routes at phone, tablet, and desktop widths, the family registration and club workflows, and accessibility checks for the family form. GitHub Actions runs the same suite on pushes and pull requests.

The repository intentionally excludes local SQLite databases, Wi-Fi address status, logs, dependencies, and test artifacts. Keep real family, athlete, payment, and contact data out of GitHub.

## Local features

- Bilingual English/Arabic interface with RTL layout and responsive navigation.
- Athlete and guardian records, a three-step family registration wizard with resume-in-session, review/consent, duplicate protection, and registration decisions.
- Team creation and roster assignment.
- Club schedule and session attendance.
- JOD fee ledger with manual Cash and CliQ records.
- Local message threads, facility requests, and editable club profile.
- CSV export and a local audit log.
- Bright, atmospheric glass surfaces, soft blue and violet lighting, layered blur, calm motion, and reduced-motion support.

Records survive a browser refresh and are stored in `data/malaeb.sqlite3`. To back them up, stop the app and copy that file to a private location. To reset the demo to its original fictional data, stop the app, delete `data/malaeb.sqlite3` and its `-wal`/`-shm` companions if present, then restart.

## Same-Wi-Fi access

The launcher finds this PC's active Wi-Fi IPv4 address and binds the app to that address only. It does not bind to the Ethernet, VPN, or all-interface addresses. Other devices must be on the same Wi-Fi network and use the printed Wi-Fi URL. The address can change when the router reconnects; restart the app to print the current one.

A Windows Firewall inbound rule is installed for TCP 4173 on the Private profile, limited to `LocalSubnet` and this PC's Wi-Fi address. If the router changes the Wi-Fi address, rerun `allow-malaeb-wifi-firewall.ps1` as administrator to refresh the rule. The app itself binds only to the active Wi-Fi IPv4 address. The server has no sign-in, encryption at rest, or multi-user permissions, so keep using fictional data and do not use this build for real children, families, medical details, or financial records. Payments are ledger entries only and messages stay on this PC.

The glass treatment takes visual cues from [martinargalas/glass-cards](https://github.com/martinargalas/glass-cards), while Malaeb keeps original code, layout, copy, palette and data.
