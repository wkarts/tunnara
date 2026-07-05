#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const manifestArg = process.argv[2] || "app.manifest.json";
const root = process.cwd();
const manifestPath = path.resolve(root, manifestArg);

if (!fs.existsSync(manifestPath)) {
  console.error(`Manifesto não encontrado: ${manifestPath}`);
  console.error("Use: npm run new:app -- app.manifest.json");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(path.join(root, file), `${JSON.stringify(data, null, 2)}\n`);
}

function replaceInFile(file, replacements) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) return;

  let content = fs.readFileSync(fullPath, "utf8");
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  fs.writeFileSync(fullPath, content);
}

function copyIfExists(source, destination) {
  if (!source) return;

  const sourcePath = path.resolve(path.dirname(manifestPath), source);
  const destinationPath = path.join(root, destination);
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Asset não encontrado e ignorado: ${sourcePath}`);
    return;
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

const appName = manifest.appName || manifest.name || "Minha Aplicação";
const productName = manifest.productName || appName;
const shortName = manifest.shortName || appName;
const identifier = manifest.identifier || "br.com.minhaempresa.app";
const packageName = manifest.packageName
  || identifier.split(".").at(-1).replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
const localDataDir = manifest.localDataDir || packageName.replace(/-/g, "_");
const storagePrefix = manifest.storagePrefix || packageName;
const developer = manifest.developer || productName;
const version = manifest.version || "1.0.0";

const packageJson = readJson("package.json");
packageJson.name = packageName;
packageJson.version = version;
writeJson("package.json", packageJson);

const tauriConfig = readJson("src-tauri/tauri.conf.json");
tauriConfig.productName = productName;
tauriConfig.version = version;
tauriConfig.identifier = identifier;
if (tauriConfig.app?.windows?.[0]) {
  tauriConfig.app.windows[0].title = productName;
}
writeJson("src-tauri/tauri.conf.json", tauriConfig);

replaceInFile("src/config/projectConfig.ts", [
  [/name:\s*"[^"]+"/, `name: ${JSON.stringify(appName)}`],
  [/shortName:\s*"[^"]+"/, `shortName: ${JSON.stringify(shortName)}`],
  [/productName:\s*"[^"]+"/, `productName: ${JSON.stringify(productName)}`],
  [/windowTitle:\s*"[^"]+"/, `windowTitle: ${JSON.stringify(productName)}`],
  [/identifier:\s*"[^"]+"/, `identifier: ${JSON.stringify(identifier)}`],
  [/developer:\s*"[^"]+"/, `developer: ${JSON.stringify(developer)}`],
  [/localDataDir:\s*"[^"]+"/, `localDataDir: ${JSON.stringify(localDataDir)}`],
  [/storagePrefix:\s*"[^"]+"/, `storagePrefix: ${JSON.stringify(storagePrefix)}`],
  [/version:\s*"[^"]+"/, `version: ${JSON.stringify(version)}`],
]);

replaceInFile("src-tauri/Cargo.toml", [
  [/^version\s*=\s*"[^"]+"/m, `version = "${version}"`],
]);

fs.writeFileSync(path.join(root, "VERSION"), `${version}\n`);

copyIfExists(manifest.assets?.logoLight, "src/assets/branding/logo-light.png");
copyIfExists(manifest.assets?.logoDark, "src/assets/branding/logo-dark.png");
copyIfExists(manifest.assets?.logoMark, "src/assets/branding/logo-mark.png");
copyIfExists(manifest.assets?.iconPng, "src-tauri/icons/icon.png");
copyIfExists(manifest.assets?.iconIco, "src-tauri/icons/icon.ico");
copyIfExists(manifest.assets?.trayIcon, "src/assets/branding/tray-icon.png");

const envLines = [
  `APP_NAME=${appName}`,
  `APP_IDENTIFIER=${identifier}`,
  `APP_LOCAL_DATA_DIR=${localDataDir}`,
  `TUNNARA_CONSOLE_NAME=${appName}`,
  `TUNNARA_CONSOLE_IDENTIFIER=${identifier}`,
  `TUNNARA_CONSOLE_LOCAL_DATA_DIR=${localDataDir}`,
  `VITE_APP_NAME=${appName}`,
  `VITE_APP_SHORT_NAME=${shortName}`,
  `VITE_APP_PRODUCT_NAME=${productName}`,
  `VITE_APP_DEVELOPER=${developer}`,
  `VITE_APP_IDENTIFIER=${identifier}`,
  `VITE_APP_LOCAL_DATA_DIR=${localDataDir}`,
  `VITE_APP_STORAGE_PREFIX=${storagePrefix}`,
];
fs.writeFileSync(path.join(root, ".env"), `${envLines.join("\n")}\n`);

console.log(`Aplicação derivada configurada: ${productName} (${identifier})`);
