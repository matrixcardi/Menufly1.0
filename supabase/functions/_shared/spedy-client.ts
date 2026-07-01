// Cliente compartilhado para a API da Spedy (emissão de NFC-e).
// Doc: https://api.spedy.com.br/llms.txt

export type SpedyEnvironment = "production" | "development";

const BASE_URLS: Record<SpedyEnvironment, string> = {
  production: "https://api.spedy.com.br/v1",
  development: "https://sandbox-api.spedy.com.br/v1",
};

export function spedyBaseUrl(environment: SpedyEnvironment): string {
  return BASE_URLS[environment] ?? BASE_URLS.production;
}

export interface SpedyErrorBody {
  errors?: Array<{ message?: string; path?: string | null }>;
}

export class SpedyApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "SpedyApiError";
    this.status = status;
    this.body = body;
  }
}

function extractErrorMessage(status: number, body: unknown): string {
  if (status === 403) return "Chave de API da Spedy inválida ou sem permissão.";
  if (status === 429) return "Limite de requisições da Spedy atingido. Tente novamente em instantes.";
  const errors = (body as SpedyErrorBody)?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors.map((e) => e.message).filter(Boolean).join("; ") || `Erro Spedy (${status})`;
  }
  return `Erro Spedy (${status})`;
}

interface SpedyRequestOptions {
  apiKey: string;
  environment: SpedyEnvironment;
  method?: string;
  body?: unknown;
  timeoutMs?: number;
}

// fetch com timeout — a Spedy responde rápido (emissão é assíncrona do lado deles),
// mas uma rede lenta não pode travar a Edge Function indefinidamente.
export async function spedyRequest<T = unknown>(path: string, options: SpedyRequestOptions): Promise<T> {
  const { apiKey, environment, method = "GET", body, timeoutMs = 10000 } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${spedyBaseUrl(environment)}${path}`, {
      method,
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    const parsed = text ? JSON.parse(text) : null;

    if (!res.ok) {
      throw new SpedyApiError(res.status, extractErrorMessage(res.status, parsed), parsed);
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof SpedyApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new SpedyApiError(408, "Tempo limite excedido ao contatar a Spedy.");
    }
    throw new SpedyApiError(0, err instanceof Error ? err.message : "Erro desconhecido ao contatar a Spedy.");
  } finally {
    clearTimeout(timeout);
  }
}
