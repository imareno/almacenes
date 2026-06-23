import api from '../utils/api';

export interface Material {
	id: number;
	codigo: string;
	nombre: string;
	descripcion?: string;
	unidadMedida: string;
	categoria?: string;
	active: boolean;
}

export const getMateriales = (params?: {
	buscar?: string;
	categoria?: string;
	soloActivos?: boolean;
	page?: number;
	pageSize?: number;
}): Promise<{ total: number; items: Material[] }> =>
	api.get('materiales', { searchParams: params as Record<string, string | number> }).json();
