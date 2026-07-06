#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const requests = Math.max(10, Number(process.env.TUNNARA_LOAD_REQUESTS || 1000));
const concurrency = Math.max(1, Number(process.env.TUNNARA_LOAD_CONCURRENCY || 50));
const maxP95 = Math.max(1, Number(process.env.TUNNARA_LOAD_MAX_P95_MS || 1500));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnara-load-'));
const dataDir = path.join(temp, 'data');
const configDir = path.join(temp, 'agent');
const adminToken = 'tnr_admin_load_012345678901234567890123456789';
const controlUrl = 'http://127.0.0.1:26100';
const relayUrl = 'tcp://127.0.0.1:26300';
const edgePort = 26200;
const upstreamPort = 26080;
const children = [];

function child(script, args, env = {}) {
  const proc = spawn(process.execPath, [script, ...args], { cwd: root, env: { ...process.env, NODE_NO_WARNINGS: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', (data) => process.stdout.write(`[child] ${data}`));
  proc.stderr.on('data', (data) => process.stderr.write(`[child:err] ${data}`));
  children.push(proc); return proc;
}
async function waitFor(url, options = {}, timeoutMs = 20000) { const deadline = Date.now() + timeoutMs; while (Date.now() < deadline) { try { const r = await fetch(url, options); if (r.ok) return r; } catch {} await sleep(100); } throw new Error(`Timeout: ${url}`); }
function waitExit(proc, timeoutMs = 15000) { if (proc.exitCode !== null) return Promise.resolve(proc.exitCode); return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Timeout encerrando processo')), timeoutMs); proc.once('exit', (code) => { clearTimeout(timer); code === 0 ? resolve(code) : reject(new Error(`Exit ${code}`)); }); }); }
async function api(pathName, method = 'GET', body) { const r = await fetch(`${controlUrl}${pathName}`, { method, headers: { Authorization: `Bearer ${adminToken}`, ...(body ? {'content-type':'application/json'}:{}) }, body: body ? JSON.stringify(body) : undefined }); const payload = await r.json(); assert.ok(r.ok, JSON.stringify(payload)); return payload; }
function requestEdge(index) { return new Promise((resolve) => { const started = performance.now(); const req = http.request({ host: '127.0.0.1', port: edgePort, method: 'GET', path: `/load/${index}`, headers: { Host: 'load.test.local', Connection: 'keep-alive' }, agent: requestEdge.agent }, (res) => { let bytes=0; res.on('data', c=>bytes+=c.length); res.on('end',()=>resolve({ok:res.statusCode===200,ms:performance.now()-started,bytes,status:res.statusCode})); }); req.on('error',error=>resolve({ok:false,ms:performance.now()-started,bytes:0,error:error.message})); req.end(); }); }
requestEdge.agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });
function percentile(values, pct) { const sorted=[...values].sort((a,b)=>a-b); return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*pct))] || 0; }

const upstream = http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,path:req.url}));});
try {
  await new Promise(resolve=>upstream.listen(upstreamPort,'127.0.0.1',resolve));
  const server=child(path.join(root,'runtime/node/bin/tunnara-server.mjs'),['serve-all','--data-dir',dataDir],{
    TUNNARA_CONTROL_PORT:'26100',TUNNARA_EDGE_PORT:String(edgePort),TUNNARA_RELAY_PORT:'26300',TUNNARA_RELAY_EDGE_PORT:'26301',TUNNARA_BASE_DOMAIN:'test.local',
    TUNNARA_BOOTSTRAP_ADMIN_TOKEN:adminToken,TUNNARA_BOOTSTRAP_ORGANIZATION:'Load Test',TUNNARA_PUBLIC_CONTROL_URL:controlUrl,TUNNARA_PUBLIC_RELAY_URL:relayUrl,
  });
  await waitFor(`${controlUrl}/healthz`);
  const provision=await api('/api/v1/provisioning-tokens','POST',{name:'load-agent',ttlSeconds:600});
  const login=child(path.join(root,'runtime/node/bin/tunnara.mjs'),['login','--token',provision.token,'--control-url',controlUrl,'--relay-url',relayUrl,'--config-dir',configDir,'--json']);
  await waitExit(login);
  const config=JSON.parse(fs.readFileSync(path.join(configDir,'config.json'),'utf8'));
  const agent=child(path.join(root,'runtime/node/bin/tunnara.mjs'),['serve','--config-dir',configDir]);
  await api('/api/v1/tunnels','POST',{name:'Load',protocol:'http',hostname:'load.test.local',targets:[{agentId:config.agentId,name:'primary',targetHost:'127.0.0.1',targetPort:upstreamPort}]});
  await sleep(500);
  const latencies=[]; let failures=0; let completed=0; let next=0;
  const started=performance.now();
  async function worker(){while(true){const index=next++;if(index>=requests)return;const result=await requestEdge(index);completed++;if(result.ok)latencies.push(result.ms);else failures++;}}
  await Promise.all(Array.from({length:Math.min(concurrency,requests)},worker));
  const duration=(performance.now()-started)/1000;
  const report={requests,concurrency,completed,failures,durationSeconds:Number(duration.toFixed(3)),requestsPerSecond:Number((completed/duration).toFixed(2)),p50Ms:Number(percentile(latencies,.50).toFixed(2)),p95Ms:Number(percentile(latencies,.95).toFixed(2)),p99Ms:Number(percentile(latencies,.99).toFixed(2)),maxMs:Number(Math.max(...latencies).toFixed(2))};
  console.log(JSON.stringify(report,null,2));
  assert.equal(failures,0,'O teste de carga encontrou falhas.');
  assert.ok(report.p95Ms <= maxP95,`p95 ${report.p95Ms} ms excedeu ${maxP95} ms.`);
  console.log('LOAD_OK');
  agent.kill('SIGTERM'); server.kill('SIGTERM'); await Promise.all([waitExit(agent),waitExit(server)]);
} finally {
  requestEdge.agent.destroy();
  for(const proc of children) if(proc.exitCode===null) proc.kill('SIGKILL');
  await new Promise(resolve=>upstream.close(()=>resolve())).catch(()=>{});
  fs.rmSync(temp,{recursive:true,force:true});
}
