import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  DEFAULT_SUPABASE_URL,
} from "@/integrations/supabase/config";

/**
 * Autenticação do servidor: o destino Supabase vem apenas da configuração
 * confiável do projecto. Nunca usar o issuer não verificado do JWT como URL
 * de destino, para evitar SSRF e envio do token a hosts controlados por terceiros.
 */

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

type JwtPayload = { sub?: string; iss?: string; exp?: number; email?: string };

function decodeJwt(token: string): JwtPayload | undefined {
  try {
    const part = token.split(".")[1];
    if (!part) return undefined;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as JwtPayload;
  } catch {
    return undefined;
  }
}

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    throw new Error("Sessão expirada. Inicie sessão novamente para continuar.");
  }

  const payload = decodeJwt(token);

  if (payload?.exp && payload.exp * 1000 < Date.now() - 5_000) {
    throw new Error("A sua sessão expirou. Actualize a página ou volte a entrar.");
  }

  const ENV_URL = readEnv("VITE_SUPABASE_URL", "SUPABASE_URL") ?? DEFAULT_SUPABASE_URL;
  let SUPABASE_URL: string;
  try {
    const configuredUrl = new URL(ENV_URL);
    const isLocalHost = ["localhost", "127.0.0.1"].includes(configuredUrl.hostname);
    const isSecureProtocol = configuredUrl.protocol === "https:" ||
      (configuredUrl.protocol === "http:" && isLocalHost);
    if (!isSecureProtocol || configuredUrl.pathname !== "/" || configuredUrl.username ||
        configuredUrl.password || configuredUrl.search || configuredUrl.hash) {
      throw new Error("Invalid Supabase URL");
    }
    SUPABASE_URL = configuredUrl.origin;
  } catch {
    throw new Error("A configuração do serviço de autenticação é inválida.");
  }
  const expectedIssuer = `${SUPABASE_URL}/auth/v1`;
  if (!payload?.iss || payload.iss.replace(/\/+$/, "") !== expectedIssuer) {
    throw new Error("Sessão inválida ou expirada. Termine sessão e volte a entrar.");
  }
  const SUPABASE_KEY =
    readEnv(
      "SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "VITE_SUPABASE_ANON_KEY",
    ) ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  // Falha de forma segura: sem resposta válida do Supabase Auth, não aceitar o token.
  const { data, error } = await supabase.auth.getUser(token);
  if (!data?.user?.id) {
    console.error("[auth] Token rejeitado", {
      issuer: payload?.iss,
      supabaseUrl: SUPABASE_URL,
      reason: error?.message,
    });
    throw new Error("Sessão inválida ou expirada. Termine sessão e volte a entrar.");
  }
  const userId = data.user.id;
  const claims = { sub: userId, email: data.user.email };

  return next({ context: { supabase, userId, claims } });
});
