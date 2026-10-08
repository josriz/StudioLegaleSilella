(() => {
  const FUNCTION_NAME = 'studio-assistente-cliente';
  const client = () => window.STUDIO_SUPABASE_CLIENT || window.sb;
  let history = [], panel, messages, input, sendBtn;

  const addMessage = (role, text, source=false) => {
    const row=document.createElement('div'); row.className='client-assistant-msg '+role;
    const bubble=document.createElement('div'); bubble.className='client-assistant-bubble'; bubble.textContent=text; row.appendChild(bubble);
    if(source){const s=document.createElement('div');s.className='client-assistant-source';s.textContent='Fonte: Manuale Operativo';row.appendChild(s);}
    messages.appendChild(row); messages.scrollTop=messages.scrollHeight;
  };
  const busy=v=>{input.disabled=v;sendBtn.disabled=v;sendBtn.textContent=v?'Invio…':'Invia';};
  const send=async()=>{
    const q=input.value.trim(); if(!q||sendBtn.disabled)return;
    addMessage('user',q); input.value=''; busy(true);
    const prev=history.slice(-6); history.push({role:'user',content:q});
    try{
      const sb=client(); if(!sb)throw new Error('Servizio di accesso non disponibile.');
      const {data,error}=await sb.functions.invoke(FUNCTION_NAME,{body:{message:q,history:prev}});
      if(error)throw new Error(error.message||'Errore nella richiesta.');
      if(!data?.answer)throw new Error(data?.error||'Risposta non disponibile.');
      addMessage('assistant',data.answer,true); history.push({role:'assistant',content:data.answer});
    }catch(e){addMessage('assistant','Non riesco a rispondere in questo momento. '+(e?.message||'Controlla l accesso al portale e riprova.'));history.pop();}
    finally{busy(false);input.focus();}
  };
  const init=()=>{
    if(document.getElementById('clientAssistantLauncher'))return;
    const style=document.createElement('style');
    style.textContent=`
      #clientAssistantLauncher{position:fixed;right:22px;bottom:22px;z-index:12000;border:1px solid rgba(255,255,255,.58);border-radius:999px;padding:13px 18px;cursor:pointer;color:#fff;font:800 13px Segoe UI,Arial,sans-serif;background:linear-gradient(135deg,rgba(90,58,34,.97),rgba(15,23,42,.96));box-shadow:0 14px 34px rgba(15,23,42,.28);backdrop-filter:blur(10px)}
      #clientAssistantPanel{position:fixed;right:22px;bottom:82px;z-index:12001;width:min(430px,calc(100vw - 28px));height:min(650px,calc(100vh - 120px));display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.62);border-radius:22px;background:rgba(248,250,252,.97);box-shadow:0 24px 80px rgba(15,23,42,.30);font-family:Segoe UI,Arial,sans-serif}
      #clientAssistantPanel.open{display:flex}.client-assistant-head{padding:16px 18px;color:#fff;background:linear-gradient(135deg,#4b3021,#1e293b);display:flex;align-items:center;justify-content:space-between;gap:12px}
      .client-assistant-head strong{font-size:15px}.client-assistant-head small{display:block;margin-top:3px;color:#e2e8f0;font-size:11px}.client-assistant-close{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}
      #clientAssistantMessages{flex:1;overflow:auto;padding:16px;background:linear-gradient(180deg,#f8fafc,#eef2f7)}.client-assistant-msg{display:flex;flex-direction:column;margin:0 0 12px}
      .client-assistant-msg.user{align-items:flex-end}.client-assistant-msg.assistant{align-items:flex-start}.client-assistant-bubble{max-width:88%;padding:11px 13px;border-radius:14px;white-space:pre-wrap;line-height:1.48;font-size:13px}
      .client-assistant-msg.user .client-assistant-bubble{background:#5b3a25;color:#fff;border-bottom-right-radius:4px}.client-assistant-msg.assistant .client-assistant-bubble{background:#fff;color:#172033;border:1px solid #dbe2ea;border-bottom-left-radius:4px}
      .client-assistant-source{margin:4px 4px 0;color:#64748b;font-size:10px}.client-assistant-composer{padding:12px;border-top:1px solid #dbe2ea;background:#fff;display:flex;gap:8px}
      #clientAssistantInput{flex:1;min-width:0;resize:none;height:44px;padding:11px 12px;border:1px solid #cbd5e1;border-radius:11px;outline:none;font:13px Segoe UI,Arial,sans-serif}
      #clientAssistantInput:focus{border-color:#8a6a2e;box-shadow:0 0 0 3px rgba(138,106,46,.10)}#clientAssistantSend{border:0;border-radius:11px;padding:0 14px;background:#5b3a25;color:#fff;font-weight:800;cursor:pointer}
      #clientAssistantSend:disabled{opacity:.6;cursor:wait}@media(max-width:600px){#clientAssistantLauncher{right:14px;bottom:14px}#clientAssistantPanel{right:14px;bottom:70px;height:min(620px,calc(100vh - 90px))}}
    `;
    document.head.appendChild(style);
    const launcher=document.createElement('button');launcher.id='clientAssistantLauncher';launcher.type='button';launcher.textContent='💬 Assistente Cliente';document.body.appendChild(launcher);
    panel=document.createElement('section');panel.id='clientAssistantPanel';panel.setAttribute('aria-label','Assistente Operativo Area Cliente');
    panel.innerHTML=`<div class="client-assistant-head"><div><strong>Assistente Operativo Area Cliente</strong><small>Ti aiuta a usare il Portale Cliente sulla base del Manuale Operativo.</small></div><button class="client-assistant-close" type="button">Chiudi</button></div><div id="clientAssistantMessages"></div><form class="client-assistant-composer"><textarea id="clientAssistantInput" maxlength="1200" placeholder="Es. Come carico un documento?" aria-label="Domanda"></textarea><button id="clientAssistantSend" type="submit">Invia</button></form>`;
    document.body.appendChild(panel);messages=panel.querySelector('#clientAssistantMessages');input=panel.querySelector('#clientAssistantInput');sendBtn=panel.querySelector('#clientAssistantSend');
    addMessage('assistant','Ciao. Posso aiutarti a usare il Portale Cliente cercando la procedura nel Manuale Operativo.\n\nProva, ad esempio: “Come carico un documento?” oppure “Dove vedo le comunicazioni dello Studio?”');
    launcher.onclick=()=>{panel.classList.add('open');input.focus()};panel.querySelector('.client-assistant-close').onclick=()=>panel.classList.remove('open');
    panel.querySelector('form').onsubmit=e=>{e.preventDefault();send()};input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();