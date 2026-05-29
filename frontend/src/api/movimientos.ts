import client from './client';

export interface Movimiento {
  id: number;
  tipo: string;
  materialId: number;
  codigo: string;
  materialNombre: string;
  unidadMedida: string;
  almacenId: number;
  almacenNombre: string;
  cantidad: number;
  costoUnitario: number;
  total: number;
  loteRef?: string;
  fecha: string;
  solicitudId?: number;
  compraItemId?: number;
  userId: number;
  usuario: string;
  observacion?: string;
  createdAt: string;
}

export const getMovimientos = (params?: object) =>
  client.get<{ total: number; page: number; pageSize: number; items: Movimiento[] }>('/movimientos', { params }).then(r => r.data);

export const registrarIngreso = (data: {
  materialId: number; almacenId: number; cantidad: number;
  costoUnitario: number; fecha: string; loteRef?: string; observacion?: string;
}) => client.post('/movimientos/ingreso', data).then(r => r.data);

export const registrarSalida = (data: {
  materialId: number; almacenId: number; cantidad: number;
  fecha: string; loteRef?: string; observacion?: string;
}) => client.post('/movimientos/salida', data).then(r => r.data);
