# Run Connect with real collaboration

## Deploy on Zerops (Hackathon)

Connect ships with a `zerops-project-import.yaml` that creates the full stack
(PostgreSQL + backend API + Next.js frontend) in a single dashboard import.

### One-time setup

1. **Fill in the placeholders** in `zerops-project-import.yaml`:
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
   - `FRONTEND_URL` — your frontend subdomain, e.g. `https://frontend.connect.zerops.app`
   - `GOOGLE_CALLBACK_URL` — your api subdomain + `/api/auth/google/callback`
   - `NEXT_PUBLIC_API_URL` — your api subdomain + `/api`
   - `NEXT_PUBLIC_WS_URL` — same host as api, `wss://` scheme

2. **Import the project** — Zerops dashboard → Projects → "Import a project"
   → paste `zerops-project-import.yaml` → Deploy.

3. **Update Google Cloud Console** authorized redirect URIs to include
   `https://api.<your-project>.zerops.app/api/auth/google/callback`.

### Auto-deploy on push

After the first import:

1. Open the `api` service → Pipelines & CI/CD → connect GitHub repo →
   Trigger on push to `main` → setup name `api`.
2. Do the same for `frontend` → setup name `frontend`.

Every `git push` to `main` now rebuilds and redeploys both services with zero
downtime. Migrations run automatically on each backend deploy.

### Environment variable quick-reference

| Variable | Where | Value |
|---|---|---|
| `DATABASE_URL` | api | auto-injected by Zerops from `db` service |
| `GOOGLE_CLIENT_ID` | api | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | api | from Google Cloud Console |
| `FRONTEND_URL` | api | `https://frontend.<project>.zerops.app` |
| `GOOGLE_CALLBACK_URL` | api | `https://api.<project>.zerops.app/api/auth/google/callback` |
| `NEXT_PUBLIC_API_URL` | frontend | `https://api.<project>.zerops.app/api` |
| `NEXT_PUBLIC_WS_URL` | frontend | `wss://api.<project>.zerops.app` |

---

Connect needs three long-running pieces: a Next.js frontend, the Express/WebSocket server, and PostgreSQL. SQLite is not suitable for a public deployment because each hosted instance has isolated, ephemeral disk.

## Local two-browser test

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL: `docker compose up -d postgres`.
3. Create the tables: `npx prisma migrate deploy`.
4. In terminal one run `npm run server`; in terminal two run `npm run dev`.
5. Open `http://localhost:3000`, create a document, click **Share**, choose **Make Public**, then copy the link. Open that copied link in another browser profile. Both cursors and edits should sync.

## Deploy on Railway

1. Push this repository to GitHub and create a Railway project from it.
2. Add a PostgreSQL service. Railway exposes `DATABASE_URL` to services in the project.
3. Add an API service from this repository. Set its start command to `npm run server`, build command to `npm ci && npx prisma generate`, and add `DATABASE_URL=${{Postgres.DATABASE_URL}}`. Run `npx prisma migrate deploy` once in the API service shell after its first deploy.
4. Generate an API public domain, for example `https://connect-api.up.railway.app`.
5. Add a frontend service from the same repository. Use build `npm ci && npx prisma generate && npm run build` and start `npm start`. Set `NEXT_PUBLIC_API_URL=https://connect-api.up.railway.app/api` and `NEXT_PUBLIC_WS_URL=wss://connect-api.up.railway.app` before deploying. Generate a public domain for it.
6. Redeploy the frontend after those public environment variables are set, then share the frontend URL with your friend.

Railway provides PostgreSQL connection variables to other project services, and its services are persistent web-service deployment targets. See [Railway PostgreSQL docs](https://docs.railway.com/databases/postgresql) and [Railway service docs](https://docs.railway.com/services).

## Security note

This version supports public, edit-enabled links for testing with friends. It does not yet include accounts, user-specific access control, or viewer-only links. Do not use it for sensitive documents until authentication and permissions are added.
