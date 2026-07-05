import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const configuredPort = Number(process.env.VITE_DEV_PORT || process.env.TUNNARA_CONSOLE_WEB_PORT || process.env.PORT || 61002);
const configuredHost = process.env.VITE_DEV_HOST || process.env.TUNNARA_CONSOLE_WEB_HOST || "127.0.0.1";
const internalApiTarget = process.env.VITE_API_PROXY_TARGET || process.env.TUNNARA_CONSOLE_API_BASE_URL || "http://127.0.0.1:61001";
const productionSourceMap = process.env.TUNNARA_CONSOLE_SOURCEMAP === "true";

export default defineConfig({
  base: "./",
  plugins: [vue()],
  build: {
    minify: "esbuild",
    cssMinify: "esbuild",
    sourcemap: productionSourceMap,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/vue") || id.includes("node_modules/vue-router") || id.includes("node_modules/pinia")) {
            return "vendor-vue";
          }
          if (id.includes("node_modules/@tauri-apps")) return "vendor-tauri";
          return undefined;
        },
      },
    },
  },
  server: {
    host: configuredHost,
    port: Number.isFinite(configuredPort) ? configuredPort : 61002,
    strictPort: false,
    proxy: {
      "/__internal_api": {
        target: internalApiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__internal_api/, ""),
      },
    },
  },
  preview: {
    host: process.env.VITE_PREVIEW_HOST || configuredHost,
    port: Number(process.env.VITE_PREVIEW_PORT || process.env.TUNNARA_CONSOLE_WEB_PORT || 61002),
    strictPort: false,
  },
});
