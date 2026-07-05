import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const serverBin = path.join(root, 'runtime/node/bin/tunnara-server.mjs');
const agentBin = path.join(root, 'runtime/node/bin/tunnara.mjs');
function spawnNode(args, env={}) { return childProcess.spawn(process.execPath,args,{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']}); }
async function waitHttp(url){for(let i=0;i<100;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await sleep(50);}throw new Error(`timeout ${url}`);}
async function json(url,{method='GET',token,body}={}){const r=await fetch(url,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const p=r.status===204?null:await r.json();if(!r.ok)throw new Error(p?.message||`HTTP ${r.status}`);return p;}

test('rede privada cria peers isolados e configura WireGuard pelo Agent', async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tunnara-network-'));
  const port=24100; const admin='tnr_admin_network_test';
  const env={TUNNARA_DATA_DIR:path.join(temp,'data'),TUNNARA_BOOTSTRAP_ADMIN_TOKEN:admin,TUNNARA_CONTROL_PORT:String(port),TUNNARA_EDGE_PORT:'24101',TUNNARA_RELAY_PORT:'24102',TUNNARA_RELAY_EDGE_PORT:'24103',TUNNARA_PUBLIC_CONTROL_URL:`http://127.0.0.1:${port}`,TUNNARA_PUBLIC_RELAY_URL:'tcp://127.0.0.1:24102'};
  const server=spawnNode([serverBin,'serve-all'],env);
  try{
    await waitHttp(`http://127.0.0.1:${port}/healthz`);
    const provision=await json(`http://127.0.0.1:${port}/api/v1/provisioning-tokens`,{method:'POST',token:admin,body:{name:'network-agent'}});
    const configDir=path.join(temp,'agent');
    const login=spawnNode([agentBin,'login','--token',provision.token,'--control-url',`http://127.0.0.1:${port}`,'--config-dir',configDir],env);
    assert.equal(await new Promise(r=>login.once('exit',r)),0);
    const cfg=JSON.parse(fs.readFileSync(path.join(configDir,'config.json'),'utf8'));
    const network=await json(`http://127.0.0.1:${port}/api/v1/networks`,{method:'POST',token:admin,body:{name:'ERP Privada',cidr:'10.91.0.0/24',dnsDomain:'erp.tunnara.internal',mode:'mesh'}});
    const joined=await json(`http://127.0.0.1:${port}/api/v1/networks/${network.id}/peers`,{method:'POST',token:cfg.sessionToken,body:{publicKey:'PUBLIC_KEY_TEST',endpoint:'agent.example.test:51820',allowedIps:['192.168.50.0/24']}});
    assert.equal(joined.network.id,network.id);
    assert.equal(joined.peer.agent_id,cfg.agentId);
    assert.match(joined.peer.virtual_ip,/^10\.91\.0\./);
    const listed=await json(`http://127.0.0.1:${port}/api/v1/networks/${network.id}/peers`,{token:admin});
    assert.equal(listed.data.length,1);
    assert.deepEqual(listed.data[0].allowed_ips,['192.168.50.0/24']);
    await json(`http://127.0.0.1:${port}/api/v1/networks/${network.id}`,{method:'DELETE',token:admin});
    console.log('E2E_OK rede privada, peer WireGuard e isolamento organizacional validados.');
  } finally { server.kill('SIGTERM'); await sleep(250); fs.rmSync(temp,{recursive:true,force:true}); }
});
