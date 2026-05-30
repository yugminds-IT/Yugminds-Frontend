import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { ensureCsrfToken } from './src/lib/csrf-middleware'
import { ACCESS_TOKEN_COOKIE } from './src/lib/auth-cookie'

const PUBLIC_PATHS: RegExp[] = [
	// Root & YugMinds company pages
	/^\/$/,
	/^\/about(?:\/.*)?$/,
	/^\/divisions(?:\/.*)?$/,
	/^\/contact(?:\/.*)?$/,
	/^\/careers(?:\/.*)?$/,
	/^\/not-found(?:\/.*)?$/,
	// Robocoders public marketing pages
	/^\/robocoders(?:\/.*)?$/,
	// LMS auth pages (login, signup, password flows)
	/^\/lms\/login(?:\/.*)?$/,
	/^\/lms\/signup(?:\/.*)?$/,
	/^\/lms\/forgot-password(?:\/.*)?$/,
	/^\/lms\/reset-password(?:\/.*)?$/,
	/^\/lms\/update-password(?:\/.*)?$/,
	/^\/lms\/redirect(?:\/.*)?$/,
	/^\/lms\/auth\/callback(?:\/.*)?$/,
	/^\/lms\/student-registration(?:\/.*)?$/,
	// Public certificate verification (no login required)
	/^\/lms\/verify(?:\/.*)?$/,
	// Static assets & API
	/^\/_next\//,
	/^\/api\//,
	/^\/images\//,
	/^\/favicon/,
	/\.(css|js|json|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|mp4|webp)$/,
]

// Maps URL prefix → allowed roles (isSuperAdmin always passes).
const ROLE_ROUTES: { prefix: string; roles: string[] }[] = [
	{ prefix: '/lms/admin', roles: ['admin'] },
	{ prefix: '/lms/school-admin', roles: ['school_admin'] },
	{ prefix: '/lms/teacher', roles: ['teacher'] },
	{ prefix: '/lms/student', roles: ['student'] },
]

function isPublicPath(pathname: string) {
	return PUBLIC_PATHS.some((re) => re.test(pathname))
}

function addSecurityHeaders(response: NextResponse | Response): void {
	const r = response as NextResponse
	r.headers.set('X-Frame-Options', 'DENY')
	r.headers.set('X-Content-Type-Options', 'nosniff')
	r.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
}

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl

	if (isPublicPath(pathname)) {
		const response = NextResponse.next()
		addSecurityHeaders(response)
		ensureCsrfToken(response, req)
		return response
	}

	const routeRule = ROLE_ROUTES.find((r) => pathname.startsWith(r.prefix))
	if (!routeRule) {
		// Non-role-specific protected path — just apply headers.
		const response = NextResponse.next()
		addSecurityHeaders(response)
		ensureCsrfToken(response, req)
		return response
	}

	// --- Cryptographic JWT verification ---
	const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value
	if (!token) {
		const loginUrl = new URL('/lms/login', req.url)
		loginUrl.searchParams.set('next', pathname)
		return NextResponse.redirect(loginUrl)
	}

	const secret = process.env.JWT_ACCESS_SECRET
	if (!secret) {
		return NextResponse.redirect(new URL('/lms/login', req.url))
	}

	let payload: { role?: string; isSuperAdmin?: boolean } = {}
	try {
		const { payload: p } = await jwtVerify(
			token,
			new TextEncoder().encode(secret),
		)
		payload = p as typeof payload
	} catch {
		// Expired or tampered token — clear the stale cookie and redirect.
		const loginUrl = new URL('/lms/login', req.url)
		loginUrl.searchParams.set('next', pathname)
		const res = NextResponse.redirect(loginUrl)
		res.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' })
		return res
	}

	// Super-admins bypass role checks.
	const hasAccess =
		payload.isSuperAdmin ||
		(payload.role !== undefined && routeRule.roles.includes(payload.role))

	if (!hasAccess) {
		// Authenticated but wrong role — send to their own dashboard.
		const roleDashboard: Record<string, string> = {
			admin: '/lms/admin',
			school_admin: '/lms/school-admin',
			teacher: '/lms/teacher',
			student: '/lms/student',
		}
		const dest = payload.role ? (roleDashboard[payload.role] ?? '/lms/login') : '/lms/login'
		return NextResponse.redirect(new URL(dest, req.url))
	}

	const response = NextResponse.next()
	addSecurityHeaders(response)
	ensureCsrfToken(response, req)
	return response
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
