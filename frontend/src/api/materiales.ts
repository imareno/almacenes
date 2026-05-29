import client from './client';

export interface Material {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  unidadMedida: string;
  categoria?: string;
  active: boolean;
  createdAt: string;
}

export interface MaterialExistencia {
  materialId: number;
  almacenId: number;
  almacenNombre: string;
  existencia: number;
}

export const getMateriales = (params?: { search?: string; categoria?: string; soloActivos?: boolean }) =>
  client.get<Material[]>('/materiales', { params }).then(r => r.data);
export const getMaterial = (id: number) => client.get<Material>(`/materiales/${id}`).then(r => r.data);
export const getExistencia = (id: number) => client.get<MaterialExistencia[]>(`/materiales/${id}/existencia`).then(r => r.data);
export const createMaterial = (data: Partial<Material>) => client.post('/materiales', data).then(r => r.data);
export const updateMaterial = (id: number, data: Partial<Material>) => client.put(`/materiales/${id}`, data).then(r => r.data);
