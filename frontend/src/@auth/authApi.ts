import api, { setGlobalHeaders } from '@/utils/api';
import { User } from '@auth/user';
import { PartialDeep } from 'type-fest';

type BackendUser = {
	id: number;
	username: string;
	role: string;
};

type BackendAuthResponse = {
	token: string;
	user: BackendUser;
};

export type AuthSession = {
	access_token: string;
	user: User;
};

function mapUser(bu: BackendUser): User {
	return {
		id: String(bu.id),
		role: bu.role,
		displayName: bu.username,
		email: '',
		shortcuts: [],
		settings: {},
		loginRedirectUrl: '/'
	};
}

export async function authSignIn(credentials: { username: string; password: string }): Promise<AuthSession> {
	const data = await api.post('auth/login', { json: credentials }).json<BackendAuthResponse>();
	return { access_token: data.token, user: mapUser(data.user) };
}

export async function authSignInWithToken(accessToken: string): Promise<AuthSession | false> {
	try {
		const data = await api
			.post('auth/refresh', {
				headers: { Authorization: `Bearer ${accessToken}` },
				retry: 0
			})
			.json<BackendAuthResponse>();
		setGlobalHeaders({ Authorization: `Bearer ${data.token}` });
		return { access_token: data.token, user: mapUser(data.user) };
	} catch {
		return false;
	}
}

export async function authRefreshToken(): Promise<Response> {
	return api.post('auth/refresh', { retry: 0 });
}

// Sin registro propio — los usuarios los crea el admin
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
