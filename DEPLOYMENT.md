# Run Connect with real collaboration

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
