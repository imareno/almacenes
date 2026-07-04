import api from '../utils/api';

export interface PerfilItem {
	id: number;
	personaId: number;
	subAlmacenId: number;
	aprobadorId: number;
	subAlmacenNombre: string;
	sigla?: string;
	almacenId: number;
	almacenNombre: string;
	aprobadorNombre: string;
	aprobadorRole: string;
}

export interface SubAlmacenPerfil {
	id: number;
	nombre: string;
	sigla?: string;
	almacenId: number;
	almacenNombre: string;
}

export interface Usuario {
	id: number;
	username: string;
	role: string;
}

export interface PerfilSaveInput {
	subAlmacenIds: number[];
	aprobadorId: number;
}

export const getMyPerfil = (): Promise<{ items: PerfilItem[] }> =>
	api.get('perfil').json<{ items: PerfilItem[] }>();

export const getSubAlmacenesPerfil = (): Promise<{ items: SubAlmacenPerfil[] }> =>
	api.get('perfil/sub-almacenes').json<{ items: SubAlmacenPerfil[] }>();

export const savePerfil = (data: PerfilSaveInput): Promise<void> =>
	api.put('perfil', { json: data }).then(() => undefined);

export const getUsuarios = (): Promise<{ items: Usuario[] }> =>
	api.get('perfil/usuarios').json<{ items: Usuario[] }>();
