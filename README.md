# YSRCP Narasaraopet

A responsive organizational management web app with a Node.js HTTP backend and persistent SQLite database. The repository began empty; this implementation establishes core authentication, access controls, directory, private messaging, and workflow records.

The visual theme is restricted to blue, white, and green, with neutral gray text and borders.

## Local setup

- Requires Node.js 22.5 or later (`node:sqlite` may be labelled experimental by Node).
- No npm packages are required.
- Copy `.env.example` to `.env` and set a strong `BOOTSTRAP_ADMIN_PASSWORD` before first launch. Optionally set `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_NAME`.
- Start with `node server.js` (or `npm.cmd start` in PowerShell), then open `http://127.0.0.1:3000`.

The first Super Admin is created only when there are no users and `BOOTSTRAP_ADMIN_PASSWORD` is configured. Passwords are salted and hashed with scrypt. Do not commit `.env`. SQLite data is stored in `data/ysrcp.sqlite` by default. The server binds to localhost unless `HOST` is changed.

## Node.js deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/saimanikantagit-blip/ysrcp-narasaraopet)

The Node.js backend is `server.js`; `npm start` runs it. `render.yaml` configures a Render web service with the `/api/health` health check, a generated initial Super Admin password, and a persistent disk mounted at `/var/data` for the SQLite database and private documents. The production server binds to `0.0.0.0` and uses the host-provided `PORT`.

To create a live deployment, sign in to Render, create a Blueprint from this public GitHub repository, review the service and persistent-disk plan and its charges, then deploy. Render provides the live `onrender.com` URL after the first successful deployment. Save the generated `BOOTSTRAP_ADMIN_PASSWORD` from the service environment and use login ID `admin`. GitHub stores the source; Render runs the Node.js backend. A persistent disk is required because Render preserves only files under the disk mount across deploys and restarts. See [Render web services](https://render.com/docs/web-services), [Blueprint configuration](https://render.com/docs/blueprint-spec), and [persistent disks](https://render.com/docs/disks).

## Data and permissions

SQLite schema creation runs at startup with foreign keys and WAL mode enabled. API access requires an active account. Only Super Admin can create accounts, directory contacts, and documents. User creation and edits validate names, login IDs, email, phone, status, and jurisdiction lengths on the server. Contact CSV import/export is admin-only; import validates required fields and skips phone/email duplicates, and export protects spreadsheet cells from formula execution. Super Admin creates each non-admin account with its login ID and password, and can set a replacement password later; affected active sessions are revoked. Sign-in uses the login ID and password only, with no OTP step. Passwords are scrypt-hashed, and sign-in attempts are throttled per client address in the running server process. Users cannot self-register or grant themselves a role. Conversation read and reply routes verify ownership on the server; only Super Admin can access the full inbox. Task progress, report review, issue status, and account changes are server-authorized and audited. Account changes notify the affected user; deactivation revokes their active sessions. In-app notifications are stored for message, announcement, assignment, task progress, and review events, with a live unread badge and linked navigation. Documents use private local storage, server-side audience and jurisdiction checks, restricted file types, a 5 MB size limit, and permission-checked downloads. Set non-admin users' `jurisdiction` to the same canonical value used by jurisdiction-scoped records. Mandal-Level In-Charges can also access records scoped to active villages under their assigned Mandal. Accounts without an assigned jurisdiction see only global records and their own submissions or assignments.

Seven roles are represented. `MBTC/MPTC Representative` remains a provisional label pending confirmation of the official designation. The interface uses a neutral text mark; provide approved brand assets and role terminology before production use.

## Production preparation

This is a local-first application foundation, not a deployed production service. Before production, deploy behind HTTPS, replace in-memory sessions and per-process rate limits with persistent shared services, and implement a secure administrator-managed password recovery process and optional MFA (neither requires OTP at sign-in), and deployment-appropriate CSRF protection. Move private documents to approved object storage. Configure database access controls, encrypted backups, monitoring, retention, and restore drills. Confirm the approved hierarchy, seventh role designation, branding, privacy basis, retention rules, and jurisdiction values.

The social media module provides draft, review, approval, manual scheduling, and manually recorded publication statuses. It does not upload media or connect to external platforms; “Published” is a user-recorded status, not a verified platform result. Announcements support role and jurisdiction targeting, scheduled publication and expiry. Mandal and Village units are persisted, parent-linked, and deactivated instead of deleted; account and contact forms suggest configured unit names. Reports and issues can be filtered and exported by authorized administrators. Admin analytics summarize live accounts and workflow statuses with a 12-month activity view; report review history, task progress notes, and issue assignment/resolution notes are persisted. Excel-native import/export, attachments on workflow records and private messages, push notifications, external social media integrations, and Android packaging remain to be implemented. No production credentials, official artwork, or organizational records are included.

## Backup and recovery

Stop the service before copying the SQLite database, WAL sidecars, and the `data/private-documents/` directory (or the equivalent path beside the configured database), or use SQLite's online backup API and copy the document store through an approved operations procedure. The database and document files must be captured from the same backup point. Store encrypted backups separately with restricted access. For restore, stop the service, restore both data stores and permissions, restart, then verify `/api/health` and authorized account access.

## Application settings

Super Admin can set the organization contact email, phone, and office address, and choose from the approved blue and green palettes. Signed-in users see the configured contact details in the workspace sidebar, and saved changes refresh those details immediately. Settings are recorded in SQLite and changes are included in the audit log.

## Android installation

The responsive web app can be installed as a Progressive Web App from a supported Android browser. Deploy it over HTTPS, open the site in Chrome, then use the browser menu's Install app or Add to Home screen action. The service worker caches only the public app shell and static assets; all API requests and private organizational data remain network-only. This provides an installable Android web experience, not a native Android package.

## Task deadline notifications

The server checks assigned tasks at startup and every minute. It sends one due-soon notification on the due date or the day before, then at most one overdue reminder per day until the task is submitted, completed, or cancelled. Reminders go to the assigned user and task creator when their accounts are active.