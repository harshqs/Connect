import express, { Request, Response } from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { encoding, decoding } from "lib0";
import { randomBytes } from "crypto";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { execSync } from "child_process";

// Run DB migrations on startup using the CLI bundled in node_modules.
// This runs in the Node.js process where DATABASE_URL is available,
// and uses the pre-generated Prisma binary that matches the build container.
try {
  console.log("Running database migrations...");
  execSync("node node_modules/.bin/prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
  });
  console.log("Migrations complete.");
} catch (err) {
  // Log but don't crash — tables may already exist from a previous deploy.
  console.warn("Migration warning (non-fatal):", err);
}

// Use pg driver adapter so Prisma needs no native OpenSSL binary at runtime
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 1234;

app.use(cors());
app.use(express.json());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:1234/api/auth/google/callback",
}, async (_accessToken, _refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error("Google did not provide an email address"));
    const user = await prisma.user.upsert({
      where: { googleId: profile.id },
      update: { name: profile.displayName || email, email, avatar: profile.photos?.[0]?.value },
      create: { googleId: profile.id, name: profile.displayName || email, email, avatar: profile.photos?.[0]?.value, color: "#2b7c6a" },
    });
    done(null, user);
  } catch (error) { done(error as Error); }
}));
app.use(passport.initialize());

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const currentUser = async (req: Request) => {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
};

/**
 * Verify the caller is authenticated and has the required role on the document.
 * Throws with a Response-ready error if not. Returns { user, member } on success.
 *
 * requiredRoles defaults to ["owner", "editor", "viewer"] (any member).
 */
const authorizeDocAccess = async (
  req: Request,
  res: Response,
  docId: string,
  requiredRoles: string[] = ["owner", "editor", "viewer"]
): Promise<{ user: NonNullable<Awaited<ReturnType<typeof currentUser>>>; member: { role: string } } | null> => {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in required" });
    return null;
  }
  const member = await prisma.documentMember.findUnique({
    where: { documentId_userId: { documentId: docId, userId: user.id } },
  });
  if (!member || !requiredRoles.includes(member.role)) {
    res.status(403).json({ error: "You do not have permission to perform this action" });
    return null;
  }
  return { user, member };
};

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
app.get("/api/auth/google/callback", passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/?auth=failed` }), async (req: Request, res: Response) => {
  const user = req.user as { id: string; createdAt: Date };
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) } });
  const isNew = user.createdAt && (Date.now() - new Date(user.createdAt).getTime()) < 10_000;
  const redirect = `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/callback?token=${token}${isNew ? "&new=1" : ""}`;
  res.redirect(redirect);
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Sign in required" });
  res.json(user);
});

app.patch("/api/auth/profile", async (req: Request, res: Response) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Sign in required" });
  const { name, color, avatar } = req.body;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name !== undefined && { name: String(name).slice(0, 64) }),
      ...(color !== undefined && { color: String(color) }),
      ...(avatar !== undefined && { avatar: String(avatar) }),
    },
  });
  res.json(updated);
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "connect-api" });
});

// ─── Yjs / WebSocket real-time collaboration ──────────────────────────────────

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Map<WebSocket, Set<number>>;
}

const rooms = new Map<string, Room>();

const getOrCreateRoom = async (docId: string): Promise<Room> => {
  let room = rooms.get(docId);
  if (!room) {
    const doc = new Y.Doc();
    const storedDocument = await prisma.document.findUnique({ where: { id: docId }, select: { yState: true } });
    if (!storedDocument) throw new Error("Document not found");
    if (storedDocument.yState) Y.applyUpdate(doc, storedDocument.yState);
    const awareness = new awarenessProtocol.Awareness(doc);
    const conns = new Map<WebSocket, Set<number>>();

    let saveTimeout: NodeJS.Timeout | null = null;
    doc.on("update", (update: Uint8Array) => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          const textContent = doc.getXmlFragment("default").toString();
          await prisma.document.update({
            where: { id: docId },
            data: { yState: Buffer.from(Y.encodeStateAsUpdate(doc)), content: textContent, updatedAt: new Date() },
          }).catch(() => {});
        } catch (err) {
          console.error("Auto-save error:", err);
        }
      }, 2000);
    });

    room = { doc, awareness, conns };
    rooms.set(docId, room);
  }
  return room;
};

const messageSync = 0;
const messageAwareness = 1;

const wss = new WebSocketServer({ server, path: "/yjs" });

wss.on("connection", async (ws: WebSocket, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const docId = url.searchParams.get("docId") || "default-doc";

  let room: Room;
  try { room = await getOrCreateRoom(docId); }
  catch { ws.close(1008, "Document not found"); return; }
  const { doc, awareness, conns } = room;

  const controlledIds = new Set<number>();
  conns.set(ws, controlledIds);

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  ws.send(encoding.toUint8Array(encoder));

  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()))
    );
    ws.send(encoding.toUint8Array(awarenessEncoder));
  }

  ws.on("message", (message: ArrayBuffer) => {
    try {
      const buffer = new Uint8Array(message);
      const decoder = decoding.createDecoder(buffer);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === messageSync) {
        const replyEncoder = encoding.createEncoder();
        encoding.writeVarUint(replyEncoder, messageSync);
        syncProtocol.readSyncMessage(decoder, replyEncoder, doc, ws);
        if (encoding.length(replyEncoder) > 1) ws.send(encoding.toUint8Array(replyEncoder));
      } else if (messageType === messageAwareness) {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
      }
    } catch (err) {
      console.error("WS message processing error:", err);
    }
  });

  const docUpdateHandler = (update: Uint8Array, origin: any) => {
    if (origin !== ws) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const buf = encoding.toUint8Array(encoder);
      conns.forEach((_, client) => {
        if (client.readyState === WebSocket.OPEN) client.send(buf);
      });
    }
  };
  doc.on("update", docUpdateHandler);

  const awarenessUpdateHandler = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: any
  ) => {
    const changedClients = added.concat(updated, removed);
    if (origin === ws) changedClients.forEach((clientId) => controlledIds.add(clientId));
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
    );
    const buf = encoding.toUint8Array(encoder);
    conns.forEach((_, client) => {
      if (client === ws) return; // don't echo back to sender
      if (client.readyState === WebSocket.OPEN) client.send(buf);
    });
  };
  awareness.on("update", awarenessUpdateHandler);

  ws.on("close", () => {
    doc.off("update", docUpdateHandler);
    awareness.off("update", awarenessUpdateHandler);
    awarenessProtocol.removeAwarenessStates(awareness, Array.from(controlledIds), null);
    conns.delete(ws);
    if (conns.size === 0) rooms.delete(docId);
  });
});

// ─── Document REST API ────────────────────────────────────────────────────────

// Helper: Ensure default user exists (legacy / demo only)
const getOrCreateDefaultUser = async (name = "Anant", email = "anant@example.com") => {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { name, email, avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`, color: "#6366f1" },
    });
  }
  return user;
};

app.get("/api/users/me", async (req: Request, res: Response) => {
  try {
    const user = await getOrCreateDefaultUser();
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List documents
app.get("/api/documents", async (req: Request, res: Response) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in required" });
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
          { isPublic: true },
        ],
      },
      include: {
        owner: true,
        members: { include: { user: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json(documents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create document
app.post("/api/documents", async (req: Request, res: Response) => {
  try {
    const { title = "Untitled Document" } = req.body;
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in required" });

    const doc = await prisma.document.create({
      data: {
        title,
        ownerId: user.id,
        content: "",
        shareToken: randomBytes(18).toString("base64url"),
        members: { create: { userId: user.id, role: "owner" } },
      },
      include: { owner: true, members: { include: { user: true } } },
    });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single document (public, no auth required)
app.get("/api/documents/:id", async (req: Request, res: Response) => {
  try {
    const docId = req.params.id as string;
    let doc = await prisma.document.findFirst({
      where: { OR: [{ id: docId }, { shareToken: docId }] },
      include: {
        owner: true,
        members: { include: { user: true } },
        comments: { include: { user: true }, orderBy: { createdAt: "desc" } },
        versions: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!doc && docId === "demo") {
      const user = await getOrCreateDefaultUser();
      doc = await prisma.document.create({
        data: {
          id: "demo-doc-123",
          title: "🚀 Welcome to Connect Notepad",
          content: "Welcome to Connect! Start editing this real-time document together.",
          ownerId: user.id,
          shareToken: "demo-share",
          members: { create: { userId: user.id, role: "owner" } },
        },
        include: {
          owner: true,
          members: { include: { user: true } },
          comments: { include: { user: true } },
          versions: true,
        },
      });
    }

    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (doc.shareToken === docId && !doc.isPublic) {
      return res.status(403).json({ error: "This share link is not active" });
    }
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update document — requires owner or editor
app.patch("/api/documents/:id", async (req: Request, res: Response) => {
  try {
    const docId = req.params.id as string;
    const auth = await authorizeDocAccess(req, res, docId, ["owner", "editor"]);
    if (!auth) return;

    const { title, isPublic, content, folderId, isStarred } = req.body;
    const doc = await prisma.document.update({
      where: { id: docId },
      data: {
        ...(title !== undefined && { title }),
        ...(isPublic !== undefined && { isPublic }),
        ...(content !== undefined && { content }),
        // folderId and isStarred are per-user organization — only owner changes these
        ...(folderId !== undefined && auth.member.role === "owner" && { folderId: folderId || null }),
        ...(isStarred !== undefined && auth.member.role === "owner" && { isStarred }),
      },
    });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document — requires owner only
app.delete("/api/documents/:id", async (req: Request, res: Response) => {
  try {
    const docId = req.params.id as string;
    const auth = await authorizeDocAccess(req, res, docId, ["owner"]);
    if (!auth) return;

    await prisma.document.delete({ where: { id: docId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add comment — requires any membership; attribution via session token
app.post("/api/documents/:id/comments", async (req: Request, res: Response) => {
  try {
    const docId = req.params.id as string;
    const auth = await authorizeDocAccess(req, res, docId, ["owner", "editor", "viewer"]);
    if (!auth) return;

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Comment text is required" });

    const comment = await prisma.comment.create({
      data: { documentId: docId, userId: auth.user.id, text: String(text).slice(0, 1000) },
      include: { user: true },
    });
    res.json(comment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save version snapshot — requires owner or editor
app.post("/api/documents/:id/versions", async (req: Request, res: Response) => {
  try {
    const docId = req.params.id as string;
    const auth = await authorizeDocAccess(req, res, docId, ["owner", "editor"]);
    if (!auth) return;

    const { title, content } = req.body;
    const version = await prisma.documentVersion.create({
      data: {
        documentId: docId,
        title: title || "Snapshot",
        content: content || "",
        editedBy: auth.user.name, // use actual session user, not body field
      },
    });
    res.json(version);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Folder REST API ──────────────────────────────────────────────────────────

// List folders with document counts
app.get("/api/folders", async (req: Request, res: Response) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in required" });

    const folders = await prisma.folder.findMany({
      where: { ownerId: user.id },
      include: { _count: { select: { documents: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(folders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create folder
app.post("/api/folders", async (req: Request, res: Response) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in required" });

    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Folder name is required" });

    const folder = await prisma.folder.create({
      data: { name: String(name).slice(0, 64), ownerId: user.id },
      include: { _count: { select: { documents: true } } },
    });
    res.json(folder);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rename folder
app.patch("/api/folders/:id", async (req: Request, res: Response) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in required" });

    const folderId = req.params.id as string;
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.ownerId !== user.id) {
      return res.status(403).json({ error: "You do not have permission to rename this folder" });
    }

    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Folder name is required" });

    const updated = await prisma.folder.update({
      where: { id: folderId },
      data: { name: String(name).slice(0, 64) },
      include: { _count: { select: { documents: true } } },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete folder — documents inside go back to root (folderId = null via SetNull)
app.delete("/api/folders/:id", async (req: Request, res: Response) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in required" });

    const folderId = req.params.id as string;
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.ownerId !== user.id) {
      return res.status(403).json({ error: "You do not have permission to delete this folder" });
    }

    await prisma.folder.delete({ where: { id: folderId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`🚀 Connect Collaboration & API Server running on port ${PORT}`);
});
