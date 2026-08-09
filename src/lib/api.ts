const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:1234/api";
export const googleSignInUrl = `${API_BASE}/auth/google`;
export const getAuthToken = () => typeof window === "undefined" ? null : window.localStorage.getItem("connect-session");
const authHeaders = () => getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {};

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

export interface DocumentItem {
  id: string;
  title: string;
  content?: string;
  isPublic: boolean;
  shareToken?: string;
  ownerId: string;
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
  if (!res.ok) throw new Error("Failed to fetch user");
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

export async function updateDocument(id: string, data: { title?: string; isPublic?: boolean; content?: string }): Promise<DocumentItem> {
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
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

export async function addComment(docId: string, text: string, userName?: string): Promise<Comment> {
  const res = await fetch(`${API_BASE}/documents/${docId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, userName }),
  });
  if (!res.ok) throw new Error("Failed to add comment");
  return res.json();
}

export async function createVersionSnapshot(docId: string, title: string, content: string, editedBy: string): Promise<DocumentVersion> {
  const res = await fetch(`${API_BASE}/documents/${docId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, editedBy }),
  });
  if (!res.ok) throw new Error("Failed to save version snapshot");
  return res.json();
}
