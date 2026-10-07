(() => {
  'use strict';

  const getClient = () => window.STUDIO_SUPABASE_CLIENT;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = v => v ? new Date(v).toLocaleString('it-IT') : '—';

  const state = {
    config: null,
    consultations: [],
    documents: [],
    events: [],
    payments: [],
    reginde: [],
    offices: [],
    jobs: []
  };

  async function load() {
    const c = getClient();
    if (!c) throw new Error('Supabase non disponibile.');
    const [{data:config,error:e1},{data:consultations,error:e2},{data:documents,error:e3},{data:events,error:e4},{data:payments,error:e5},{data:reginde,error:e6},{data:offices,error:e7},{data:jobs,error:e8}] = await Promise.all([
      c.from('studio_pst_config').select('*').maybeSingle(),
      c.from('studio_pst_consultazioni').select('*').order('requested_at',{ascending:false}).limit(100),
      c.from('studio_pst_documenti').select('*').order('first_seen_at',{ascending:false}).limit(100),
      c.from('studio_pst_eventi').select('*').order('created_at',{ascending:false}).limit(100),
      c.from('studio_pst_pagamenti').select('*').order('created_at',{ascending:false}).limit(100),
      c.from('studio_pst_reginde').select('*').order('last_synced_at',{ascending:false}).limit(100),
      c.from('studio_pst_uffici').select('*').order('descrizione',{ascending:true}).limit(500),
      c.from('studio_pst_sync_jobs').select('*').order('created_at',{ascending:false}).limit(100)
    ]);
    for (const e of [e1,e2,e3,e4,e5,e6,e7,e8]) if (e) throw e;
    state.config=config||null; state.consultations=consultations||[]; state.documents=documents||[];
    state.events=events||[]; state.payments=payments||[]; state.reginde=reginde||[];
    state.offices=offices||[]; state.jobs=jobs||[];
  }

  function ensureMenu() {
    if (document.querySelector('[data-pst-menu]')) return;
    const pct = Array.from(document.querySelectorAll('.menu-item')).find(x => (x.getAttribute('onclick')||'').includes("'pct-deposit'"));
    if (!pct) return;
    const a = document.createElement('a');
    a.className='menu-item';
    a.href='javascript:void(0)';
    a.setAttribute('data-pst-menu','1');
    a.innerHTML='<span class="menu-photo"><img src="https://cdn.jsdelivr.net/npm/@tabler/icons@3.34.0/icons/outline/building-bank.svg" alt="" aria-hidden="true"></span><span>PST Ministero · Consultazione</span>';
    a.onclick = e => { e.preventDefault(); openPanel(); };
    pct.parentNode.insertBefore(a,pct.nextSibling);
  }

  function ensurePanel() {
    if (document.getElementById('panel-pst-ministero')) return;
    const wrap=document.querySelector('.content-area');
    if(!wrap) return;
    const p=document.createElement('div');
    p.id='panel-pst-ministero';
    p.className='panel';
    wrap.appendChild(p);
  }

  function configCard() {
    const c=state.config||{};
    const status=c.connection_status||'non_configurata';
    const badge=status==='verificata'?'#166534':status==='errore'?'#991b1b':'#92400e';
    return '<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">'+
      '<div><h3>🏛️ PST Ministero — integrazione diretta</h3><div style="font-size:12px;color:#64748b">Configurazione del canale Software House/PdA e gestione dei servizi ministeriali disponibili.</div></div>'+
      '<span style="padding:6px 10px;border-radius:14px;background:#fef3c7;color:'+badge+';font-size:12px;font-weight:700">'+esc(status)+'</span></div>'+
      '<div style="margin-top:12px;padding:10px;border:1px solid #dbe4ec;border-radius:8px;background:#f8fafc;font-size:12px;color:#475569"><strong>Stato reale:</strong> questa schermata prepara e registra le operazioni. La consultazione ministeriale reale si abilita quando saranno disponibili censimento, certificato/canale e connettore tecnico richiesti dal PST. Non vengono simulate risposte ministeriali.</div>'+
      '<form id="pstConfigForm" style="margin-top:14px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
      '<div class="form-group"><label>Modalità</label><select id="pstMode"><option value="software_house">Software House</option><option value="pda">Punto di Accesso</option><option value="provider">Provider esterno</option><option value="manual">Manuale / test</option></select></div>'+
      '<div class="form-group"><label>Proxy / endpoint</label><input id="pstProxy" placeholder="URL del proxy PST" value="'+esc(c.proxy_base_url||'')+'"></div>'+
      '<div class="form-group"><label>Codice Software House / soggetto</label><input id="pstCode" value="'+esc(c.software_house_code||'')+'"></div>'+
      '<div class="form-group"><label>Codice fiscale soggetto</label><input id="pstCf" value="'+esc(c.soggetto_codice_fiscale||'')+'"></div>'+
      '<div class="form-group"><label>Etichetta certificato</label><input id="pstCertLabel" value="'+esc(c.certificate_label||'')+'"></div>'+
      '<div class="form-group"><label>Scadenza certificato</label><input id="pstCertExpiry" type="date" value="'+(c.certificate_expires_at?String(c.certificate_expires_at).slice(0,10):'')+'"></div>'+
      '</div><div class="form-group"><label>Note / requisiti</label><textarea id="pstNotes" style="min-height:70px">'+esc(c.notes||'')+'</textarea></div>'+
      '<label style="display:flex;gap:8px;align-items:center;font-size:12px"><input id="pstEnabled" type="checkbox" '+(c.enabled?'checked':'')+'> Abilita la configurazione per il futuro connettore</label>'+
      '<div id="pstConfigStatus" style="font-size:12px;margin-top:8px"></div><button class="btn btn-success" type="submit" style="margin-top:8px">Salva configurazione PST</button></form></div>';
  }

  function serviceCard() {
    const services=[
      ['fascicolo','Consultazione fascicoli','Registri SICID/SIECIC/SIGP/Cassazione secondo ruolo e abilitazioni.'],
      ['documenti','Accesso e download documenti','Metadati e recupero documenti elettronici collegati al fascicolo.'],
      ['comunicazioni','Comunicazioni / notifiche','Recupero dei messaggi di comunicazione/notifica previsti dal servizio.'],
      ['reginde','ReGIndE','Ricerca soggetti, PEC, ruoli ed enti censiti.'],
      ['uffici','Catalogo Uffici Giudiziari','Uffici, registri e dati utili alla destinazione del deposito.'],
      ['pagamenti','Pagamenti telematici','Gestione interna di richieste, avvisi, ricevute ed esiti del servizio ministeriale.'],
      ['eventi','Sincronizzazione eventi','Storico e aggiornamento degli eventi ministeriali nel fascicolo.']
    ];
    return '<div class="card"><h3>Servizi PST predisposti</h3><div class="grid-2" style="margin-top:12px">'+services.map(([type,title,desc])=>
      '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fff"><strong>'+title+'</strong><p style="font-size:12px;color:#64748b;margin:6px 0 10px">'+desc+'</p><button class="btn btn-info" data-pst-service="'+type+'">Prepara interrogazione</button></div>'
    ).join('')+'</div></div>';
  }

  function statusCard() {
    const c=state.consultations;
    const counts={completed:0,queued:0,running:0,not_configured:0,error:0,not_authorized:0};
    c.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);
    return '<div class="card"><h3>Registro interrogazioni</h3><div class="grid-3" style="margin-top:10px">'+
      [['Completate',counts.completed],['In coda',counts.queued+counts.running],['Da abilitare',counts.not_configured+counts.not_authorized]].map(x=>'<div class="stat-card"><span>'+x[0]+'</span><h4>'+x[1]+'</h4></div>').join('')+
      '</div><div style="overflow:auto"><table><thead><tr><th>Data</th><th>Servizio</th><th>Registro</th><th>Stato</th><th>Errore</th></tr></thead><tbody>'+
      (c.slice(0,30).map(x=>'<tr><td>'+fmt(x.requested_at)+'</td><td>'+esc(x.service_name)+'</td><td>'+esc(x.registry||'—')+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.error_message||'—')+'</td></tr>').join('')||'<tr><td colspan="5">Nessuna interrogazione registrata.</td></tr>')+
      '</tbody></table></div></div>';
  }

  function localDataCards() {
    return '<div class="grid-2"><div class="card"><h3>Documenti PST acquisiti</h3><div style="font-size:13px">'+state.documents.length+' record</div></div>'+
      '<div class="card"><h3>Eventi PST acquisiti</h3><div style="font-size:13px">'+state.events.length+' record</div></div>'+
      '<div class="card"><h3>Pagamenti telematici</h3><div style="font-size:13px">'+state.payments.length+' record</div></div>'+
      '<div class="card"><h3>Cache ReGIndE / Uffici</h3><div style="font-size:13px">'+state.reginde.length+' soggetti · '+state.offices.length+' uffici</div></div></div>';
  }

  async function saveConfig(e) {
    e.preventDefault();
    const c=getClient(); const out=document.getElementById('pstConfigStatus');
    out.textContent='Salvataggio…';
    const payload={
      id:true,enabled:document.getElementById('pstEnabled').checked,
      integration_mode:document.getElementById('pstMode').value,
      proxy_base_url:document.getElementById('pstProxy').value.trim()||null,
      software_house_code:document.getElementById('pstCode').value.trim()||null,
      soggetto_codice_fiscale:document.getElementById('pstCf').value.trim()||null,
      certificate_label:document.getElementById('pstCertLabel').value.trim()||null,
      certificate_expires_at:document.getElementById('pstCertExpiry').value||null,
      notes:document.getElementById('pstNotes').value.trim()||null,
      updated_by:window.STUDIO_CURRENT_USER_ID||null,
      connection_status:'configurata',
      updated_at:new Date().toISOString()
    };
    const {error}=await c.from('studio_pst_config').upsert(payload,{onConflict:'id'});
    out.textContent=error?'Errore: '+error.message:'Configurazione salvata. Nessuna chiamata ministeriale è stata simulata.';
    if(!error){await load();render();}
  }

  async function prepareService(type) {
    const c=getClient();
    const serviceMap={
      fascicolo:'consultazione_fascicoli',documenti:'accesso_documenti',comunicazioni:'download_comunicazioni_notifiche',
      reginde:'accesso_reginde',uffici:'catalogo_uffici',pagamenti:'consultazione_pagamenti',eventi:'sincronizzazione_eventi'
    };
    const registry=type==='fascicolo'||type==='documenti'||type==='eventi'?'SICID/SIECIC/SIGP':'PST';
    const {data:{user}}=await c.auth.getUser();
    const {error}=await c.from('studio_pst_consultazioni').insert({
      requested_by:user.id,service_name:serviceMap[type],registry,role_code:type==='reginde'?'AVV':'AVV',
      status:(state.config&&state.config.enabled&&state.config.connection_status==='verificata')?'queued':'not_configured',
      query_params:{source:'Lexroom',service:type}
    });
    if(error) alert('Errore: '+error.message); else {await load();render();}
  }

  async function openPanel() {
    ensurePanel();
    try { await load(); render(); } catch(e) { document.getElementById('panel-pst-ministero').innerHTML='<div class="card"><h3>PST Ministero</h3><div style="color:#b91c1c">'+esc(e.message)+'</div></div>'; }
    const item=document.querySelector('[data-pst-menu]');
    if(typeof window.switchTab==='function') window.switchTab('pst-ministero',item);
    else {document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));document.getElementById('panel-pst-ministero').classList.add('active');}
  }

  function render() {
    const p=document.getElementById('panel-pst-ministero'); if(!p)return;
    p.innerHTML=configCard()+serviceCard()+statusCard()+localDataCards();
    const mode=state.config?.integration_mode||'software_house';
    const sel=document.getElementById('pstMode'); if(sel)sel.value=mode;
    document.getElementById('pstConfigForm').onsubmit=saveConfig;
    document.querySelectorAll('[data-pst-service]').forEach(b=>b.onclick=()=>prepareService(b.dataset.pstService));
  }

  function boot() {
    ensureMenu(); ensurePanel();
    setTimeout(()=>ensureMenu(),500);
    setTimeout(()=>ensureMenu(),1500);
  }

  document.addEventListener('DOMContentLoaded',boot);
  window.addEventListener('load',()=>setTimeout(boot,300));
  window.openPstMinistero=openPanel;
})();