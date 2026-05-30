/**
 * Unified Account Creation Service
 * 
 * Delegates to the backend API for all account creation operations.
 * The backend handles auth user creation, profile setup, and role-specific records.
 */

import { adminApi } from './api/admin.api';

export interface CreateAccountParams {
  role: 'admin' | 'school_admin' | 'teacher' | 'student';
  email: string;
  password: string;
  full_name: string;
  
  school_id?: string;
  grade?: string;
  school_assignments?: Array<{
    school_id: string;
    grades_assigned: string[];
    subjects: string[];
  }>;
  phone?: string;
  address?: string;
  parent_name?: string;
  parent_phone?: string;
  qualification?: string;
  experience_years?: number;
  specialization?: string;
  permissions?: Record<string, unknown>;
  is_super_admin?: boolean;
}

export interface CreateAccountResult {
  success: boolean;
  userId?: string;
  data?: unknown;
  error?: string;
}

export class AccountCreationService {
  static async createAccount(params: CreateAccountParams): Promise<CreateAccountResult> {
    try {
      const validRoles = ['admin', 'school_admin', 'teacher', 'student'];
      if (!validRoles.includes(params.role)) {
        return {
          success: false,
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        };
      }

      const validation = this.validateRoleRequirements(params);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const { data } = await adminApi.createAccount(params as unknown as Record<string, unknown>);
      const result = data as { success?: boolean; userId?: string; error?: string; data?: unknown };

      if (result?.success === false) {
        return { success: false, error: result.error || 'Account creation failed' };
      }

      return {
        success: true,
        userId: result?.userId,
        data: result?.data ?? result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  private static validateRoleRequirements(params: CreateAccountParams): { valid: boolean; error?: string } {
    switch (params.role) {
      case 'student':
        if (!params.school_id) {
          return { valid: false, error: 'school_id is required for students' };
        }
        break;
      case 'teacher':
        if (!params.school_assignments || params.school_assignments.length === 0) {
          return { valid: false, error: 'school_assignments array is required for teachers' };
        }
        break;
      case 'school_admin':
        if (!params.school_id) {
          return { valid: false, error: 'school_id is required for school admins' };
        }
        break;
      case 'admin':
        break;
    }
    return { valid: true };
  }
}
