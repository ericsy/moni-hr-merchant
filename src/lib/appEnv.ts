export type AppEnv = "dev" | "test" | "pro";

/** Vite mode → 业务环境（local dev 为 development） */
export function resolveAppEnv(raw?: string): AppEnv {
  const value = (raw ?? import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE ?? "")
    .trim()
    .toLowerCase();
  if (value === "dev" || value === "development") return "dev";
  if (value === "test") return "test";
  if (value === "pro" || value === "production" || value === "prod") return "pro";
  return "pro";
}

export function getAppEnv(): AppEnv {
  return resolveAppEnv();
}

export function isDevAppEnv(): boolean {
  return getAppEnv() === "dev";
}
