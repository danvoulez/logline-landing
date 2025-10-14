
// Demo: registra duas ações e duas policies simples, executa intents e mostra os receipts.
(function(){
  const out = () => document.getElementById('out');

  function limitByAmount(limit){
    return (intent, state) => {
      if(intent.action!=='transfer') return { allow:true, code:'OK' };
      const amount = Number(intent.params?.amount||0);
      const allow = amount <= limit;
      return { allow, code: allow?'OK':'LIMIT_EXCEEDED', reason: allow?undefined:'Acima do limite', evidence:{limit, amount}, policy_id:'limitByAmount', policy_version:'1.0.0' };
    };
  }
  function balanceMustBePositive(intent, state){
    if(intent.action!=='transfer') return { allow:true, code:'OK' };
    const next = (state.balance||0) - Number(intent.params?.amount||0);
    const allow = next >= 0;
    return { allow, code: allow?'OK':'BALANCE_GT_ZERO', reason: allow?undefined:'Saldo insuficiente', evidence:{current_balance: state.balance, next} };
  }

  async function run(){
    const kernel = new LogLineKernel({ initialState:{ balance: 100 }, actorId:'user-123', sessionId:'sess-xyz' });
    kernel.registerPolicy(limitByAmount(80));
    kernel.registerPolicy(balanceMustBePositive);

    kernel.registerAction('transfer', async (params, ctx) => {
      return { balance: (ctx.state.balance||0) - Number(params.amount||0) };
    });

    const ok = await kernel.execute({
      action:'transfer',
      params:{ amount: 40 },
      metadata:{ policy_version:'finops-1.0', model_id:'gpt-4o-mini', model_digest:'sha256:demo' }
    });

    const fail = await kernel.execute({
      action:'transfer',
      params:{ amount: 120 }, // viola limite
      metadata:{ policy_version:'finops-1.0', model_id:'gpt-4o-mini', model_digest:'sha256:demo' }
    });

    out().textContent = [
      '=== Receipt #1 (committed) ===',
      JSON.stringify(ok, null, 2),
      '',
      '=== Receipt #2 (rejected) ===',
      JSON.stringify(fail, null, 2)
    ].join('\n');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('runDemo');
    if(btn){ btn.addEventListener('click', run); }
    if(out()) out().textContent = 'Clique em "Rodar demo" para gerar recibos.';
  });
})();
