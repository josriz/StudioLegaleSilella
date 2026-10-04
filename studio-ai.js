(() => {
  const getClient = () => window.STUDIO_SUPABASE_CLIENT;
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fn = () => (window.STUDIO_SUPABASE_URL || '') + '/functions/v1/studio-lexroom';

  async function callAI(body) {
    const c=getClient();
    if(!c) return {ok:false,error:'Supabase non disponibile.'};
    const {data:{session},error}=await c.auth.getSession();
    if(error || !session?.access_token) return {ok:false,error:'Sessione Studio non disponibile. Effettua nuovamente l’accesso.'};
    try {
      const r=await fetch(fn(),{
        method:'POST',
        headers:{apikey:window.STUDIO_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'content-type':'application/json'},
        body:JSON.stringify(body)
      });
      return await r.json().catch(()=>({ok:false,error:'Risposta AI non valida.'}));
    } catch(e) {
      return {ok:false,error:e?.message||'Errore di collegamento al servizio AI.'};
    }
  }

  async function practices() {
    const c=getClient();
    if(!c) return [];
    const {data}=await c.from('studio_pratiche').select('id,client_name,legal_area,counterparty').order('created_at',{ascending:false}).limit(50);
    return data||[];
  }

  function card(title,html,id) {
    return '<div class="card studio-free-ai-card" id="'+id+'" style="margin-top:12px;background:rgba(248,250,252,.96);border:1px solid #cbd5e1">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">'+title+'</h3><span style="font-size:11px;color:#166534;background:#dcfce7;padding:5px 8px;border-radius:10px">AI GRATUITA · LAB</span></div>'+html+'</div>';
  }

  async function mountMatters() {
    const panel=document.getElementById('panel-matters');
    if(!panel) return;

    const detail=document.getElementById('matterDetail');
    const detailOpen=detail && getComputedStyle(detail).display !== 'none';
    const target=detailOpen ? detail : panel;

    const existing=document.getElementById('freeAiMatter');
    if(existing && existing.parentElement !== target) existing.remove();
    if(document.getElementById('freeAiMatter')) return;

    const html='<div class="form-group" style="margin-top:10px"><label>Fascicolo da analizzare</label><select id="freeAiMatterSelect" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px"></select></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-info" id="freeAiMatterRun">Analizza fascicolo con AI</button><button class="btn" id="freeAiMatterClear">Pulisci</button></div>'+
      '<div id="freeAiMatterResult" style="display:none;margin-top:12px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;white-space:pre-wrap;font-size:13px;line-height:1.5"></div>';

    target.insertAdjacentHTML('beforeend',card('🧠 Assistente AI per Fascicoli',html,'freeAiMatter'));

    const sel=document.getElementById('freeAiMatterSelect');
    const list=await practices();
    if(!sel) return;
    sel.innerHTML='<option value="">— seleziona fascicolo —</option>'+list.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.client_name)+' · '+esc(x.legal_area||'')+' · '+esc(x.counterparty||'')+'</option>').join('');

    const currentMatter=detailOpen ? (window.__studioMatters||[]).find(m=>m && sel && m.id===sel.value) : null;

    document.getElementById('freeAiMatterRun').onclick=async()=>{
      if(!sel.value)return alert('Seleziona un fascicolo.');
      const box=document.getElementById('freeAiMatterResult'); box.style.display='block'; box.textContent='Analisi AI in corso…';
      const out=await callAI({practiceId:sel.value,action:'matter_ai'});
      box.textContent=out.ok?(out.text||'Nessun testo restituito.'):(out.error||'Analisi non disponibile.');
    };
    document.getElementById('freeAiMatterClear').onclick=()=>{document.getElementById('freeAiMatterResult').style.display='none';};

    if(currentMatter && sel) sel.value=currentMatter.id;
  }
  async function mountRag() {
    const p=document.getElementById('panel-jurisprudence');
    if(!p || document.getElementById('freeAiRag')) return;
    const html='<div class="form-group" style="margin-top:10px"><label>Domanda all’AI sul patrimonio dello Studio</label><textarea id="freeAiRagQuery" style="width:100%;min-height:85px;padding:9px;border:1px solid #cbd5e1;border-radius:6px" placeholder="Es. quali fascicoli riguardano il condominio e quali attività risultano già registrate?"></textarea></div>'+
      '<button class="btn btn-info" id="freeAiRagRun">Interroga AI gratuitamente</button>'+
      '<div id="freeAiRagResult" style="display:none;margin-top:12px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;white-space:pre-wrap;font-size:13px;line-height:1.5"></div>';
    p.insertAdjacentHTML('beforeend',card('🧠 AI + Ricerca interna dello Studio',html,'freeAiRag'));
    document.getElementById('freeAiRagRun').onclick=async()=>{
      const q=document.getElementById('freeAiRagQuery').value.trim(); if(!q)return alert('Inserisci una domanda.');
      const box=document.getElementById('freeAiRagResult'); box.style.display='block'; box.textContent='Ricerca AI in corso…';
      const out=await callAI({action:'rag_ai',query:q});
      box.textContent=out.ok?(out.text||'Nessun testo restituito.'):(out.error||'Ricerca AI non disponibile.');
    };
  }

  async function mountArchive() {
    const p=document.getElementById('panel-archive');
    if(!p || document.getElementById('freeAiArchive')) return;
    const html='<div class="form-group" style="margin-top:10px"><label>Domanda sull’archivio</label><input id="freeAiArchiveQuery" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px" placeholder="Es. evidenzia anomalie o passaggi mancanti nell’archivio recente"></div>'+
      '<button class="btn btn-info" id="freeAiArchiveRun">Analizza archivio con AI</button>'+
      '<div id="freeAiArchiveResult" style="display:none;margin-top:12px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;white-space:pre-wrap;font-size:13px;line-height:1.5"></div>';
    p.insertAdjacentHTML('beforeend',card('🧠 Assistente AI per Archivio & Audit',html,'freeAiArchive'));
    document.getElementById('freeAiArchiveRun').onclick=async()=>{
      const q=document.getElementById('freeAiArchiveQuery').value.trim();
      const box=document.getElementById('freeAiArchiveResult'); box.style.display='block'; box.textContent='Analisi archivio in corso…';
      const out=await callAI({action:'archive_ai',query:q||undefined});
      box.textContent=out.ok?(out.text||'Nessun testo restituito.'):(out.error||'Analisi archivio non disponibile.');
    };
  }

  async function mountRedaction() {
    const p=document.getElementById('panel-ai-generator');
    if(!p || document.getElementById('freeAiDraftPractice')) return;
    const first=p.querySelector('.card');
    if(!first)return;
    const wrap=document.createElement('div');
    wrap.id='freeAiDraftPractice';
    wrap.style.marginBottom='10px';
    wrap.innerHTML='<label style="display:block;font-size:12px;font-weight:600;margin-bottom:5px">Fascicolo di riferimento</label><select id="freeAiDraftSelect" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px"><option>Caricamento…</option></select><div style="font-size:11px;color:#64748b;margin-top:5px">L’AI gratuita usa i dati del fascicolo e i modelli dello Studio disponibili in Supabase.</div>';
    const textarea=document.getElementById('caseDescription');
    textarea?.parentElement?.before(wrap);
    const sel=document.getElementById('freeAiDraftSelect'), list=await practices();
    sel.innerHTML='<option value="">— seleziona fascicolo —</option>'+list.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.client_name)+' · '+esc(x.legal_area||'')+' · '+esc(x.counterparty||'')+'</option>').join('');
    window.__freeAiDraftPracticeSelect=sel;
  }

  let draftBusy = false;

  function draftPanel() {
    let box = document.getElementById('freeAiDraftStatus');
    if (box) return box;
    const outBox = document.getElementById('aiOutputResult');
    if (!outBox) return null;
    box = document.createElement('div');
    box.id = 'freeAiDraftStatus';
    box.style.cssText = 'margin-top:12px;padding:12px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;';
    outBox.parentElement.appendChild(box);
    return box;
  }

  function renderDraftState(state) {
    const box = draftPanel();
    if (!box) return;
    if (!state?.draft) {
      box.innerHTML = '';
      box.style.display = 'none';
      return;
    }

    const d = state.draft;
    const approved = d.status === 'approvata';
    const communication = state.communication || null;

    box.style.display = 'block';
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<strong>' + (approved ? '✅ Bozza approvata' : '📝 Bozza salvata automaticamente') + '</strong>' +
        '<span style="font-size:11px;padding:4px 8px;border-radius:10px;background:' +
          (approved ? '#dcfce7;color:#166534' : '#fef3c7;color:#92400e') + '">' +
          esc(d.status || 'in_revisione') + '</span>' +
      '</div>' +
      '<div style="margin-top:6px;font-size:12px;color:#475569">' +
        'Versione ' + esc(d.version_no || 1) + ' · ID bozza ' + esc(d.id || '') +
      '</div>' +
      '<div style="margin-top:7px;font-size:12px;color:#64748b">' +
        (approved
          ? 'La bozza è stata approvata. Da questo momento è possibile preparare una comunicazione LAB; nessuna email reale viene inviata.' 
          : 'Il salvataggio è automatico: non serve un pulsante “Salva versione”. La bozza resta in revisione finché lo Studio non la approva.') +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
        (!approved ? '<button class="btn btn-success" type="button" id="freeAiApproveDraft">Approva bozza</button>' : '') +
        (approved ? '<button class="btn btn-info" type="button" id="freeAiPrepareComm">Prepara comunicazione LAB</button>' : '') +
      '</div>' +
      (communication
        ? '<div style="margin-top:10px;padding:10px;border-radius:8px;background:#ecfeff;border:1px solid #a5f3fc;color:#164e63"><strong>LAB:</strong> comunicazione preparata con stato “da_inviare”. Nessuna email reale è stata inviata.</div>'
        : '') +
      '<div id="freeAiCommunicationBox" style="margin-top:10px;display:none"></div>';

    const approve = document.getElementById('freeAiApproveDraft');
    if (approve) {
      approve.onclick = async () => {
        if (draftBusy) return;
        draftBusy = true;
        approve.disabled = true;
        approve.textContent = 'Approvazione…';
        const out = await callAI({practiceId:d.id_pratica || state.practiceId, action:'approve'});
        draftBusy = false;
        if (!out.ok) {
          approve.disabled = false;
          approve.textContent = 'Approva bozza';
          alert(out.error || 'Approvazione non riuscita.');
          return;
        }
        renderDraftState({practiceId:state.practiceId, draft:out.draft});
      };
    }

    const prepare = document.getElementById('freeAiPrepareComm');
    if (prepare) {
      prepare.onclick = () => {
        const wrap = document.getElementById('freeAiCommunicationBox');
        if (!wrap) return;
        wrap.style.display = 'block';
        wrap.innerHTML =
          '<div style="padding:10px;border:1px solid #bae6fd;border-radius:8px;background:#f0f9ff">' +
            '<div style="font-size:12px;color:#475569;margin-bottom:8px">Simulazione LAB gratuita. La preparazione viene registrata in Supabase; non parte alcuna email reale.</div>' +
            '<input id="freeAiCommRecipient" type="email" placeholder="Destinatario email di test" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:7px">' +
            '<input id="freeAiCommSubject" type="text" value="Comunicazione Studio Legale Silella" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:8px">' +
            '<button class="btn btn-info" type="button" id="freeAiSendLab">Prepara comunicazione LAB</button>' +
            '<div id="freeAiCommResult" style="margin-top:8px;font-size:12px"></div>' +
          '</div>';
        document.getElementById('freeAiSendLab').onclick = async () => {
          const to = document.getElementById('freeAiCommRecipient').value.trim();
          const subject = document.getElementById('freeAiCommSubject').value.trim();
          const result = document.getElementById('freeAiCommResult');
          if (!to) { alert('Inserisci un destinatario di test.'); return; }
          const btn = document.getElementById('freeAiSendLab');
          btn.disabled = true;
          btn.textContent = 'Preparazione…';
          const out = await callAI({practiceId:state.practiceId,action:'lab_send',to,subject});
          btn.disabled = false;
          btn.textContent = 'Prepara comunicazione LAB';
          if (!out.ok) {
            result.style.color = '#b91c1c';
            result.textContent = out.error || 'Preparazione non riuscita.';
            return;
          }
          result.style.color = '#166534';
          result.textContent = out.text || 'Comunicazione preparata in LAB. Nessuna email reale è stata inviata.';
          renderDraftState({practiceId:state.practiceId,draft:state.draft,communication:out.communication});
        };
      };
    }
  }

  window.generateAILetter = async function() {
    if (draftBusy) return;
    const sel=window.__freeAiDraftPracticeSelect;
    const desc=document.getElementById('caseDescription')?.value.trim()||'';
    const outBox=document.getElementById('aiOutputResult');
    const generateBtn=document.querySelector('#panel-ai-generator button[onclick="generateAILetter()"]');
    if(!sel?.value){alert('Seleziona prima il fascicolo di riferimento.');return;}
    if(!desc){alert('Inserisci le istruzioni per la redazione.');return;}

    draftBusy = true;
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generazione e salvataggio…';
    }
    outBox.value='Generazione della bozza AI gratuita in corso…';
    const out=await callAI({practiceId:sel.value,action:'draft_ai',instructions:desc});
    draftBusy = false;
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Genera Bozza con IA 🚀';
    }

    if (!out.ok) {
      outBox.value=out.error||'Generazione non disponibile.';
      renderDraftState(null);
      return;
    }

    outBox.value=out.text||'Nessun testo restituito.';
    renderDraftState({practiceId:sel.value,draft:out.draft});
  };

  async function mountAll(){
    await mountMatters();
    await mountRag();
    await mountArchive();
    await mountRedaction();
  }

  const boot=()=>{
    mountAll();
    [400,1200,2500,5000].forEach(ms=>setTimeout(mountAll,ms));
    document.addEventListener('click',e=>{
      const item=e.target.closest('.menu-item');
      if(!item)return;
      const oc=item.getAttribute('onclick')||'';
      if(/'matters'|'jurisprudence'|'ai-generator'|'archive'/.test(oc)) [120,700,1600].forEach(ms=>setTimeout(mountAll,ms));
      if(item.classList.contains('matter-detail-btn')) [250,800].forEach(ms=>setTimeout(mountMatters,ms));
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();