import { getDb } from "./db/database.js";
import type { User } from "../../shared/types/user.js";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  is_admin: number;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    isAdmin: row.is_admin === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
}): Promise<User> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await Bun.password.hash(params.password, "argon2id");

  getDb()
    .query(
      `INSERT INTO users (id, email, password_hash, display_name, is_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, params.email.toLowerCase(), passwordHash, params.displayName, params.isAdmin ? 1 : 0, now, now);

  return { id, email: params.email.toLowerCase(), displayName: params.displayName, isAdmin: params.isAdmin ?? false, createdAt: now, updatedAt: now };
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
  return Bun.password.verify(password, hash);
}
