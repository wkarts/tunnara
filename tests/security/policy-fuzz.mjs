#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { evaluatePolicy, hashPolicySecret, normalizePolicyDocument } from '../../runtime/node/lib/policy-engine.mjs';

const iterations = Math.max(100, Number(process.env.TUNNARA_FUZZ_ITERATIONS || 3000));
const values = [null, undefined, true, false, 0, 1, -1, '', '.*', '(a+)+$', [], {}, {nested:{x:1}}, Buffer.from('x')];
const random = () => values[crypto.randomInt(values.length)];
let rejected = 0;
for (let index=0; index<iterations; index++) {
  const document = normalizePolicyDocument({
    defaultEffect: crypto.randomInt(2) ? 'deny' : random(),
    rules: Array.from({length:crypto.randomInt(5)},()=>({
      name: String(random() ?? ''),
      match: { pathPrefix: random(), pathRegex: random(), sourceCidrs: random(), methods: random(), headers: random() },
      actions: Array.from({length:crypto.randomInt(6)},()=>({type:String(random() ?? ''),requests:random(),windowSeconds:random(),headers:random(),regex:random()})),
    })),
  });
  try {
    const outcome = await evaluatePolicy({...document,id:`fuzz-${index}`},{method:'GET',host:'fuzz.local',path:'/test',sourceIp:'127.0.0.1',headers:{}});
    assert.equal(typeof outcome.allowed,'boolean');
    assert.ok(Number.isFinite(outcome.status));
  } catch (error) {
    rejected++;
    assert.ok(error instanceof Error);
  }
}
const hash=hashPolicySecret('secret');
assert.match(hash,/^scrypt\$/);
assert.ok(rejected < iterations * .25,`Taxa inesperada de exceções: ${rejected}/${iterations}`);
console.log(JSON.stringify({iterations,rejected},null,2));
console.log('SECURITY_FUZZ_OK');
