(() => {
  const FUNCTION_NAME = 'studio-assistente-manuale';
  const client = () => window.getStudioSupabaseClient?.() || window.STUDIO_SUPABASE_CLIENT;
  let history = [];
  let panel = null;
  let messages = null;
  let input = null;
  let sendBtn = null;

  const addMessage = (role, text, source = false) => {
    const row = document.createElement('div');
    row.className = 'studio-assistant-msg ' + role;
    const bubble = document.createElement('div');
    bubble.className = 'studio-assistant-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    if (source) {
      const src = document.createElement('div');
      src.className = 'studio-assistant-source';
      src.textContent = 'Fonte: Manuale Operativo Online';
      row.appendChild(src);
    }
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  };

  const setBusy = (busy) => {
    input.disabled = busy;
    sendBtn.disabled = busy;
    sendBtn.textContent = busy ? 'Invio…' : 'Invia';
  };

  const send = async () => {
    const question = input.value.trim();
    if (!question || sendBtn.disabled) return;
    addMessage('user', question);
    input.value = '';
    setBusy(true);
    const previous = history.slice(-6);
    history.push({ role:'user', content:question });

    try {
      const supabase = client();
      if (!supabase) throw new Error('Servizio di accesso non disponibile.');
      const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
        body: { message: question, history: previous }
      });
      if (error) throw new Error(error.message || 'Errore nella richiesta.');
      if (!data?.answer) throw new Error(data?.error || 'Risposta non disponibile.');
      addMessage('assistant', data.answer, true);
      history.push({ role:'assistant', content:data.answer });
    } catch (err) {
      addMessage('assistant', 'Non riesco a rispondere in questo momento. ' + (err?.message || 'Controlla l accesso Studio e riprova.'));
      history.pop();
    } finally {
      setBusy(false);
      input.focus();
    }
  };

  const open = () => {
    panel.classList.add('open');
    input.focus();
  };
  const close = () => panel.classList.remove('open');

  const init = () => {
    if (document.getElementById('studioAssistantLauncher')) return;

    const style = document.createElement('style');
    style.textContent = `
      #studioAssistantLauncher{position:fixed;right:22px;bottom:22px;z-index:12000;border:1px solid rgba(255,255,255,.58);border-radius:999px;padding:13px 18px;cursor:pointer;color:#fff;font:800 13px Segoe UI,Arial,sans-serif;background:linear-gradient(135deg,rgba(30,64,175,.96),rgba(15,23,42,.96));box-shadow:0 14px 34px rgba(15,23,42,.28);backdrop-filter:blur(10px)}
      #studioAssistantLauncher:hover{transform:translateY(-1px)}
      #studioAssistantPanel{position:fixed;right:22px;bottom:82px;z-index:12001;width:min(430px,calc(100vw - 28px));height:min(650px,calc(100vh - 120px));display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.62);border-radius:22px;background:rgba(248,250,252,.97);box-shadow:0 24px 80px rgba(15,23,42,.30);font-family:Segoe UI,Arial,sans-serif}
      #studioAssistantPanel.open{display:flex}
      .studio-assistant-head{padding:16px 18px;color:#fff;background:linear-gradient(135deg,#0f172a,#1e3a5f);display:flex;align-items:center;justify-content:space-between;gap:12px}
      .studio-assistant-head strong{font-size:15px}.studio-assistant-head small{display:block;margin-top:3px;color:#cbd5e1;font-size:11px}
      .studio-assistant-close{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}
      #studioAssistantMessages{flex:1;overflow:auto;padding:16px;background:linear-gradient(180deg,#f8fafc,#eef2f7)}
      .studio-assistant-msg{display:flex;flex-direction:column;margin:0 0 12px}.studio-assistant-msg.user{align-items:flex-end}.studio-assistant-msg.assistant{align-items:flex-start}
      .studio-assistant-bubble{max-width:88%;padding:11px 13px;border-radius:14px;white-space:pre-wrap;line-height:1.48;font-size:13px}
      .studio-assistant-msg.user .studio-assistant-bubble{background:#1e3a8a;color:#fff;border-bottom-right-radius:4px}
      .studio-assistant-msg.assistant .studio-assistant-bubble{background:#fff;color:#172033;border:1px solid #dbe2ea;border-bottom-left-radius:4px}
      .studio-assistant-source{margin:4px 4px 0;color:#64748b;font-size:10px}
      .studio-assistant-composer{padding:12px;border-top:1px solid #dbe2ea;background:#fff;display:flex;gap:8px}
      #studioAssistantInput{flex:1;min-width:0;resize:none;height:44px;padding:11px 12px;border:1px solid #cbd5e1;border-radius:11px;outline:none;font:13px Segoe UI,Arial,sans-serif}
      #studioAssistantInput:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.10)}
      #studioAssistantSend{border:0;border-radius:11px;padding:0 14px;background:#1e3a8a;color:#fff;font-weight:800;cursor:pointer}
      #studioAssistantSend:disabled{opacity:.6;cursor:wait}
      @media(max-width:600px){#studioAssistantLauncher{right:14px;bottom:14px}#studioAssistantPanel{right:14px;bottom:70px;height:min(620px,calc(100vh - 90px))}}
    `;
    document.head.appendChild(style);

    const launcher = document.createElement('button');
    launcher.id = 'studioAssistantLauncher';
    launcher.type = 'button';
    launcher.textContent = '💬 Assistente Studio';
    document.body.appendChild(launcher);

    panel = document.createElement('section');
    panel.id = 'studioAssistantPanel';
    panel.setAttribute('aria-label','Assistente Operativo Studio Legale Silella');
    panel.innerHTML = `
      <div class="studio-assistant-head">
        <div><strong>Assistente Operativo Studio Legale Silella</strong><small>Risponde sulla base del Manuale Operativo e delle FAQ.</small></div>
        <button class="studio-assistant-close" type="button">Chiudi</button>
      </div>
      <div id="studioAssistantMessages"></div>
      <form class="studio-assistant-composer">
        <textarea id="studioAssistantInput" maxlength="1200" placeholder="Es. Come registro una nuova udienza?" aria-label="Domanda"></textarea>
        <button id="studioAssistantSend" type="submit">Invia</button>
      </form>`;
    document.body.appendChild(panel);

    messages = panel.querySelector('#studioAssistantMessages');
    input = panel.querySelector('#studioAssistantInput');
    sendBtn = panel.querySelector('#studioAssistantSend');

    addMessage('assistant','Ciao. Posso aiutarti a usare il gestionale cercando la procedura nel Manuale Operativo.\n\nProva, ad esempio: “Come registro una nuova udienza?” oppure “Dove trovo un documento del cliente?”');
    launcher.addEventListener('click', open);
    panel.querySelector('.studio-assistant-close').addEventListener('click', close);
    panel.querySelector('form').addEventListener('submit', e => { e.preventDefault(); send(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();