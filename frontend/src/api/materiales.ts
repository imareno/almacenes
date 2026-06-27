import api from '../utils/api';

export interface Material {
	id: number;
	codigo: string;
	nombre: string;
	descripcion?: string;
	categoria?: string;
	almacenId: number;
	almacenNombre?: string | null;
	active: boolean;
	createdAt: string;
}

export interface MaterialInput {
	codigo: string;
	nombre: string;
	descripcion?: string;
	categoria?: string;
	almacenId: number;
	active?: boolean;
}

interface MaterialesResponse {
	total: number;
	page: number;
	pageSize: number;
	items: Material[];
}

export const getMateriales = (params?: {
	almacenId?: number;
	buscar?: string;
	categoria?: string;
	soloActivos?: boolean;
	page?: number;
	pageSize?: number;
}): Promise<MaterialesResponse> => {
	const searchParams: Record<string, string | number | boolean> = {};
	if (params) {
		if (params.almacenId != null) searchParams.almacenId = params.almacenId;
		if (params.buscar) searchParams.buscar = params.buscar;
		if (params.categoria) searchParams.categoria = params.categoria;
		if (params.soloActivos != null) searchParams.soloActivos = params.soloActivos;
		if (params.page != null) searchParams.page = params.page;
		if (params.pageSize != null) searchParams.pageSize = params.pageSize;
	}
	return api.get('materiales', { searchParams }).json();
};

export const getMaterial = (id: number): Promise<Material> =>
	api.get(`materiales/${id}`).json();

export const createMaterial = (data: MaterialInput): Promise<{ id: number }> =>
	api.post('materiales', { json: data }).json();

export const updateMaterial = (id: number, data: MaterialInput): Promise<void> =>
	api.put(`materiales/${id}`, { json: data }).then(() => undefined);
