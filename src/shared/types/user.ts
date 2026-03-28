export interface User {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isAuthorized: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MagicLink {
  token: string;
  email: string;
  displayName: string;
  isAuthorized: boolean;
  isAdmin: boolean;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface AdminUser extends User {
  hasPassword: boolean;
}

export interface InviteCode {
  code: string;
  label: string;
  isAuthorized: boolean;
  maxUses: number | null;
  useCount: number;
  createdBy: string;
  createdAt: string;
}
