const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:1234/api";
export const googleSignInUrl = `${API_BASE}/auth/google`;
export const getAuthToken = () => typeof window === "undefined" ? null : window.localStorage.getItem("connect-session");
const authHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
}

export interface DocumentMember {
  id: string;
  userId: string;
  role: string;
  user: User;
}

export interface Comment {
  id: string;
  text: string;
  resolved: boolean;
  createdAt: string;
  user: User;
}

export interface DocumentVersion {
  id: string;
  title: string;
  content: string;
  editedBy: string;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  _count?: { documents: number };
}

export interface DocumentItem {
  id: string;
  title: string;
  content?: string;
  isPublic: boolean;
  isStarred: boolean;
  shareToken?: string;
  ownerId: string;
  folderId?: string | null;
  owner: User;
  members: DocumentMember[];
  comments?: Comment[];
  versions?: DocumentVersion[];
  createdAt: string;
  updatedAt: string;
  _count?: { comments: number };
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error(res.status === 401 ? "Sign in required" : "Failed to fetch user");
  return res.json();
}

export async function fetchDocuments(): Promise<DocumentItem[]> {
  const res = await fetch(`${API_BASE}/documents`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function createDocument(title?: string): Promise<DocumentItem> {
  const res = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to create document");
  return res.json();
}

export async function fetchDocumentById(id: string): Promise<DocumentItem> {
  const res = await fetch(`${API_BASE}/documents/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch document");
  return res.json();
}

export async function updateDocument(
  id: string,
  data: { title?: string; isPublic?: boolean; content?: string; folderId?: string | null; isStarred?: boolean }
): Promise<DocumentItem> {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update document");
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

export async function addComment(docId: string, text: string): Promise<Comment> {
  const res = await fetch(`${API_BASE}/documents/${docId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Failed to add comment");
  return res.json();
}

export async function updateProfile(data: { name?: string; color?: string; avatar?: string }): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

export interface ResearchResult {
  answer: string;
  sources: Array<{ title: string; url: string }>;
}

export async function researchDocument(documentId: string, question: string): Promise<ResearchResult> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ question }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Research request failed");
  return body;
}

export async function createVersionSnapshot(docId: string, title: string, content: string): Promise<DocumentVersion> {
  const res = await fetch(`${API_BASE}/documents/${docId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error("Failed to save version snapshot");
  return res.json();
}

// ─── Folder API ───────────────────────────────────────────────────────────────

export async function fetchFolders(): Promise<Folder[]> {
  const res = await fetch(`${API_BASE}/folders`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch folders");
  return res.json();
}

export async function createFolder(name: string): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create folder");
  return res.json();
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to rename folder");
  return res.json();
}

export async function deleteFolder(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete folder");
}

export async function toggleStar(docId: string, isStarred: boolean): Promise<DocumentItem> {
  return updateDocument(docId, { isStarred });
}

export async function moveToFolder(docId: string, folderId: string | null): Promise<DocumentItem> {
  return updateDocument(docId, { folderId });
}
