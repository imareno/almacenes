import client from './client';

export interface Almacen {
  id: number;
  nombre: string;
  descripcion?: string;
  parentId?: number;
  active: boolean;
}

export const getAlmacenes = () => client.get<Almacen[]>('/almacenes').then(r => r.data);
export const createAlmacen = (data: Partial<Almacen>) => client.post('/almacenes', data).then(r => r.data);
export const updateAlmacen = (id: number, data: Partial<Almacen>) => client.put(`/almacenes/${id}`, data).then(r => r.data);
export const deleteAlmacen = (id: number) => client.delete(`/almacenes/${id}`).then(r => r.data);
