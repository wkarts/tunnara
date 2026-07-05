const apiHost = process.env.TUNNARA_CONSOLE_API_HOST || '127.0.0.1';
const apiPort = process.env.TUNNARA_CONSOLE_API_PORT || '61001';
const url = `http://${apiHost}:${apiPort}/health`;

try {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const body = await response.text();
  console.log(body);
  process.exit(response.ok ? 0 : 1);
} catch (error) {
  console.error(`Falha ao consultar ${url}: ${error.message}`);
  process.exit(1);
}
