# MySafar

A teacher workspace for Enfield: daily Qur’an scores, memorisation targets, class setup, teacher profiles and a staff directory. Includes a Railway-ready PostgreSQL backend.

## Try it in Codex

The current preview is at **http://127.0.0.1:3000**. It runs on this computer; it is not deployed to Railway.

- Choose **Open sample class** to use fictional records without creating an account. These changes stay in browser local storage.
- Choose **Sign up** to test the full account and empty-class flow. Use the local teacher access code **SAFAR-PREVIEW**, any test email, and a password of at least 12 characters. Test accounts persist in the local preview database, with hashed passwords.
- The class editor starts with two student rows. Add names and houses, use **Add a student** for more, then **Save changes**.
- In **Qur’an**, select a box and choose a **score** from 1–5. These numbers are scores, not counts of passes. The picker also accepts number keys.
- In **Memorisation**, choose a level and target, then record the pass. The box shows a code such as **L1T4**. There is no numeric score: an entry is either a passed target or blank. **Clear entry** returns either tracker to blank.
- Houses are **Makkah**, **Al-Aqsa** and **Madinah**.
- The arrows or left/right keyboard keys move between days; mobile users can also tap the date strip or swipe across the tracker. **Today** returns to the current date.
- The calendar button fades to a twelve-month view; selecting a day reopens the tracker. The pencil edits the class.
- Use the lower sidebar toggle to expand or collapse navigation. Phones use bottom navigation and larger entry sheets.
- Open **Profile** to change your name, photo and short bio, or toggle dark mode. The theme follows the device initially and saves your choice to your account.
- **Teachers** shows searchable teacher profiles for signed-in users. The sample class cannot access the directory. Teachers cannot view one another’s students or records.
- New accounts receive a short tutorial. Replay it with **Show tutorial** in the profile menu.

If the preview stops, double-click `MySafar-preview.command` in the parent outputs folder, or ask Codex to restart it. It uses the bundled Node runtime if Node is not installed on your PATH. A server already using port 3000 must be stopped before starting a second one.

The Codex launcher stores local preview data in the chat’s `work/preview-db` directory, outside this source package. The production database is not connected.

## Run from another checkout

Requires Node 22 or newer and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

This creates a local PGlite database under ignored `.local-preview/db`. PGlite runs PostgreSQL in a local embedded runtime. Production uses the `pg` client against a real PostgreSQL server. The browser has no direct database connection or database credentials.

## Deploy to Railway through GitHub

1. Put the contents of this source folder into a private GitHub repository. Include `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, the Dockerfile, `railway.json`, `server`, and `dist`. Exclude `node_modules`, `.env`, `.local-preview`, and `.openai`.
2. In Railway, create a project and add a PostgreSQL service. Add an application service from the GitHub repository.
3. Generate a domain for the application service. Set these variables on that service:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Reference the PostgreSQL service’s `DATABASE_URL` variable using Railway’s variable picker. Prefer the project’s private connection. |
| `APP_ORIGIN` | The exact HTTPS app origin, such as `https://your-app.up.railway.app`, with no trailing slash. |
| `TEACHER_INVITE_CODE` | A new long, random school access code, shared privately with approved teachers. Do not use the preview code. |
| `NODE_ENV` | `production` |

4. Leave `DEMO_MODE` and `PREVIEW_DB_PATH` unset. The server also disables sample mode in production regardless of `DEMO_MODE`.
5. Deploy. Railway uses the Dockerfile, provides `PORT`, and checks `/api/health`. Tables are created on first startup. Deployments fail closed if the database, HTTPS origin, or teacher access code is missing.
6. Create a teacher account with the school code, add a class, and check a score persists after logging out and in again.

No GitHub repository was created and no Railway service was changed in this build. Railway configuration and a live PostgreSQL deployment still need to be supplied and verified.

Railway documentation: [PostgreSQL](https://docs.railway.com/databases/postgresql), [service variables](https://docs.railway.com/variables), [Dockerfile deployment](https://docs.railway.com/guides/dockerfiles).

## Data and authentication

- Passwords are salted and hashed with asynchronous scrypt (N=32768, r=8, p=1), never saved as plaintext.
- Random session tokens are hashed in PostgreSQL. Browser sessions use HttpOnly, SameSite=Strict cookies; production additionally uses Secure and the `__Host-` cookie prefix. Sessions expire after 12 hours and are revoked on logout.
- Every class and score operation checks the authenticated teacher ID on the server. Students use a composite owner/student key. Another teacher’s ID cannot be used to edit their records.
- Registration requires the school invitation code. Login and signup are rate-limited through database counters. Registration is invitation-based; email delivery, email verification, and password reset are not implemented in this first tracker version.
- Mutations require a same-origin JSON request. Validation rejects invalid dates, out-of-range scores, duplicate student IDs, empty fields, and oversized requests.
- Class edits run in a transaction. Renaming a student preserves their scores. Removing a student permanently removes their scores only after the editor’s explicit confirmation.
- Teacher photos are normalised to 256 × 256 JPEG on the server, with metadata stripped, and stored in PostgreSQL. Photo access requires a teacher session. JPG, PNG and WebP uploads are supported.
- The directory exposes only teacher names, bios, photos and the Enfield branch label. Email addresses, password hashes and student data are excluded.
- The database schema is in `server/schema.sql`. Database connection settings stay in environment variables. Do not commit production credentials.

## Memorisation curriculum and existing records

The server and UI share `server/curriculum.json` and enforce these limits:

| Level | Final target |
| --- | --- |
| L1 | T9 |
| L2 | T9 |
| L3 | T9 |
| L4 | T9 |
| L5 | T10 |
| L6 | T8 |
| L7 | T10 |
| L8 | T12 |

Memorisation passes use a separate `memorisation_passes` table. Schema changes run safely on startup against an existing installation. Any old numeric memorisation scores remain in the original `scores` table for recovery; they are not converted into fabricated level/target passes or shown as valid passes. Existing teacher profiles receive default preferences and the tutorial. Existing class records with other house names remain intact until the teacher selects a valid house in the editor.

## Design decisions

- Uses the supplied Safar logo without redrawing it. MySafar is the product name.
- Rounded panels and controls, cool neutral surfaces, dark blue primary buttons, and restrained blue accents from the brand.
- System typography: San Francisco on Apple devices, Segoe UI on Windows. No original website or font file was supplied, so this is an intentional first-version choice.
- Score colours run from pastel red, through peach and amber, to olive and green. Every colour has a numeric label.
- Day changes fade student identities, move the date columns, then restore the identities. Calendar changes crossfade; the sidebar expands; buttons have hover and press feedback.
- Respects reduced-motion preferences. Native dialogs provide focus containment and Escape dismissal. The full seven-day layout appears on desktop, with names and houses centred and distant dates faded. Phones focus on the active day with a seven-day date strip, persistent bottom navigation and entry sheets.
- Light and dark palettes cover the login page, tracker, calendar, editors, profile, directory and tutorial.
- No third-party analytics, external font downloads, gradients, or generated imagery.

## Verification

`pnpm test` runs 16 integration/security tests against an isolated in-memory PostgreSQL-compatible PGlite instance. All passed during this build:

- Password hash salting and verification; calendar date validation.
- Static file serving and blocking sensitive source paths.
- Authentication requirements and cross-origin mutation rejection.
- Invitation checks, session cookie flags, and hashed token storage.
- Account isolation, class validation, and score ownership checks.
- Qur’an score range validation, subject separation, clearing, and persistence.
- All eight memorisation level boundaries and rejection of numeric or invalid passes.
- Preservation of legacy numeric memorisation records without interpreting them as passes.
- Profile preferences, teacher directory privacy and search, photo validation, normalisation and authenticated access.
- Class edits preserving scores and removal cascading correctly.
- Logout invalidation, login recovery, throttling, and expired sessions.

Browser checks covered the login screen, local account authentication, class setup and house choices, score entry, memorisation level/target limits and reload persistence, day navigation, calendar selection, sidebar expansion, the tutorial, saved theme preferences, profile photo upload and bio persistence, the teacher directory, and the 390-pixel mobile layout. The Railway container and a remote PostgreSQL connection have not been exercised yet.
