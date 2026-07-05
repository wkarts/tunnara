export type RuntimeMode = "web" | "pwa" | "tauri";

export interface PlatformInfo {
  mode: RuntimeMode;
  isTauri: boolean;
  isPwa: boolean;
  isWeb: boolean;
  userAgent: string;
  platform: string;
  online: boolean;
  appVersion: string;
}
