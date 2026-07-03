import api from '../utils/api';

// ─── Solicitudes ──────────────────────────────────────────────────────────────

export interface SolicitudListItem {
	id: number;
	numero: string;
	estado: string;
	solicitanteId: number;
	solicitante: string;
	almacenId: number;
	almacenNombre: string;
	aprobadorId?: number;
	aprobador?: string;
	almaceneroId?: number;
	almacenero?: string;
	fechaSolicitud: string;
	fechaAprobacion?: string;
	fechaDespacho?: string;
	fechaEntrega?: string;
	observacion?: string;
	createdAt: string;
}

export interface SolicitudDetail {
	id: number;
	numero: string;
	estado: string;
	solicitanteId: number;
	solicitante: string;
	almacenId: number;
	almacenNombre: string;
	aprobadorId?: number;
	aprobador?: string;
	almaceneroId?: number;
	almacenero?: string;
	fechaSolicitud: string;
	fechaAprobacion?: string;
	fechaDespacho?: string;
	fechaEntrega?: string;
	observacion?: string;
	createdAt: string;
}

export interface SolicitudItem {
	id: number;
	materialId: number;
	codigo: string;
	materialNombre: string;
	unidadMedida: string;
	cantidadSolicitada: number;
	cantidadDespachada: number;
	cantidadEntregada: number;
}

interface PaginatedResponse {
	total: number;
	page: number;
	pageSize: number;
	items: SolicitudListItem[];
}

export const getSolicitudes = (params?: {
	estado?: string;
	almacenId?: number;
	solicitanteId?: number;
	page?: number;
	pageSize?: number;
}): Promise<PaginatedResponse> => {
	const sp: Record<string, string | number> = {};
	if (params?.estado) sp.estado = params.estado;
	if (params?.almacenId != null) sp.almacenId = params.almacenId;
	if (params?.solicitanteId != null) sp.solicitanteId = params.solicitanteId;
	if (params?.page != null) sp.page = params.page;
	if (params?.pageSize != null) sp.pageSize = params.pageSize;
	return api.get('solicitudes', { searchParams: sp }).json<PaginatedResponse>();
};

export const getSolicitud = (id: number): Promise<{ solicitud: SolicitudDetail; items: SolicitudItem[] }> =>
	api.get(`solicitudes/${id}`).json<{ solicitud: SolicitudDetail; items: SolicitudItem[] }>();

// ─── Creación ─────────────────────────────────────────────────────────────────

export interface SolicitudItemInput {
	materialId: number;
	cantidad: number;
}

export interface SolicitudCreateInput {
	almacenId: number;
	items: SolicitudItemInput[];
	observacion?: string;
}

export const createSolicitud = (data: SolicitudCreateInput): Promise<{ id: number; numero: string }> =>
	api.post('solicitudes', { json: data }).json<{ id: number; numero: string }>();

// ─── Acciones ─────────────────────────────────────────────────────────────────

export const aprobarSolicitud = (id: number): Promise<void> =>
	api.put(`solicitudes/${id}/aprobar`).then(() => undefined);

export const rechazarSolicitud = (id: number, observacion?: string): Promise<void> =>
	api.put(`solicitudes/${id}/rechazar`, { json: { observacion } }).then(() => undefined);

export interface DespachoItemInput {
	solicitudItemId: number;
	cantidadDespachada: number;
}

export const despacharSolicitud = (id: number, fecha: string, items: DespachoItemInput[]): Promise<void> =>
	api.put(`solicitudes/${id}/despachar`, { json: { fecha, items } }).then(() => undefined);

export interface EntregaItemInput {
	solicitudItemId: number;
	cantidadEntregada: number;
}

export const entregarSolicitud = (id: number, fecha: string, items: EntregaItemInput[]): Promise<void> =>
	api.put(`solicitudes/${id}/entregar`, { json: { fecha, items } }).then(() => undefined);

export const cancelarSolicitud = (id: number): Promise<void> =>
	api.put(`solicitudes/${id}/cancelar`).then(() => undefined);
