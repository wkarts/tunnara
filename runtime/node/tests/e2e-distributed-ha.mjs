import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const serverBin = path.join(root, 'runtime/node/bin/tunnara-server.mjs');
const agentBin = path.join(root, 'runtime/node/bin/tunnara.mjs');
function spawnNode(args, env={}) { const child=childProcess.spawn(process.execPath,args,{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']}); child.stdout.on('data',c=>process.stdout.write(`# [child] ${c}`)); child.stderr.on('data',c=>process.stderr.write(`# [child] ${c}`)); return child; }
async function waitHttp(url, timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){try{const r=await fetch(url);if(r.ok)return;}catch{}await sleep(100);}throw new Error(`Timeout ${url}`);}
async function json(url,{method='GET',token,body}={}){const r=await fetch(url,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const p=r.status===204?null:await r.json();if(!r.ok)throw new Error(p?.message||`HTTP ${r.status}`);return p;}
async function requestEdge(port,host){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:'/ha',headers:{Host:host}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,text:Buffer.concat(chunks).toString()}));});req.on('error',reject);req.end();});}
async function waitEdge(port,host,expected,timeout=15000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{last=await requestEdge(port,host);if(last.status===200&&last.text===expected)return last;}catch{}await sleep(250);}throw new Error(`Edge não retornou ${expected}: ${JSON.stringify(last)}`);}

test('multi-edge/relay distribuído registra nós e realiza failover de Relay', async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tunnara-e2e-ha-'));
  const p={control:23100,edge:23200,relayA:23300,relayAEdge:23301,relayB:23400,relayBEdge:23401,target:23500};
  const admin='tnr_admin_distributed_test'; const cluster='tnr_cluster_distributed_secret_0123456789';
  const upstream=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/plain'});res.end('distributed-ok');});
  await new Promise(r=>upstream.listen(p.target,'127.0.0.1',r));
  const common={TUNNARA_BOOTSTRAP_ADMIN_TOKEN:admin,TUNNARA_CLUSTER_TOKEN:cluster,TUNNARA_INTERNAL_CONTROL_URL:`http://127.0.0.1:${p.control}`,TUNNARA_PUBLIC_CONTROL_URL:`http://127.0.0.1:${p.control}`,TUNNARA_BASE_DOMAIN:'dist.test.local',TUNNARA_LOG_FORMAT:'text'};
  const control=spawnNode([serverBin,'control'],{...common,TUNNARA_DATA_DIR:path.join(temp,'control'),TUNNARA_CONTROL_PORT:String(p.control)});
  let relayA,relayB,edge,agent;
  try{
    await waitHttp(`http://127.0.0.1:${p.control}/healthz`);
    relayA=spawnNode([serverBin,'relay'],{...common,TUNNARA_DATA_DIR:path.join(temp,'relay-a'),TUNNARA_NODE_NAME:'a',TUNNARA_RELAY_PORT:String(p.relayA),TUNNARA_RELAY_EDGE_PORT:String(p.relayAEdge),TUNNARA_PUBLIC_RELAY_URL:`tcp://127.0.0.1:${p.relayA}`,TUNNARA_RELAY_EDGE_PUBLIC_URL:`tcp://127.0.0.1:${p.relayAEdge}`});
    relayB=spawnNode([serverBin,'relay'],{...common,TUNNARA_DATA_DIR:path.join(temp,'relay-b'),TUNNARA_NODE_NAME:'b',TUNNARA_RELAY_PORT:String(p.relayB),TUNNARA_RELAY_EDGE_PORT:String(p.relayBEdge),TUNNARA_PUBLIC_RELAY_URL:`tcp://127.0.0.1:${p.relayB}`,TUNNARA_RELAY_EDGE_PUBLIC_URL:`tcp://127.0.0.1:${p.relayBEdge}`});
    edge=spawnNode([serverBin,'edge'],{...common,TUNNARA_DATA_DIR:path.join(temp,'edge'),TUNNARA_NODE_NAME:'e',TUNNARA_EDGE_PORT:String(p.edge),TUNNARA_PUBLIC_EDGE_URL:`http://127.0.0.1:${p.edge}`,TUNNARA_PUBLIC_PORT_MIN:'23600',TUNNARA_PUBLIC_PORT_MAX:'23620'});
    await sleep(1200);
    const nodes=await json(`http://127.0.0.1:${p.control}/api/v1/nodes`,{token:admin});
    assert.ok(nodes.data.filter(n=>n.node_type==='relay').length>=2);
    assert.ok(nodes.data.some(n=>n.node_type==='edge'));
    const provision=await json(`http://127.0.0.1:${p.control}/api/v1/provisioning-tokens`,{method:'POST',token:admin,body:{name:'ha-agent'}});
    const configDir=path.join(temp,'agent');
    const login=spawnNode([agentBin,'login','--token',provision.token,'--name','ha-agent','--control-url',`http://127.0.0.1:${p.control}`,'--config-dir',configDir]);
    assert.equal(await new Promise(r=>login.once('exit',r)),0);
    const config=JSON.parse(fs.readFileSync(path.join(configDir,'config.json'),'utf8'));
    assert.equal(config.relayUrls.length,2);
    agent=spawnNode([agentBin,'serve','--config-dir',configDir,'--no-local-api'],common);
    await sleep(800);
    const tunnel=await json(`http://127.0.0.1:${p.control}/api/v1/tunnels`,{method:'POST',token:config.sessionToken,body:{protocol:'http',hostname:'app.dist.test.local',targetHost:'127.0.0.1',targetPort:p.target,name:'HA HTTP'}});
    assert.equal(tunnel.hostname,'app.dist.test.local');
    await waitEdge(p.edge,tunnel.hostname,'distributed-ok');
    const first=config.relayUrls[0];
    if(first.endsWith(`:${p.relayA}`)){relayA.kill('SIGTERM');relayA=null;}else{relayB.kill('SIGTERM');relayB=null;}
    await sleep(2600);
    await waitEdge(p.edge,tunnel.hostname,'distributed-ok',18000);
    console.log('E2E_OK multi-edge/multi-relay e failover validados.');
  }finally{
    for(const child of [agent,edge,relayA,relayB,control]) child?.kill('SIGTERM');
    upstream.close(); await sleep(500); fs.rmSync(temp,{recursive:true,force:true});
  }
});
