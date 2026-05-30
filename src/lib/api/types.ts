/**
 * Shared API types
 */

export type Role = 'admin' | 'school_admin' | 'teacher' | 'student';

export interface AuthUser {
  id: number | string;
  email: string;
  role: Role;
  isSuperAdmin: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  role: Role;
  tenantId?: string;
  isSuperAdmin?: boolean;
}

export type RefreshRequest = Record<string, never>;

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}
