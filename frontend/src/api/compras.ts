import client from './client';

export interface Compra {
  id: number;
  numero: string;
  proveedor: string;
  fecha: string;
  estado: string;
  userId: number;
  createdAt: string;
}

export interface CompraItem {
  id: number;
  compraId: number;
  materialId: number;
  materialNombre?: string;
  codigo?: string;
  cantidad: number;
  precioUnitario: number;
}

export interface CompraDetalle {
  compra: Compra;
  items: CompraItem[];
}

export const getCompras = (params?: { estado?: string; page?: number; pageSize?: number }) =>
  client.get<{ total: number; items: Compra[] }>('/compras', { params }).then(r => r.data);
export const getCompra = (id: number) => client.get<CompraDetalle>(`/compras/${id}`).then(r => r.data);
export const createCompra = (data: object) => client.post('/compras', data).then(r => r.data);
export const confirmarCompra = (id: number) => client.put(`/compras/${id}/confirmar`).then(r => r.data);
export const recibirCompra = (id: number, data: object) => client.post(`/compras/${id}/recibir`, data).then(r => r.data);
