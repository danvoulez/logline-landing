
// Minimal browser Kernel (no zod, no Node crypto). Hash via WebCrypto.
(function(global){
  function isObj(x){ return x && typeof x==='object' && !Array.isArray(x); }
  function c14nDeep(value){
    if(value===null || typeof value!=='object') return JSON.stringify(value);
    if(Array.isArray(value)) return `[${value.map(c14nDeep).join(',')}]`;
    if(value instanceof Date) return `"${value.toISOString()}"`;
    const keys = Object.keys(value).sort();
    const entries = keys.map(k => `"${k}":${c14nDeep(value[k])}`);
    return `{${entries.join(',')}}`;
  }
  async function sha256Hex(input){
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
    const bytes = new Uint8Array(buf);
    return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function randomHex(n){
    const arr = new Uint8Array(n);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  class MemoryLedger{
    constructor(){ this.spans=new Map(); this.byAction=new Map(); }
    async append(span){ this.spans.set(span.span_id, {...span}); const a=span.intent.action;
      if(!this.byAction.has(a)) this.byAction.set(a,[]); this.byAction.get(a).push(span); }
    async get(id){ return this.spans.get(id)||null; }
    async query({action,since,until,status,limit}={}){
      let res=[];
      if(action && this.byAction.has(action)) res=this.byAction.get(action);
      else res=Array.from(this.spans.values());
      if(since) res=res.filter(s=>s.timestamp>=since);
      if(until) res=res.filter(s=>s.timestamp<=until);
      if(status) res=res.filter(s=>s.receipt.status===status);
      res.sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
      if(limit) res=res.slice(0,limit);
      return res;
    }
    history(){ return Array.from(this.spans.values()); }
  }
  class SystemClock{ nowISO(){return new Date().toISOString()} nowMillis(){return Date.now()} }
  class CryptoIds{ generateSpanId(){return randomHex(8)} generateTraceId(){return randomHex(16)} }

  class LogLineKernel{
    constructor({ledger,clock,idGenerator,initialState,policies,traceId,actorId,sessionId}={}){
      this.ledger = ledger || new MemoryLedger();
      this.clock = clock || new SystemClock();
      this.ids = idGenerator || new CryptoIds();
      this.handlers = new Map();
      this.policies = policies||[];
      this.state = initialState||{};
      this.traceId = traceId || this.ids.generateTraceId();
      this.actorId = actorId; this.sessionId = sessionId;
    }
    registerAction(action, handler){ this.handlers.set(action, {handler}); }
    registerPolicy(policy){ this.policies.push(policy); }
    getState(){ return {...this.state}; }
    async execute(intent, parentSpanId){
      const start = this.clock.nowMillis();
      const spanId = this.ids.generateSpanId();
      const ts = this.clock.nowISO();
      const valid = {
        action: String(intent.action||''),
        params: intent.params||{},
        id: intent.id || spanId,
        timestamp: intent.timestamp || ts,
        metadata: Object.assign({},{actor_id:this.actorId, session_id:this.sessionId}, intent.metadata||{})
      };
      if(!valid.action) return this._reject(valid, 'INVALID_PARAMS', ts, spanId, parentSpanId, start);

      const pre = this.getState();
      const preHash = await sha256Hex(c14nDeep(pre));
      if(valid.metadata.expected_pre_state_hash && valid.metadata.expected_pre_state_hash!==preHash){
        return this._reject(valid, 'STATE_CONFLICT', ts, spanId, parentSpanId, start);
      }

      const ctx = { intent: valid, state: pre, timestamp: ts };
      const evals = this.policies.map(p=>{ try{return p(valid, pre)}catch(e){return {allow:false, code:'EXECUTION_ERROR', reason:String(e)}} });
      const violations = evals.filter(e=>!e.allow);
      if(violations.length>0){
        const reasons = violations.map(v=>v.reason || v.code || 'Policy violation');
        return this._reject(valid, reasons, ts, spanId, parentSpanId, start, evals, pre, preHash);
      }

      const h = this.handlers.get(valid.action);
      if(!h) return this._reject(valid, 'NO_HANDLER', ts, spanId, parentSpanId, start, evals, pre, preHash);

      let patch={};
      try{ patch = await h.handler(valid.params, ctx) || {}; }
      catch(e){ return this._reject(valid, ['EXECUTION_ERROR', String(e)], ts, spanId, parentSpanId, start, evals, pre, preHash); }

      const post = Object.assign({}, pre, patch);
      const postHash = await sha256Hex(c14nDeep(post));
      const execMs = this.clock.nowMillis()-start;

      const receiptPartial = {
        status:'committed',
        intent: valid,
        output: patch,
        receipt_id: await sha256Hex(c14nDeep({intent:valid, pre_state:pre, timestamp:ts, spanId})),
        reasons:['Execution completed successfully'],
        timestamp: ts,
        span_id: spanId,
        parent_span_id: parentSpanId
      };

      const span = {
        span_id: spanId,
        parent_span_id: parentSpanId,
        trace_id: this.traceId,
        span_version: '2.0.0',
        kernel_version: '2.0.0',
        intent: valid,
        receipt: receiptPartial,
        pre_state: pre,
        post_state: post,
        pre_state_hash: preHash,
        post_state_hash: postHash,
        policies_evaluated: evals,
        execution_time_ms: execMs,
        timestamp: ts,
        actor_id: valid.metadata.actor_id,
        session_id: valid.metadata.session_id,
      };
      const spanCanon = c14nDeep(span);
      const spanHash = await sha256Hex(spanCanon);
      const receipt = Object.assign({}, receiptPartial, { hash: spanHash, signature:'', signer_id:'unsigned', signing_alg:'ed25519', key_fingerprint:'none' });

      this.state = post;
      await this.ledger.append(span);
      return receipt;
    }

    async _reject(valid, reasons, ts, spanId, parentSpanId, start, evals=[], pre={}, preHash=null){
      const execMs = this.clock.nowMillis()-start;
      const receiptPartial = {
        status:'rejected',
        intent: valid,
        receipt_id: await sha256Hex(c14nDeep({intent:valid, pre_state:pre, timestamp:ts, spanId})),
        reasons: Array.isArray(reasons)? reasons: [reasons],
        timestamp: ts,
        span_id: spanId,
        parent_span_id: parentSpanId
      };
      const span = {
        span_id: spanId,
        parent_span_id: parentSpanId,
        trace_id: this.traceId,
        span_version: '2.0.0',
        kernel_version: '2.0.0',
        intent: valid,
        receipt: receiptPartial,
        pre_state: pre,
        post_state: pre,
        pre_state_hash: preHash || await sha256Hex(c14nDeep(pre)),
        post_state_hash: preHash || await sha256Hex(c14nDeep(pre)),
        policies_evaluated: evals,
        execution_time_ms: execMs,
        timestamp: ts,
        actor_id: valid.metadata.actor_id,
        session_id: valid.metadata.session_id,
      };
      const spanCanon = c14nDeep(span);
      const spanHash = await sha256Hex(spanCanon);
      const receipt = Object.assign({}, receiptPartial, { hash: spanHash, signature:'', signer_id:'unsigned', signing_alg:'ed25519', key_fingerprint:'none' });
      await this.ledger.append(span);
      return receipt;
    }
  }

  global.LogLineKernel = LogLineKernel;
  global.LogLineMemoryLedger = MemoryLedger;
})(window);
