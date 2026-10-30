// Minimal Cloudflare D1 / Pages Functions types. We avoid @cloudflare/workers-types because
// it redefines DOM globals and clashes with the browser lib in the shared tsconfig.

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface Env {
  DB: D1Database;
  /** Secret salt for hashing client IPs. */
  IP_SALT?: string;
}

export interface PagesContext<E = Env> {
  request: Request;
  env: E;
}

export type PagesFunction<E = Env> = (context: PagesContext<E>) => Promise<Response>;
