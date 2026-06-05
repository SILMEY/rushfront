import { useAuthStore } from "../stores/authStore";

const API_URL = import.meta.env.VITE_API_URL as string;

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Lire le token synchronement avant tout await pour rester dans le contexte Pinia
  let token: string | null = null;
  try { token = useAuthStore().accessToken; } catch { /* hors contexte, ignoré */ }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {})
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function apiOrigin() {
  return API_URL;
}
