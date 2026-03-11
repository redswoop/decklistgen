import { getDb } from "./db/database.js";
import type { MagicLink } from "../../shared/types/user.js";

const LINK_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface MagicLinkRow {
  token: string;
  email: string;
  display_name: string;
  is_authorized: number;
  is_admin: number;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

function rowToMagicLink(row: MagicLinkRow): MagicLink {
  return {
    token: row.token,
    email: row.email,
    displayName: row.display_name,
    isAuthorized: row.is_authorized === 1,
    isAdmin: row.is_admin === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  };
}

export function createMagicLink(params: {
  email: string;
  displayName: string;
  isAuthorized?: boolean;
  isAdmin?: boolean;
  createdBy: string;
}): MagicLink {
  const token = generateToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + LINK_EXPIRY_MS).toISOString();

  getDb()
    .query(
      `INSERT INTO magic_links (token, email, display_name, is_authorized, is_admin, created_by, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      token,
      params.email.toLowerCase(),
      params.displayName,
      params.isAuthorized ? 1 : 0,
      params.isAdmin ? 1 : 0,
      params.createdBy,
      now,
      expiresAt
    );

  return {
    token,
    email: params.email.toLowerCase(),
    displayName: params.displayName,
    isAuthorized: params.isAuthorized ?? false,
    isAdmin: params.isAdmin ?? false,
    createdBy: params.createdBy,
    createdAt: now,
    expiresAt,
    usedAt: null,
  };
}

export function findMagicLink(token: string): MagicLink | null {
  const row = getDb()
    .query("SELECT * FROM magic_links WHERE token = ?")
    .get(token) as MagicLinkRow | null;
  if (!row) return null;
  return rowToMagicLink(row);
}

export function redeemMagicLink(token: string): MagicLink | null {
  const link = findMagicLink(token);
  if (!link) return null;
  if (link.usedAt) return null;
  if (new Date(link.expiresAt) < new Date()) return null;

  const now = new Date().toISOString();
  getDb()
    .query("UPDATE magic_links SET used_at = ? WHERE token = ?")
    .run(now, token);

  return { ...link, usedAt: now };
}

export function listMagicLinks(): MagicLink[] {
  const rows = getDb()
    .query("SELECT * FROM magic_links ORDER BY created_at DESC")
    .all() as MagicLinkRow[];
  return rows.map(rowToMagicLink);
}

export function deleteMagicLink(token: string): boolean {
  const result = getDb()
    .query("DELETE FROM magic_links WHERE token = ? AND used_at IS NULL")
    .run(token);
  return result.changes > 0;
}
