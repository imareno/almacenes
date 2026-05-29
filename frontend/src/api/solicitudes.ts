import client from './client';

export interface Solicitud {
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

export const getSolicitudes = (params?: object) =>
  client.get<{ total: number; page: number; pageSize: number; items: Solicitud[] }>('/solicitudes', { params }).then(r => r.data);

export const getSolicitud = (id: number) =>
  client.get<{ solicitud: Solicitud; items: SolicitudItem[] }>(`/solicitudes/${id}`).then(r => r.data);

export const createSolicitud = (data: { almacenId: number; items: { materialId: number; cantidad: number }[]; observacion?: string }) =>
  client.post('/solicitudes', data).then(r => r.data);

export const aprobarSolicitud = (id: number) => client.put(`/solicitudes/${id}/aprobar`).then(r => r.data);
export const rechazarSolicitud = (id: number, observacion?: string) =>
  client.put(`/solicitudes/${id}/rechazar`, { observacion }).then(r => r.data);
export const cancelarSolicitud = (id: number) => client.put(`/solicitudes/${id}/cancelar`).then(r => r.data);

export const despacharSolicitud = (id: number, data: { fecha: string; items: { solicitudItemId: number; cantidadDespachada: number }[] }) =>
  client.put(`/solicitudes/${id}/despachar`, data).then(r => r.data);

export const entregarSolicitud = (id: number, data: { fecha: string; items: { solicitudItemId: number; cantidadEntregada: number }[] }) =>
  client.put(`/solicitudes/${id}/entregar`, data).then(r => r.data);
