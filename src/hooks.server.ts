import { redirect, type Handle } from '@sveltejs/kit';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type AdminTokenPayload = {
	token_type: 'admin';
	role: 'admin';
	exp: number;
};

export const handle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;
	const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
	const isAdminLoginRoute = pathname === '/admin/login';
	const adminToken = event.cookies.get('admin_token');
	const jwtSecret = event.platform?.env?.JWT_SECRET ?? readRuntimeJwtSecret();
	const adminClaims = adminToken && jwtSecret ? await verifyAdminToken(adminToken, jwtSecret) : null;

	event.locals.admin = adminClaims ? { role: 'admin' } : null;

	if (isAdminRoute && !isAdminLoginRoute && !adminClaims) {
		if (adminToken) {
			event.cookies.delete('admin_token', { path: '/' });
		}

		const target = `${event.url.pathname}${event.url.search}`;
		throw redirect(303, `/admin/login?redirect=${encodeURIComponent(target)}`);
	}

	if (isAdminLoginRoute && adminClaims) {
		throw redirect(303, '/admin');
	}

	return resolve(event);
};

async function verifyAdminToken(token: string, secret: string): Promise<AdminTokenPayload | null> {
	const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');

	if (!encodedHeader || !encodedPayload || !encodedSignature) {
		return null;
	}

	const isValid = await crypto.subtle.verify(
		'HMAC',
		await importJwtKey(secret),
		decodeBase64Url(encodedSignature),
		encoder.encode(`${encodedHeader}.${encodedPayload}`),
	);

	if (!isValid) {
		return null;
	}

	const payload = JSON.parse(
		decoder.decode(new Uint8Array(decodeBase64Url(encodedPayload)))
	) as AdminTokenPayload;

	if (
		payload.token_type !== 'admin' ||
		payload.role !== 'admin' ||
		typeof payload.exp !== 'number' ||
		payload.exp <= Math.floor(Date.now() / 1000)
	) {
		return null;
	}

	return payload;
}

function importJwtKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['verify']
	);
}

function decodeBase64Url(value: string): ArrayBuffer {
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));

	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes.buffer;
}

function readRuntimeJwtSecret(): string | undefined {
	const runtime = globalThis as typeof globalThis & {
		process?: {
			env?: Record<string, string | undefined>;
		};
	};

	return runtime.process?.env?.JWT_SECRET;
}
