import client from './client';

export const getExistencias = (params?: { almacenId?: number; categoria?: string; soloConStock?: boolean }) =>
  client.get('/reportes/existencias', { params }).then(r => r.data);

export const getKardex = (materialId: number, params?: { almacenId?: number; desde?: string; hasta?: string }) =>
  client.get(`/reportes/kardex/${materialId}`, { params }).then(r => r.data);

export const getValorizado = (params?: { almacenId?: number; categoria?: string }) =>
  client.get('/reportes/valorizado', { params }).then(r => r.data);

export const getReporteCompras = (params?: { estado?: string; desde?: string; hasta?: string }) =>
  client.get('/reportes/compras', { params }).then(r => r.data);

export const getReporteMovimientos = (params?: { almacenId?: number; materialId?: number; tipo?: string; desde?: string; hasta?: string }) =>
  client.get('/reportes/movimientos', { params }).then(r => r.data);
