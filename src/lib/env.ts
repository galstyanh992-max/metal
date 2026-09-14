/**
 * Centralized environment validation.
 *
 * Production MUST fail-closed when required secrets are missing.
 * No hardcoded fallbacks for security-sensitive values.
 */

import crypto from "crypto";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function maskSecret(value: string): string {
  if (!value) return "<empty>";
  if (value.length <= 8) return "<REDACTED>";
  return `${value.slice(0, 3)}...${value.slice(-3)} (${value.length} chars)`;
}

/**
 * Resolve NEXTAUTH_SECRET. In production, throws if missing.
 * In development, allows an explicit env value; never returns a hardcoded default.
 */
export function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.trim().length === 0) {
    if (isProduction()) {
      throw new Error(
        "NEXTAUTH_SECRET is required in production. Set it in your hosting provider's environment variables (Vercel/Supabase)."
      );
    }
    // Development only — generate an ephemeral per-process secret so JWTs are still signed.
    // This is NOT a hardcoded default; it rotates every process restart and is never persisted.
    return crypto.randomBytes(32).toString("base64");
  }
  // Reject known-leaked placeholder secrets in production.
  if (isProduction() && /^(dev-secret|secret|changeme|password|test)/i.test(secret)) {
    throw new Error("NEXTAUTH_SECRET appears to be a placeholder. Set a real secret in production environment.");
  }
  return secret;
}

export interface ResolvedEnv {
  databaseUrl: string;
  nextAuthSecret: string;
  nextAuthUrl?: string;
}

let resolved: ResolvedEnv | null = null;

/**
 * Validate and resolve all required environment variables.
 * Throws in production when critical values are missing.
 * Result is cached for the lifetime of the process.
 */
export function resolveEnv(): ResolvedEnv {
  if (resolved) return resolved;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new Error("DATABASE_URL is required.");
  }

  const nextAuthSecret = getNextAuthSecret();
  const nextAuthUrl = process.env.NEXTAUTH_URL;

  resolved = { databaseUrl, nextAuthSecret, nextAuthUrl };
  return resolved;
}

/**
 * Diagnostic summary that NEVER includes secret values.
 * Safe to log or include in reports.
 */
export function envDiagnostic(): Record<string, string> {
  return {
    NODE_ENV: process.env.NODE_ENV ?? "undefined",
    DATABASE_URL: process.env.DATABASE_URL ? "<set>" : "<missing>",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? maskSecret(process.env.NEXTAUTH_SECRET) : "<missing>",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "<missing>",
  };
}