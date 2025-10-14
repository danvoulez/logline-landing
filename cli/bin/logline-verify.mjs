#!/usr/bin/env node
import fs from 'fs';
import crypto from 'crypto';
import { c14nDeep } from '../lib/c14n.js';
function usage(){console.log('\nLogLine Receipt Verifier\nUSO: node bin/logline-verify.mjs --receipt ./receipt.json --pubkey ./pub.pem [--span ./span.json]\n');}
function readJSON(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function hexToBytes(hex){return Buffer.from(hex,'hex');}
function verifyEd25519(messageBytes, signatureB64, publicKeyPem){
  const pub = crypto.createPublicKey(publicKeyPem);
  return crypto.verify(null, messageBytes, pub, Buffer.from(signatureB64,'base64'));
}
function sha256Str(str){return crypto.createHash('sha256').update(str).digest('hex');}
const args=process.argv.slice(2); const get=(f)=>{const i=args.indexOf(f); return i>=0?args[i+1]:undefined;};
const receiptPath=get('--receipt'); const spanPath=get('--span'); const pubPath=get('--pubkey');
if(!receiptPath||!pubPath){usage();process.exit(2);}
const receipt=readJSON(receiptPath); const publicKeyPem=fs.readFileSync(pubPath,'utf8');
let msgBytes, recomputedHash;
if(spanPath){
  const span=readJSON(spanPath); const canon=c14nDeep(span); recomputedHash=sha256Str(canon); msgBytes=Buffer.from(canon);
}else{
  if(!receipt.hash){console.error('receipt.hash ausente e --span não informado'); process.exit(1);}
  recomputedHash=receipt.hash; msgBytes=hexToBytes(receipt.hash);
}
const ok = verifyEd25519(msgBytes, receipt.signature||'', publicKeyPem);
console.log(JSON.stringify({ verified: !!ok, recomputed_hash: recomputedHash, receipt_hash: receipt.hash, match: recomputedHash===receipt.hash, span_id:receipt.span_id, receipt_id:receipt.receipt_id }, null, 2));
process.exit(ok?0:1);
