import api from '../utils/api';

// ─── Compras ──────────────────────────────────────────────────────────────────

export interface CompraListItem {
	id: number;
	numero?: string;
	proveedor: string;
	detalle: string;
	fecha: string;
	estado: string;
	subAlmacenId: number;
	subAlmacenNombre: string;
	createdAt: string;
}

export interface CompraDetail {
	id: number;
	numero?: string;
	proveedor: string;
	detalle: string;
	fecha: string;
	estado: string;
	subAlmacenId: number;
	subAlmacenNombre: string;
	almacenId: number;
	almacenNombre: string;
	createdAt: string;
}

export interface CompraCreateInput {
	proveedor: string;
	detalle: string;
	fecha: string;
	subAlmacenId: number;
}

interface PaginatedResponse {
	total: number;
	page: number;
	pageSize: number;
	items: CompraListItem[];
}

export const getCompras = (params?: {
	subAlmacenId?: number;
	estado?: string;
	page?: number;
	pageSize?: number;
}): Promise<PaginatedResponse> => {
	const sp: Record<string, string | number> = {};
	if (params?.subAlmacenId != null) sp.subAlmacenId = params.subAlmacenId;
	if (params?.estado) sp.estado = params.estado;
	if (params?.page != null) sp.page = params.page;
	if (params?.pageSize != null) sp.pageSize = params.pageSize;
	return api.get('compras', { searchParams: sp }).json<PaginatedResponse>();
};

export const getCompra = (id: number): Promise<{ compra: CompraDetail; items: CompraItem[] }> =>
	api.get(`compras/${id}`).json<{ compra: CompraDetail; items: CompraItem[] }>();

export const createCompra = (data: CompraCreateInput): Promise<{ id: number }> =>
	api.post('compras', { json: data }).json<{ id: number }>();

export const updateCompra = (id: number, data: CompraCreateInput): Promise<void> =>
	api.put(`compras/${id}`, { json: data }).then(() => undefined);

export const concluirCompra = (id: number): Promise<{ numero: string }> =>
	api.put(`compras/${id}/concluir`).json<{ numero: string }>();

export const deleteCompra = (id: number): Promise<void> =>
	api.delete(`compras/${id}`).then(() => undefined);

// ─── Compra Items ─────────────────────────────────────────────────────────────

export interface CompraItem {
	id: number;
	materialId: number;
	codigo: string;
	materialNombre: string;
	unidadMedida: string;
	cantidad: number;
	precioUnitario: number;
	subtotal: number;
}

export interface CompraItemInput {
	materialId: number;
	cantidad: number;
	precioUnitario: number;
	unidadMedida: string;
}

export const addCompraItem = (compraId: number, data: CompraItemInput): Promise<{ id: number }> =>
	api.post(`compras/${compraId}/items`, { json: data }).json<{ id: number }>();

export const updateCompraItem = (compraId: number, id: number, data: CompraItemInput): Promise<void> =>
	api.put(`compras/${compraId}/items/${id}`, { json: data }).then(() => undefined);

export const deleteCompraItem = (compraId: number, id: number): Promise<void> =>
	api.delete(`compras/${compraId}/items/${id}`).then(() => undefined);
