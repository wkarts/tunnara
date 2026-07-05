import { projectConfig } from "../../config/projectConfig";
import type { PlatformInfo, RuntimeMode } from "./RuntimeTypes";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
}

export function isPwaRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function getRuntimeMode(): RuntimeMode {
  if (isTauriRuntime()) return "tauri";
  if (isPwaRuntime()) return "pwa";
  return "web";
}

export function getPlatformInfo(): PlatformInfo {
  const mode = getRuntimeMode();
  return {
    mode,
    isTauri: mode === "tauri",
    isPwa: mode === "pwa",
    isWeb: mode === "web",
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    online: navigator.onLine,
    appVersion: projectConfig.app.version,
  };
}

export function assertWebCompatibleFeature(feature: string, available: boolean): void {
  if (!available) {
    throw new Error(`${feature} não está disponível neste runtime.`);
  }
}
