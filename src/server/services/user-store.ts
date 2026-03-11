import { getDb } from "./db/database.js";
import type { User, AdminUser } from "../../shared/types/user.js";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  is_admin: number;
  is_authorized: number;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    isAdmin: row.is_admin === 1,
    isAuthorized: row.is_authorized === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAdminUser(row: UserRow): AdminUser {
  return {
    ...rowToUser(row),
    hasPassword: row.password_hash !== "",
  };
}

export function getUserCount(): number {
  const row = getDb().query("SELECT COUNT(*) as count FROM users").get() as { count: number };
  return row.count;
}

export async function createUser(params: {
  email: string;
  password: string;
  displayName: string;
  isAdmin?: boolean;
  isAuthorized?: boolean;
}): Promise<User> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await Bun.password.hash(params.password, "argon2id");

  getDb()
    .query(
      `INSERT INTO users (id, email, password_hash, display_name, is_admin, is_authorized, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, params.email.toLowerCase(), passwordHash, params.displayName, params.isAdmin ? 1 : 0, params.isAuthorized ? 1 : 0, now, now);

  return {
    id,
    email: params.email.toLowerCase(),
    displayName: params.displayName,
    isAdmin: params.isAdmin ?? false,
    isAuthorized: params.isAuthorized ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createUserWithoutPassword(params: {
  email: string;
  displayName: string;
  isAdmin?: boolean;
  isAuthorized?: boolean;
}): User {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  getDb()
    .query(
      `INSERT INTO users (id, email, password_hash, display_name, is_admin, is_authorized, created_at, updated_at)
       VALUES (?, ?, '', ?, ?, ?, ?, ?)`
    )
    .run(id, params.email.toLowerCase(), params.displayName, params.isAdmin ? 1 : 0, params.isAuthorized ? 1 : 0, now, now);

  return {
    id,
    email: params.email.toLowerCase(),
    displayName: params.displayName,
    isAdmin: params.isAdmin ?? false,
    isAuthorized: params.isAuthorized ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function findUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const row = getDb().query("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRow | null;
  if (!row) return null;
  return { ...rowToUser(row), passwordHash: row.password_hash };
}

export function findUserById(id: string): User | null {
  const row = getDb().query("SELECT * FROM users WHERE id = ?").get(id) as UserRow | null;
  if (!row) return null;
  return rowToUser(row);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return Bun.password.verify(password, hash);
}

export function setPassword(userId: string, passwordHash: string): void {
  const now = new Date().toISOString();
  getDb()
    .query("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .run(passwordHash, now, userId);
}

export function listAllUsers(): AdminUser[] {
  const rows = getDb().query("SELECT * FROM users ORDER BY created_at DESC").all() as UserRow[];
  return rows.map(rowToAdminUser);
}

export function setUserAuthorized(userId: string, authorized: boolean): User | null {
  const now = new Date().toISOString();
  getDb()
    .query("UPDATE users SET is_authorized = ?, updated_at = ? WHERE id = ?")
    .run(authorized ? 1 : 0, now, userId);
  return findUserById(userId);
}

export function setUserAdmin(userId: string, isAdmin: boolean): User | null {
  const now = new Date().toISOString();
  getDb()
    .query("UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?")
    .run(isAdmin ? 1 : 0, now, userId);
  return findUserById(userId);
}

export function deleteUser(userId: string): boolean {
  const result = getDb().query("DELETE FROM users WHERE id = ?").run(userId);
  return result.changes > 0;
}
