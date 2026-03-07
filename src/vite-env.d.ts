/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_WS_BASE_URL: string
  readonly VITE_APP_ENV: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
  readonly VITE_ENCRYPTION_KEY: string
  readonly VITE_ENABLE_DEBUG: string
  readonly VITE_ENABLE_AUDIT_LOGS: string
  readonly VITE_SESSION_TIMEOUT: string
  readonly VITE_AUTO_LOGOUT_WARNING: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}