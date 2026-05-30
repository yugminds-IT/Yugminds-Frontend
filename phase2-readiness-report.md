## Phase 2 Readiness Audit (Auth / Multi-tenancy / Security / Token Handling)

This file mirrors the backend report for easier frontend-side review of the auth + token contract.

Date: 2026-03-23

### Key takeaways (frontend perspective)
- Access token is stored in `localStorage` and `sessionStorage` under `session_token`.
- Refresh token is stored only in an httpOnly cookie (`refresh_token`) set by the backend.
- Axios request interceptor attaches `Authorization: Bearer <token>` to backend requests.
- axios response interceptor attempts token refresh on `401` (single in-flight refresh with queued retries) and redirects to `/login` only if refresh fails.
- Logout calls `/api/auth/logout` with the access token, then clears local storage/session storage.

