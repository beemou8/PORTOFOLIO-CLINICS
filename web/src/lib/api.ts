const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export type SessionUser = {
  id: number;
  employeeId: number;
  username: string;
  fullName: string;
  roles: string[];
  branchId: number | null;
  branchCode?: string | null;
  branchName?: string | null;
  allBranches?: boolean;
};

export type Branch = {
  id: number;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
};

export function getToken() {
  return localStorage.getItem('clinic_token');
}

export function getUser(): SessionUser | null {
  const raw = localStorage.getItem('clinic_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    localStorage.removeItem('clinic_user');
    return null;
  }
}

export function hasRole(role: string) {
  return getUser()?.roles.includes(role) ?? false;
}

export function assetUrl(value?: string | null) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  return `${API_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
}

export function logout() {
  localStorage.removeItem('clinic_token');
  localStorage.removeItem('clinic_user');
  location.href = '/login';
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Tidak dapat terhubung ke server BIM CLINICS. Pastikan npm start masih berjalan.');
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && path !== '/auth/login' && token) {
    localStorage.removeItem('clinic_token');
    localStorage.removeItem('clinic_user');
    location.href = '/login';
    throw new Error('Sesi login berakhir. Silakan login kembali.');
  }

  if (!res.ok) throw new Error(data.message || `Request gagal (${res.status})`);
  return data as T;
}
