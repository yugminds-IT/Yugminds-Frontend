// Server components only (reads BACKEND_URL directly).
import { backendRequest } from '@/lib/backend-client';

/** Server-side catalog read; a backend hiccup renders an empty state instead of a 500. */
export async function fetchCatalog<T>(path: string, fallback: T): Promise<T> {
  try {
    return await backendRequest<T>(path);
  } catch {
    return fallback;
  }
}
