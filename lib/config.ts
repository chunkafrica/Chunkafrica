const API_PREFIX = "/api/v1";

function resolveApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    return API_PREFIX;
  }

  const normalizedBaseUrl = configuredBaseUrl.replace(/\/+$/, "");

  return normalizedBaseUrl.endsWith(API_PREFIX)
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}${API_PREFIX}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "http://127.0.0.1:3000";
