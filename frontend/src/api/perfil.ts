import api from '../utils/api';

export interface PerfilItem {
	id: number;
	personaId: number;
	subAlmacenId: number;
	aprobadorId: string;
	aprobadorNombre?: string;
	aprobadorCargo?: string;
	subAlmacenNombre: string;
	sigla?: string;
	almacenId: number;
	almacenNombre: string;
}

export interface SubAlmacenPerfil {
	id: number;
	nombre: string;
	sigla?: string;
	almacenId: number;
	almacenNombre: string;
}

export interface PerfilSaveInput {
	subAlmacenIds: number[];
	aprobadorId: string;
	aprobadorNombre?: string;
	aprobadorCargo?: string;
}

export interface Aprobador {
	ci: string;
	nombreCompleto: string;
	relacionLaboral: number;
	cargoId: number;
	cargo: string;
	areaOrganizacionalId: number;
	areaOrganizacional: string;
	email?: string;
	username?: string;
}

export const getMyPerfil = (): Promise<{ items: PerfilItem[] }> =>
	api.get('perfil').json<{ items: PerfilItem[] }>();

export const getSubAlmacenesPerfil = (): Promise<{ items: SubAlmacenPerfil[] }> =>
	api.get('perfil/sub-almacenes').json<{ items: SubAlmacenPerfil[] }>();

export const savePerfil = (data: PerfilSaveInput): Promise<void> =>
	api.put('perfil', { json: data }).then(() => undefined);

export const getAprobadores = (): Promise<{ items: Aprobador[] }> =>
	api.get('perfil/aprobadores').json<{ items: Aprobador[] }>();
