import express, { Request, Response } from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { encoding, decoding } from "lib0";
import { randomBytes } from "crypto";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

const prisma = new PrismaClient();
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

const currentUser = async (req: Request) => {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
};

app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
app.get("/api/auth/google/callback", passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/?auth=failed` }), async (req: Request, res: Response) => {
  const user = req.user as { id: string };
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) } });
  res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/callback?token=${token}`);
});
app.get("/api/auth/me", async (req: Request, res: Response) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Sign in required" });
  res.json(user);
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "connect-api" });
});

// In-Memory Documents Map for Yjs CRDT Sync
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

    // Save document state periodically to database
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

// WebSocket Message Types
const messageSync = 0;
const messageAwareness = 1;

// Setup WebSocket Server for Yjs Collaboration
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

  // Send initial sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  ws.send(encoding.toUint8Array(encoder));

  // Send current awareness states
  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        Array.from(awarenessStates.keys())
      )
    );
    ws.send(encoding.toUint8Array(awarenessEncoder));
  }

  // Handle incoming WebSocket messages
  ws.on("message", (message: ArrayBuffer) => {
    try {
      const buffer = new Uint8Array(message);
      const decoder = decoding.createDecoder(buffer);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === messageSync) {
        const replyEncoder = encoding.createEncoder();
        encoding.writeVarUint(replyEncoder, messageSync);
        syncProtocol.readSyncMessage(decoder, replyEncoder, doc, ws);
        if (encoding.length(replyEncoder) > 1) {
          ws.send(encoding.toUint8Array(replyEncoder));
        }
      } else if (messageType === messageAwareness) {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
      }
    } catch (err) {
      console.error("WS message processing error:", err);
    }
  });

  // Broadcast doc updates to all other clients in room
  const docUpdateHandler = (update: Uint8Array, origin: any) => {
    if (origin !== ws) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const buf = encoding.toUint8Array(encoder);
      conns.forEach((_, client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(buf);
        }
      });
    }
  };
  doc.on("update", docUpdateHandler);

  // Broadcast awareness updates
  const awarenessUpdateHandler = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: any
  ) => {
    const changedClients = added.concat(updated, removed);
    // Remember which awareness records belong to this socket so they disappear
    // immediately for every collaborator when the browser disconnects.
    if (origin === ws) changedClients.forEach((clientId) => controlledIds.add(clientId));
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
    );
    const buf = encoding.toUint8Array(encoder);
    conns.forEach((_, client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(buf);
      }
    });
  };
  awareness.on("update", awarenessUpdateHandler);

  ws.on("close", () => {
    doc.off("update", docUpdateHandler);
    awareness.off("update", awarenessUpdateHandler);
    awarenessProtocol.removeAwarenessStates(
      awareness,
      Array.from(controlledIds),
      null
    );
    conns.delete(ws);
    if (conns.size === 0) {
      rooms.delete(docId);
    }
  });
});

// REST API Endpoints

// Helper: Ensure user exists
const getOrCreateDefaultUser = async (name = "Anant", email = "anant@example.com") => {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`,
        color: "#6366f1",
      },
    });
  }
  return user;
};

// 1. Get or create current user profile
app.get("/api/users/me", async (req: Request, res: Response) => {
  try {
    const user = await getOrCreateDefaultUser();
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. List all documents for user
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

// 3. Create document
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
        members: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
      include: { owner: true, members: { include: { user: true } } },
    });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get single document details
app.get("/api/documents/:id", async (req: Request, res: Response) => {
  try {
    const docId = req.params.id as string;
    let doc = await prisma.document.findFirst({
      where: {
        OR: [{ id: docId }, { shareToken: docId }],
      },
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

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (doc.shareToken === docId && !doc.isPublic) {
      return res.status(403).json({ error: "This share link is not active" });
    }
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update / Rename document
app.patch("/api/documents/:id", async (req: Request, res: Response) => {
  try {
    const docId = req.params.id as string;
    const { title, isPublic, content } = req.body;

    const doc = await prisma.document.update({
      where: { id: docId },
      data: {
        ...(title !== undefined && { title }),
        ...(isPublic !== undefined && { isPublic }),
        ...(content !== undefined && { content }),
      },
    });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete document
app.delete("/api/documents/:id", async (req: Request, res: Response) => {
  try {
    const docId = req.params.id as string;
    await prisma.document.delete({ where: { id: docId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Add Comment
app.post("/api/documents/:id/comments", async (req: Request, res: Response) => {
  try {
    const docId = req.params.id as string;
    const { text, userName = "Collaborator" } = req.body;

    let user = await prisma.user.findFirst({ where: { name: userName } });
    if (!user) user = await getOrCreateDefaultUser(userName, `${userName.toLowerCase()}@example.com`);

    const comment = await prisma.comment.create({
      data: {
        documentId: docId,
        userId: user.id,
        text,
      },
      include: { user: true },
    });
    res.json(comment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Add Version History Snapshot
app.post("/api/documents/:id/versions", async (req: Request, res: Response) => {
  try {
    const docId = req.params.id as string;
    const { title, content, editedBy } = req.body;

    const version = await prisma.documentVersion.create({
      data: {
        documentId: docId,
        title: title || "Snapshot",
        content: content || "",
        editedBy: editedBy || "Anant",
      },
    });
    res.json(version);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Connect Collaboration & API Server running on port ${PORT}`);
});
