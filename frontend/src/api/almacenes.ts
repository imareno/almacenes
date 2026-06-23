import api from '../utils/api';

// ─── Almacenes ────────────────────────────────────────────────────────────────

export interface Almacen {
	id: number;
	nombre: string;
	descripcion?: string;
	active: boolean;
}

export interface AlmacenInput {
	nombre: string;
	descripcion?: string;
}

export const getAlmacenes = (soloActivos = false): Promise<Almacen[]> =>
	api.get('almacenes', { searchParams: { soloActivos } }).json<Almacen[]>();

export const getAlmacen = (id: number): Promise<Almacen> =>
	api.get(`almacenes/${id}`).json<Almacen>();

export const createAlmacen = (data: AlmacenInput): Promise<Almacen> =>
	api.post('almacenes', { json: data }).json<Almacen>();

export const updateAlmacen = (id: number, data: AlmacenInput): Promise<Almacen> =>
	api.put(`almacenes/${id}`, { json: data }).json<Almacen>();

export const deleteAlmacen = (id: number): Promise<void> =>
	api.delete(`almacenes/${id}`).then(() => undefined);

// ─── Sub-Almacenes ────────────────────────────────────────────────────────────

export interface SubAlmacen {
	id: number;
	almacenId: number;
	nombre: string;
	sigla?: string;
	descripcion?: string;
	active: boolean;
}

export interface SubAlmacenInput {
	nombre: string;
	sigla?: string;
	descripcion?: string;
}

export const getSubAlmacenes = (almacenId: number, soloActivos = false): Promise<SubAlmacen[]> =>
	api.get(`almacenes/${almacenId}/sub-almacenes`, { searchParams: { soloActivos } }).json<SubAlmacen[]>();

export const createSubAlmacen = (almacenId: number, data: SubAlmacenInput): Promise<SubAlmacen> =>
	api.post(`almacenes/${almacenId}/sub-almacenes`, { json: data }).json<SubAlmacen>();

export const updateSubAlmacen = (almacenId: number, id: number, data: SubAlmacenInput): Promise<SubAlmacen> =>
	api.put(`almacenes/${almacenId}/sub-almacenes/${id}`, { json: data }).json<SubAlmacen>();

export const deleteSubAlmacen = (almacenId: number, id: number): Promise<void> =>
	api.delete(`almacenes/${almacenId}/sub-almacenes/${id}`).then(() => undefined);

// ─── Asignaciones (almacenes + sub-almacenes del usuario actual) ──────────────

export interface AlmacenAsignado {
	id: number;
	nombre: string;
	descripcion?: string;
	subAlmacenes: { id: number; nombre: string; sigla?: string }[];
}

export const getAlmacenesAsignados = (): Promise<AlmacenAsignado[]> =>
	api.get('almacenes/asignados').json<AlmacenAsignado[]>();
