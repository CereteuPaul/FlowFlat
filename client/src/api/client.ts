const API_BASE = 'http://localhost:4000/api';

export function getToken(): string | null {
  return localStorage.getItem('flowflat_token');
}

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export function setToken(token: string) {
  localStorage.setItem('flowflat_token', token);
}

export function clearToken() {
  localStorage.removeItem('flowflat_token');
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}
