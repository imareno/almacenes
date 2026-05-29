import client from './client';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

export async function login(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const { data } = await client.post('/auth/login', { username, password });
  return data;
}

export async function refresh(): Promise<{ token: string; user: AuthUser }> {
  const { data } = await client.post('/auth/refresh');
  return data;
}
