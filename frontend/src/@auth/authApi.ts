import api, { setGlobalHeaders } from '@/utils/api';
import { User } from '@auth/user';
import { PartialDeep } from 'type-fest';
import { jwtDecode } from 'jwt-decode';

const FOTO_BASE_URL = 'https://hades.oopp.gob.bo/media/';

type JwtClaims = {
	sub: string;
	unique_name: string;
	role: string;
	nombre?: string;
	foto?: string;
};

export type AuthSession = {
	access_token: string;
	user: User;
};

function toTitleCase(str: string): string {
	return str
		.toLowerCase()
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

export function mapUserFromToken(token: string): User {
	const claims = jwtDecode<JwtClaims>(token);
	const rawName = claims.nombre ?? claims.unique_name ?? claims.sub ?? 'Usuario';
	return {
		id: claims.sub ?? '',
		role: claims.role ?? null,
		displayName: toTitleCase(rawName),
		email: '',
		photoURL: claims.foto ? `${FOTO_BASE_URL}${claims.foto}` : '',
		shortcuts: [],
		settings: {},
		loginRedirectUrl: '/almacenes'
	};
}

export async function authSignIn(credentials: { username: string; password: string }): Promise<AuthSession> {
	const data = await api.post('auth/login', { json: credentials }).json<{ token: string }>();
	return { access_token: data.token, user: mapUserFromToken(data.token) };
}

export async function authSignInWithToken(accessToken: string): Promise<AuthSession | false> {
	try {
		const data = await api
			.post('auth/refresh', {
				headers: { Authorization: `Bearer ${accessToken}` },
				retry: 0
			})
			.json<{ token: string }>();
		setGlobalHeaders({ Authorization: `Bearer ${data.token}` });
		return { access_token: data.token, user: mapUserFromToken(data.token) };
	} catch {
		return false;
	}
}

export async function authRefreshToken(): Promise<Response> {
	return api.post('auth/refresh', { retry: 0 });
}

export async function authSignOut(): Promise<void> {
	try {
		await api.post('auth/logout');
	} catch {
		// Si falla el logout remoto igual limpiamos la sesión local
	}
}

export async function authSignUp(_data: {
	displayName: string;
	email: string;
	password: string;
}): Promise<AuthSession> {
	throw new Error('Registro no disponible en este sistema');
}

export async function authUpdateDbUser(_user: PartialDeep<User>): Promise<Response> {
	return Promise.resolve(new Response(null, { status: 200 }));
}

// Stubs para compatibilidad con providers no utilizados (AWS, Firebase)
export async function authGetDbUser(_userId: string): Promise<User> {
	throw new Error('No disponible');
}

export async function authGetDbUserByEmail(_email: string): Promise<User> {
	throw new Error('No disponible');
}

export async function authCreateDbUser(_user: PartialDeep<User>): Promise<User> {
	throw new Error('No disponible');
}
