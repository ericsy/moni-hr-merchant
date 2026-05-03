const ACCESS_TOKEN_STORAGE_KEY = "moni_hr_access_token";
const DEFAULT_STORE_ID = "";
const DEFAULT_LANGUAGE = "zh";

type QueryValue = string | number | boolean | null | undefined;
type ApiLanguage = "zh" | "en";
let currentStoreId = DEFAULT_STORE_ID;
let currentLanguage: ApiLanguage = DEFAULT_LANGUAGE;

interface ApiRequestOptions extends Omit<RequestInit, "body" | "headers"> {
  body?: unknown;
  headers?: HeadersInit;
  query?: Record<string, QueryValue>;
  storeId?: string;
  auth?: boolean;
}

interface ApiResult<T> {
  code?: number;
  message?: string;
  data?: T;
}

export class ApiError extends Error {
  status?: number;
  code?: number;

  constructor(message: string, status?: number, code?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function getStoredAccessToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
}

export function setStoredAccessToken(token: string) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

export function clearStoredAccessToken() {
  setStoredAccessToken("");
}

export function setCurrentStoreId(storeId: string) {
  currentStoreId = storeId || DEFAULT_STORE_ID;
}

export function getCurrentStoreId() {
  return currentStoreId;
}

export function setCurrentLanguage(language: string) {
  currentLanguage = language === "en" ? "en" : "zh";
}

export function getCurrentLanguage() {
  return currentLanguage;
}

function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL || "";
  return String(raw).replace(/\/$/, "");
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const rawPath = String(path || "");
  const url = /^https?:\/\//i.test(rawPath)
    ? rawPath
    : `${getApiBaseUrl()}${rawPath.startsWith("/") ? rawPath : `/${rawPath}`}`;
  const params = new URLSearchParams();

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const qs = params.toString();
  if (!qs) return url;

  return `${url}${url.includes("?") ? "&" : "?"}${qs}`;
}

function isApiResult<T>(payload: unknown): payload is ApiResult<T> {
  return !!payload && typeof payload === "object" && ("code" in payload || "data" in payload || "message" in payload);
}

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, query, storeId, auth = true, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  const effectiveStoreId = storeId || getCurrentStoreId();
  const isFormDataBody = typeof FormData !== "undefined" && body instanceof FormData;

  requestHeaders.set("X-Lang", getCurrentLanguage());

  if (body !== undefined && !isFormDataBody && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (auth && effectiveStoreId) {
    requestHeaders.set("X-Store-Id", effectiveStoreId);
  }

  if (auth) {
    const token = getStoredAccessToken();
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(buildUrl(path, query), {
    ...requestOptions,
    headers: requestHeaders,
    body: body === undefined ? undefined : isFormDataBody ? body : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = isApiResult(payload) ? payload.message : response.statusText;
    throw new ApiError(message || "Request failed", response.status);
  }

  if (isApiResult<T>(payload)) {
    const code = payload.code;
    if (code !== undefined && ![0, 200, 201].includes(code)) {
      throw new ApiError(payload.message || "Request failed", response.status, code);
    }
    return payload.data as T;
  }

  return payload as T;
}
