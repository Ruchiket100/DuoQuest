import type { ApiResponse } from "@duoquest/shared";
import { useAuthStore } from "@/stores/authStore.ts";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Perform a typed API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

  const headers: HeadersInit = {
    ...options.headers,
  };
  const token = localStorage.getItem("session_token");
  if (token) {
    (headers as any)["Authorization"] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData)) {
    (headers as any)["Content-Type"] = (headers as any)["Content-Type"] || "application/json";
  }

  // Default credentials to "include" for Better Auth session cookies
  const config: RequestInit = {
    ...options,
    credentials: options.credentials || "include",
    headers,
  };

  const response = await fetch(url, config);

  let result: ApiResponse<T> | any;
  try {
    const text = await response.text();
    result = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new ApiError(response.status, "PARSE_ERROR", "Failed to parse API response");
  }

  if (!response.ok) {
    if (response.status === 401) {
      useAuthStore.getState().logout();
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/register" && path !== "/onboarding") {
        window.location.href = "/login";
      }
    }
    const errorCode = result?.error?.code || result?.code || "HTTP_ERROR";
    const errorMessage = result?.error?.message || result?.message || response.statusText || "Something went wrong";
    throw new ApiError(response.status, errorCode, errorMessage);
  }

  // Better Auth endpoints might return raw auth data directly, wrap check
  if (endpoint.includes("/api/auth/")) {
    return result as T;
  }

  return result.data as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
  upload: <T>(endpoint: string, formData: FormData) => {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
    const token = localStorage.getItem("session_token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(url, {
      method: "POST",
      credentials: "include",
      headers,
      body: formData,
    }).then(async (res) => {
      const result = await res.json();
      if (!res.ok) throw new ApiError(res.status, result?.error?.code || "UPLOAD_ERROR", result?.error?.message || "Upload failed");
      return result.data as T;
    });
  },
};
export default api;
