import api from '../utils/api';

export interface Almacen {
	id: number;
	nombre: string;
	descripcion?: string;
	parentId?: number | null;
	active: boolean;
}

export interface AlmacenInput {
	nombre: string;
	descripcion?: string;
	parentId?: number | null;
	active?: boolean;
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
