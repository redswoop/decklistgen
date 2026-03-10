export interface User {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface InviteCode {
  code: string;
  createdBy: string;
  usedBy: string | null;
  createdAt: string;
  usedAt: string | null;
}
