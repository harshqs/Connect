# Connect — Complete Project Guide

This document is a full technical reference for the Connect project. Written so any AI assistant can pick up the project and continue work immediately.

---

## What Is Connect

Connect is a real-time collaborative document editor (like Google Docs). Multiple users open the same document and see each other's edits live, see each other's cursors, see who is typing, leave comments, and save version snapshots. Users sign in with Google OAuth.

**Live URLs:**
- Frontend (Vercel): https://connect-seven-ecru.vercel.app
- Backend API + WebSocket (Render): https://connect-y61u.onrender.com
- GitHub repo: https://github.com/harshqs/Connect (branch: main)

---

## Architecture

Two completely separate processes, same GitHub repo:

```
Browser
  ├── HTTPS  →  Vercel  (Next.js 16, port 443)
  │               src/app/        ← pages (App Router)
  │               src/components/ ← UI components
  │               src/lib/api.ts  ← all fetch calls to backend
  │
  ├── HTTPS REST  →  Render  (Express 5, port 10000)
  │                    server/index.ts ← ALL backend logic
  │
  └── WSS WebSocket  →  Render  (same server, path /yjs)
                           Yjs CRDT sync for real-time editing
```

The frontend uses NO Next.js API routes. Everything backend is in `server/index.ts`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.3.0, React 19.2.8, TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Rich text editor | TipTap v3 (StarterKit, Collaboration, CollaborationCursor, Highlight, Underline, CharacterCount, Link, Placeholder) |
| Real-time CRDT | Yjs 13.6.32 |
| WebSocket client | y-websocket 3.1.0 |
| Offline cache | y-indexeddb 9.0.12 |
| Backend | Express v5.2.1 |
| WebSocket server | ws 8.21.3 |
| Yjs server | y-protocols (sync + awareness), lib0 |
| ORM | Prisma 5.22.0 |
| Database | PostgreSQL (hosted on Render) |
| Auth | passport + passport-google-oauth20 |
| Session | Custom 30-day bearer token in localStorage |
| Icons | lucide-react 1.30.0 |
| Runtime | Node.js 24.14.1, tsx 4.23.11 |

---

## File Structure

```
Connect/
├── server/
│   └── index.ts                  ← Express API + WebSocket server (ALL backend)
├── prisma/
│   ├── schema.prisma             ← DB models
│   └── migrations/               ← SQL migration files
├── src/
│   ├── app/
│   │   ├── page.tsx              ← Landing page (/)
│   │   ├── layout.tsx            ← Root layout
│   │   ├── globals.css           ← Global styles
│   │   ├── dashboard/page.tsx    ← Dashboard (/dashboard)
│   │   ├── doc/[id]/page.tsx     ← Document editor (/doc/:id)
│   │   ├── auth/callback/page.tsx ← OAuth token handler
│   │   └── profile/setup/page.tsx ← New user profile setup
│   ├── components/
│   │   ├── collaboration/
│   │   │   ├── PresenceBar.tsx   ← Live avatars + typing indicator
│   │   │   └── ShareModal.tsx    ← Share link modal
│   │   └── editor/
│   │       ├── TipTapEditor.tsx  ← Main editor + Yjs wiring
│   │       ├── CommentSidebar.tsx
│   │       └── VersionHistory.tsx
│   └── lib/
│       ├── api.ts                ← All fetch functions + TS interfaces
│       └── prisma.ts             ← Prisma client singleton
├── package.json
├── .env.example
└── PROJECT_GUIDE.md              ← This file
```

---

## Environment Variables

### Render (backend) — set in Render dashboard
```
DATABASE_URL=postgresql://...
PORT=10000                          (Render sets automatically)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://connect-y61u.onrender.com/api/auth/google/callback
FRONTEND_URL=https://connect-seven-ecru.vercel.app
```

### Vercel (frontend) — set in Vercel dashboard
```
NEXT_PUBLIC_API_URL=https://connect-y61u.onrender.com/api
NEXT_PUBLIC_WS_URL=wss://connect-y61u.onrender.com
```

### Local development (.env)
```
DATABASE_URL="postgresql://connect:connect@localhost:5432/connect?schema=public"
PORT=1234
NEXT_PUBLIC_API_URL="http://localhost:1234/api"
NEXT_PUBLIC_WS_URL="ws://localhost:1234"
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL="http://localhost:1234/api/auth/google/callback"
FRONTEND_URL="http://localhost:3000"
```

---

## Database Schema

### User
```
id        String   UUID, PK
name      String
email     String   unique
googleId  String?  unique — Google OAuth ID
avatar    String?  — Google profile photo URL
color     String   — hex color for cursor/presence, default #6366f1
createdAt DateTime
updatedAt DateTime
```

### Session
```
id        String   UUID
token     String   unique — 32-byte random base64url, stored in browser localStorage as "connect-session"
userId    String   FK → User (cascade delete)
expiresAt DateTime — 30 days from creation
createdAt DateTime
```

### Document
```
id         String   UUID
title      String
content    String?  — plain text snapshot for dashboard preview cards
yState     Bytes?   — Y.encodeStateAsUpdate() binary, persisted for server restart recovery
isPublic   Boolean  — controls whether share link works
shareToken String?  unique — 18-byte random base64url used in share URLs
ownerId    String   FK → User
createdAt  DateTime
updatedAt  DateTime
```

### DocumentMember
```
id         String   UUID
documentId String   FK → Document
userId     String   FK → User
role       String   "owner" | "editor" | "viewer"
UNIQUE(documentId, userId)
```

### Comment
```
id         String   UUID
documentId String   FK → Document
userId     String   FK → User
text       String
resolved   Boolean  default false
createdAt  DateTime
```

### DocumentVersion
```
id         String   UUID
documentId String   FK → Document
title      String   e.g. "Version 1"
content    String   plain text at time of save
editedBy   String   display name of saver
createdAt  DateTime
```

---

## Authentication Flow

1. User clicks "Sign in with Google" → `GET /api/auth/google`
2. Passport redirects to Google consent
3. Google redirects to `GET /api/auth/google/callback`
4. Passport verifies, runs GoogleStrategy:
   - `prisma.user.upsert` by `googleId` (create or update name/email/avatar)
5. Server creates Session row, token = `randomBytes(32).toString("base64url")`
6. If `user.createdAt` is within last 10 seconds → `isNew = true`
7. Redirect to `FRONTEND_URL/auth/callback?token=TOKEN[&new=1]`
8. Frontend (`/auth/callback`) stores token in `localStorage["connect-session"]`
9. If `new=1` → redirect to `/profile/setup`, else → `/dashboard`
10. All API calls send `Authorization: Bearer TOKEN`
11. `currentUser(req)` helper in server.ts looks up Session by token, checks expiry, returns User

**Sign out:** `localStorage.removeItem("connect-session")` → redirect to `/`

---

## API Endpoints

All on `https://connect-y61u.onrender.com`

| Method | Path | Auth required | Notes |
|--------|------|---------------|-------|
| GET | /health | No | Returns `{ ok: true, service: "connect-api" }` |
| GET | /api/auth/google | No | Starts Google OAuth flow |
| GET | /api/auth/google/callback | No | Google OAuth callback |
| GET | /api/auth/me | Bearer | Returns current User object |
| PATCH | /api/auth/profile | Bearer | Update `name`, `color`, `avatar` |
| GET | /api/documents | Bearer | List owned + member + public docs |
| POST | /api/documents | Bearer | Create document, auto-adds owner membership |
| GET | /api/documents/:id | No | Fetch by UUID or shareToken |
| PATCH | /api/documents/:id | No* | Update title, isPublic, content |
| DELETE | /api/documents/:id | No* | Delete document |
| POST | /api/documents/:id/comments | No* | Add comment (uses userName from body) |
| POST | /api/documents/:id/versions | No* | Save version snapshot |

*No auth enforcement on individual doc operations — known bug.

---

## Real-Time Collaboration

### Server-side rooms (`server/index.ts`)

Each document has a room in memory:
```typescript
interface Room {
  doc: Y.Doc;                          // Yjs CRDT document
  awareness: Awareness;                // user presence states
  conns: Map<WebSocket, Set<number>>;  // socket → set of controlled awarenessIDs
}
```

**On WebSocket connect (`/yjs?docId=ID`):**
1. Load or create room (load `yState` from DB if exists)
2. Send Sync Step 1 to new client
3. Send current awareness states to new client

**On incoming message:**
- Type 0 (Sync): `syncProtocol.readSyncMessage()` → reply with missing updates
- Type 1 (Awareness): `applyAwarenessUpdate()` → triggers `awareness.on("update")`

**Doc update broadcast:** sends to all clients EXCEPT the sender (checked by `origin !== ws`)

**Awareness update broadcast:** sends to all clients EXCEPT the sender (`if (client === ws) return`) — this was fixed to prevent typing ghost bug.

**Auto-save:** debounced 2s after any doc update → `prisma.document.update({ yState, content })`

**On disconnect:** removes awareness states, deletes room if empty.

### Client-side (`TipTapEditor.tsx`)

```
useMemo → create Y.Doc (recreated only on documentId change)
useMemo → create sessionId = random string (stable for tab lifetime)
useEffect → create WebsocketProvider, IndexeddbPersistence
  → set awareness: { user: { name, color, avatar, sessionId }, isTyping: false }
  → listen awareness.on("change"):
      updateAwareness: filter out state.user.sessionId === sessionId (skip self)
      updateTypingNames: same filter
useEffect → when currentUser prop changes, update awareness user fields (no provider recreate)
useEffect → on editor.on("update"): set isTyping: true, clear after 1500ms
```

**Self-filtering logic:** Each browser tab generates a random `sessionId` on mount stored in `useMemo(()=>Math.random()..., [])`. This is embedded in the awareness `user` field. When reading awareness states, entries where `state.user.sessionId === sessionId` are skipped. This avoids showing yourself as "typing" on your own screen.

**KNOWN BUG:** The typing ghost is still occurring (see below).

---

## Pages

### `/` — Landing (`src/app/page.tsx`)
- On mount: calls `fetchCurrentUser()`. If session valid → redirect to `/dashboard`
- Shows marketing hero, "Get started with Google" and "Try without signing in" CTAs
- `useSearchParams` wrapped in `<Suspense>` for Next.js static generation compatibility
- Shows `?auth=failed` error banner

### `/dashboard` — Dashboard (`src/app/dashboard/page.tsx`)
- On mount: `fetchCurrentUser()` → if 401 → redirect to Google sign-in URL
- Profile menu (top-right): avatar button → dropdown → "Edit profile" modal + "Sign out"
- Edit profile modal: change display name, pick from 8 color presets → `PATCH /api/auth/profile`
- Document grid: cards with title, content preview, public/private badge, delete button, Open link
- Search filter, document count

### `/doc/[id]` — Editor (`src/app/doc/[id]/page.tsx`)
- Loads doc via `fetchDocumentById(docId)` (accepts UUID or shareToken)
- Tries `fetchCurrentUser()` on mount → falls back to `"Guest NNN"` from sessionStorage
- Header: back arrow, editable title (debounced save), PresenceBar, own avatar button, comments/history/share buttons
- Own avatar: shows Google photo or colored initial, tooltip on hover, click to change display name (prompt)
- Main: `<TipTapEditor>`
- Drawers: `<CommentSidebar>`, `<VersionHistory>`
- Modal: `<ShareModal>`

### `/auth/callback` — OAuth callback (`src/app/auth/callback/page.tsx`)
- Outer component is static shell with `<Suspense>` (required by Next.js for `useSearchParams`)
- Inner reads `?token` → stores in localStorage → redirects

### `/profile/setup` — Profile setup (`src/app/profile/setup/page.tsx`)
- Only shown to brand-new users (server sends `?new=1`)
- Shows Google avatar or colored initial preview
- Editable display name, 8 color swatches
- Save → `PATCH /api/auth/profile` → redirect to `/dashboard`
- "Skip for now" link

---

## Known Bugs

### 1. Typing ghost — UNRESOLVED (top priority)
**Symptom:** When User A types, BOTH users see each other as "typing" even when only one is actually typing.

**What was tried:**
1. Added `clientID` filter on client — didn't work, server was echoing awareness back
2. Fixed server to NOT echo awareness back to sender — still didn't fully resolve
3. Switched to `sessionId` (random string in awareness user state) for filtering — still reported as not working

**Current code state (commit 35f7ecf):**
- Server: awareness not echoed to sender ✓ (`if (client === ws) return`)
- Client: `sessionId = useMemo(() => Math.random().toString(36).slice(2), [])` 
- Awareness user state includes `sessionId`
- Filter: `if (state.user?.sessionId === sessionId) return`

**Likely remaining issue:** React StrictMode double-invokes effects in development. If Vercel is running Next.js in dev mode or if StrictMode causes the component to mount twice, a new `sessionId` is generated while the old one is still in the server's awareness map. Suggested fix: use `useRef` for sessionId instead of `useMemo`, or store it in `sessionStorage`.

```typescript
// Try this instead of useMemo:
const sessionIdRef = useRef<string | null>(null);
if (!sessionIdRef.current) sessionIdRef.current = Math.random().toString(36).slice(2);
const sessionId = sessionIdRef.current;
```

### 2. No auth on document mutations
`PATCH /api/documents/:id` and `DELETE /api/documents/:id` don't verify the caller owns the document.

### 3. Version restore is a no-op
"Restore" button just calls `alert()`. Needs to apply content to the Yjs doc.

### 4. Comments use userName string not session
Comments are attributed by name lookup, not by session token.

---

## Local Development

```bash
git clone https://github.com/harshqs/Connect
cd Connect
npm install
cp .env.example .env          # fill in GOOGLE_CLIENT_ID and SECRET
docker compose up -d postgres
npx prisma migrate deploy
npm run server                 # terminal 1 — backend on :1234
npm run dev                    # terminal 2 — frontend on :3000
```

Health check: http://localhost:1234/health

---

## Deployment

### Render
- Build: `npm ci --include=dev && npx prisma generate`
- Start: `npx prisma migrate deploy && npm run server`
- Auto-deploys on push to `main`

### Vercel
- Build: `npm ci --include=dev && npx prisma generate && npm run build`
- Auto-deploys on push to `main`

### Google OAuth (Cloud Console)
- Authorized JavaScript origins: `https://connect-seven-ecru.vercel.app`
- Authorized redirect URIs: `https://connect-y61u.onrender.com/api/auth/google/callback`
