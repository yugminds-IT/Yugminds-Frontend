import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify, errors as joseErrors } from 'jose'
import { ensureCsrfToken } from './lib/csrf-middleware'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './lib/auth-cookie'
import {
	brandFromHostname,
	brandOrigin,
	HEADER_BRAND,
	HEADER_INTERNAL_PATH,
	HEADER_PUBLIC_PATH,
	isDevHost,
	normalizeHost,
	resolveBrand,
	routeForHost,
	shouldSkipHostPrefix,
	toPublicPath,
	type Brand,
} from './lib/brand-host'

const PUBLIC_PATHS: RegExp[] = [
	/^\/$/,
	/^\/about(?:\/.*)?$/,
	/^\/divisions(?:\/.*)?$/,
	/^\/work(?:\/.*)?$/,
	/^\/contact(?:\/.*)?$/,
	/^\/careers(?:\/.*)?$/,
	/^\/not-found(?:\/.*)?$/,
	/^\/robocoders(?:\/.*)?$/,
	/^\/lms\/login(?:\/.*)?$/,
	/^\/lms\/signup(?:\/.*)?$/,
	/^\/lms\/forgot-password(?:\/.*)?$/,
	/^\/lms\/reset-password(?:\/.*)?$/,
	/^\/lms\/update-password(?:\/.*)?$/,
	/^\/lms\/redirect(?:\/.*)?$/,
	/^\/lms\/auth\/callback(?:\/.*)?$/,
	/^\/lms\/student-registration(?:\/.*)?$/,
	/^\/lms\/verify(?:\/.*)?$/,
	/^\/_next\//,
	/^\/api\//,
	/^\/images\//,
	/^\/favicon/,
	/^\/sitemap\.xml$/,
	/^\/robots\.txt$/,
	/\.(css|js|json|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|mp4|webp)$/,
]

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

function withBrandHeaders(
	req: NextRequest,
	brand: Brand,
	publicPath: string,
	internalPath: string,
): Headers {
	const headers = new Headers(req.headers)
	headers.set(HEADER_BRAND, brand)
	headers.set(HEADER_PUBLIC_PATH, publicPath)
	headers.set(HEADER_INTERNAL_PATH, internalPath)
	return headers
}

function finish(
	response: NextResponse,
	req: NextRequest,
): NextResponse {
	addSecurityHeaders(response)
	ensureCsrfToken(response, req)
	return response
}

/** Absolute redirect URL; brand hosts use their https origin (proxy-safe). */
function publicUrl(req: NextRequest, brand: Brand | null, internalPath: string): URL {
	if (brand) return new URL(toPublicPath(brand, internalPath), brandOrigin(brand))
	return new URL(internalPath, req.url)
}

export async function middleware(req: NextRequest) {
	const hostname = normalizeHost(req.headers.get('host'))
	const publicPath = req.nextUrl.pathname
	const search = req.nextUrl.search
	const hostBrand = isDevHost(hostname) ? null : brandFromHostname(hostname)

	if (hostname === 'www.yugminds.org' && !shouldSkipHostPrefix(publicPath)) {
		const dest = new URL(publicPath, brandOrigin('yugminds'))
		dest.search = search
		return finish(NextResponse.redirect(dest, 308), req)
	}

	// Crawlers fetch /favicon.ico directly; serve the RoboCoders icon on its hosts.
	if (publicPath === '/favicon.ico' && (hostBrand === 'robocoders' || hostBrand === 'lms')) {
		const url = req.nextUrl.clone()
		url.pathname = '/robocoders-favicon.ico'
		return NextResponse.rewrite(url)
	}

	const route = routeForHost(hostBrand, publicPath)
	if (route.kind === 'redirect') {
		const dest = new URL(route.url)
		dest.search = search
		return finish(NextResponse.redirect(dest, route.status), req)
	}

	const needsRewrite = route.kind === 'rewrite'
	const internalPath = needsRewrite ? route.path : publicPath

	const brand: Brand = hostBrand ?? resolveBrand(hostname, internalPath)
	const requestHeaders = withBrandHeaders(req, brand, publicPath, internalPath)

	const respondNext = () => {
		if (needsRewrite) {
			const url = req.nextUrl.clone()
			url.pathname = internalPath
			return finish(
				NextResponse.rewrite(url, { request: { headers: requestHeaders } }),
				req,
			)
		}
		return finish(
			NextResponse.next({ request: { headers: requestHeaders } }),
			req,
		)
	}

	if (isPublicPath(internalPath)) {
		return respondNext()
	}

	const routeRule = ROLE_ROUTES.find((r) => internalPath.startsWith(r.prefix))
	if (!routeRule) {
		return respondNext()
	}

	const loginInternal = '/lms/login'
	const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value
	if (!token) {
		if (req.cookies.get(REFRESH_TOKEN_COOKIE)?.value) {
			return respondNext()
		}
		const loginUrl = publicUrl(req, hostBrand, loginInternal)
		loginUrl.searchParams.set('next', internalPath)
		return finish(NextResponse.redirect(loginUrl), req)
	}

	const secret = process.env.JWT_ACCESS_SECRET
	if (!secret) {
		return finish(
			NextResponse.redirect(publicUrl(req, hostBrand, loginInternal)),
			req,
		)
	}

	let payload: { role?: string; isSuperAdmin?: boolean } = {}
	try {
		const { payload: p } = await jwtVerify(
			token,
			new TextEncoder().encode(secret),
		)
		payload = p as typeof payload
	} catch (err) {
		const expired =
			err instanceof joseErrors.JWTExpired ||
			(typeof err === 'object' &&
				err !== null &&
				(err as { code?: string }).code === 'ERR_JWT_EXPIRED')
		const hasRefresh = Boolean(req.cookies.get(REFRESH_TOKEN_COOKIE)?.value)
		if (expired && hasRefresh) {
			return respondNext()
		}
		const loginUrl = publicUrl(req, hostBrand, loginInternal)
		loginUrl.searchParams.set('next', internalPath)
		const res = NextResponse.redirect(loginUrl)
		res.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' })
		return finish(res, req)
	}

	const hasAccess =
		payload.isSuperAdmin ||
		(payload.role !== undefined && routeRule.roles.includes(payload.role))

	if (!hasAccess) {
		const roleDashboard: Record<string, string> = {
			admin: '/lms/admin',
			school_admin: '/lms/school-admin',
			teacher: '/lms/teacher',
			student: '/lms/student',
		}
		const destInternal = payload.role
			? (roleDashboard[payload.role] ?? loginInternal)
			: loginInternal
		return finish(
			NextResponse.redirect(publicUrl(req, hostBrand, destInternal)),
			req,
		)
	}

	return respondNext()
}

export const config = {
	matcher: ['/((?!_next/static|_next/image).*)'],
}
