import axios, { AxiosError, type AxiosResponse } from 'axios';
import type { ZodType } from 'zod';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8008';

export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8008';

export const PUBLIC_SITE_URL = (
  import.meta.env.VITE_PUBLIC_SITE_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : 'https://miruai.vercel.app')
).replace(/\/$/, '');

export function buildPublicSiteUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${PUBLIC_SITE_URL}${normalizedPath}`;
}

export function buildPublicReturnBridgeUrl(returnTo: string) {
  return `/public-return?return_to=${encodeURIComponent(returnTo)}`;
}

export function buildPublicArticleUrl(slug: string) {
  return buildPublicSiteUrl(`/bai-viet/${encodeURIComponent(slug)}`);
}

export function buildPublicTherapistUrl(therapistId: string) {
  return buildPublicSiteUrl(`/therapists/${encodeURIComponent(therapistId)}`);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function extractAxiosMessage(error: AxiosError<unknown>) {
  const data = error.response?.data;

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;

    if (typeof record.detail === 'string' && record.detail.trim()) {
      return record.detail;
    }

    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }

    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
  }

  if (error.message) {
    return error.message;
  }

  return 'Unexpected API error';
}

export async function parseApi<T>(
  request: Promise<AxiosResponse<unknown>>,
  schema: ZodType<T>
): Promise<T> {
  try {
    const response = await request;
    return schema.parse(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(extractAxiosMessage(error));
    }
    throw error;
  }
}

export function buildWsUrl(path: string) {
  const base = WS_BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
