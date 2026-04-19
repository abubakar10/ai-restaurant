/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployed API origin (https), no trailing slash. Omit in local dev (Vite proxy). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
