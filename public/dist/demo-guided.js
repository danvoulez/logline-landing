
(function(){
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);
  const kernel = new LogLineKernel({ initialState:{ balance:100 }, actorId:'agent-001', sessionId:'sess-001' });

  function limitByAmount(limit){ return (intent, state)=>{
    if(intent.action!=='transfer') return {allow:true, code:'OK'};
    const amount=Number(intent.params?.amount||0);
    return { allow: amount<=limit, code: amount<=limit?'OK':'LIMIT_EXCEEDED', reason: amount<=limit?undefined:'Acima do limite', policy_version:'1.0.0' };
  };}
  function requiredToEmail(intent, state){
    if(intent.action!=='send_email') return {allow:true, code:'OK'};
    const to=(intent.params?.to||'').trim();
    return { allow: !!to, code: !!to?'OK':'REQUIRED_TO', reason: !!to?undefined:'Destinatário é obrigatório', policy_version:'1.0.0' };
  }
  kernel.registerPolicy(limitByAmount(80));
  kernel.registerPolicy(requiredToEmail);

  kernel.registerAction('transfer', async (params, ctx)=>({ balance:(ctx.state.balance||0) - Number(params.amount||0) }));
  kernel.registerAction('send_email', async (params, ctx)=>({ emails_sent: (ctx.state.emails_sent||0)+1, last_email_sent: ctx.timestamp }));

  let scenario='transfer';
  const btns = $$('.scn-btn');
  btns.forEach(b=>b.addEventListener('click', ()=>{
    btns.forEach(x=>x.classList.remove('bg-white','text-black'));
    btns.forEach(x=>x.classList.add('bg-white/10'));
    b.classList.add('bg-white','text-black'); b.classList.remove('bg-white/10');
    scenario = b.getAttribute('data-scn');
    $('#form-transfer').classList.toggle('hidden', scenario!=='transfer');
    $('#form-email').classList.toggle('hidden', scenario!=='email');
    $('#receipt-human').innerHTML = '<p class="text-white/70 text-sm">Sem execução ainda. Clique em <strong>Executar</strong>.</p>';
    $('#receipt-json').textContent = '—';
  }));

  async function runTransfer(){
    const amount = Number($('#amount').value || 0);
    const receipt = await kernel.execute({
      action:'transfer', params:{ amount },
      metadata:{ policy_version:'finops-1.0', model_id:'browser-demo', model_digest:'sha256:demo' }
    });
    renderReceipt(receipt);
  }
  async function runEmail(){
    const to = ($('#to').value||'').trim();
    const subject = $('#subject').value || 'Hello';
    const receipt = await kernel.execute({
      action:'send_email', params:{ to, subject },
      metadata:{ policy_version:'mail-1.0', model_id:'browser-demo', model_digest:'sha256:demo' }
    });
    renderReceipt(receipt);
  }

  function renderReceipt(r){
    const who = r.intent?.metadata?.actor_id || '—';
    const rule = r.intent?.metadata?.policy_version || '—';
    const status = r.status;
    const color = status==='committed' ? 'text-emerald-400' : 'text-rose-400';
    const act = r.intent?.action;

    $('#receipt-human').innerHTML = [
      `<p><strong>Status:</strong> <span class="${color}">${status}</span></p>`,
      `<p><strong>Ação:</strong> ${act}</p>`,
      `<p><strong>Quem (actor_id):</strong> ${who}</p>`,
      `<p><strong>Sob quais regras (policy_version):</strong> ${rule}</p>`,
      `<p><strong>Prova (hash do SPAN):</strong> <code>${r.hash}</code></p>`,
      `<hr class="border-white/10 my-2">`,
      `<p class="text-white/70 text-xs">Dica: se o status for <em>rejected</em>, veja <em>reasons</em> no JSON para entender a policy.</p>`
    ].join('');

    $('#receipt-json').textContent = JSON.stringify(r, null, 2);
  }

  $('#run-transfer').addEventListener('click', runTransfer);
  $('#run-email').addEventListener('click', runEmail);
})();