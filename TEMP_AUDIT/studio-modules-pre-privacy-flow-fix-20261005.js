(() => {
  const getClient = () => window.STUDIO_SUPABASE_CLIENT;
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = v => v ? new Date(v).toLocaleString('it-IT') : '—';
  const day = v => v ? new Date(v).toLocaleDateString('it-IT') : '—';
  const state = {user:null,profile:null,practices:[],docs:[],audit:[],communications:[],team:[],agenda:[],pct:[],time:[],clients:[],bills:[],portalInvites:[],teamInvites:[],portalDocs:[],notifications:[]};

  async function loadData(){
    const c=getClient(); if(!c) throw new Error('Supabase non disponibile.');
    const {data:{user},error:ae}=await c.auth.getUser(); if(ae||!user) throw new Error('Sessione Studio non autenticata.');
    const {data:profile,error:pe}=await c.from('studio_utenti').select('role,full_name').eq('user_id',user.id).maybeSingle();
    if(pe) throw pe; if(!profile || !['studio','admin'].includes(profile.role)) throw new Error('Utente non autorizzato.');
    const qs=[
      c.from('studio_pratiche').select('id,client_name,tax_id,legal_area,counterparty,status,created_at,updated_at,owner_user_id,ai_status,description').order('created_at',{ascending:false}),
      c.from('studio_documenti').select('id,pratica_id,file_name,size_bytes,created_at').order('created_at',{ascending:false}),
      c.from('studio_audit').select('*').order('created_at',{ascending:false}).limit(100),
      c.from('studio_comunicazioni').select('*').order('sent_at',{ascending:false}).limit(100),
      c.from('studio_utenti').select('user_id,role,full_name,created_at').in('role',['studio','admin']).order('created_at',{ascending:true}),
      c.from('studio_agenda').select('*').order('starts_at',{ascending:true}),
      c.from('studio_pct_depositi').select('*').order('created_at',{ascending:false}),
      c.from('studio_time_entries').select('*').order('started_at',{ascending:false}).limit(200),
      c.from('studio_clienti').select('*').order('created_at',{ascending:false}),
      c.from('studio_fatture').select('*').order('issue_date',{ascending:false}),
      c.from('studio_portale_inviti').select('*').order('invited_at',{ascending:false}),
      c.from('studio_professionisti_inviti').select('*').order('invited_at',{ascending:false}),
      c.from('studio_portale_documenti').select('*').order('created_at',{ascending:false}).limit(100),
      c.from('studio_notifiche').select('*').eq('recipient_user_id',user.id).order('created_at',{ascending:false}).limit(100)
    ];
    const rs=await Promise.all(qs); for(const x of rs) if(x.error) throw x.error;
    [state.practices,state.docs,state.audit,state.communications,state.team,state.agenda,state.pct,state.time,state.clients,state.bills,state.portalInvites,state.teamInvites,state.portalDocs,state.notifications]=rs.map(x=>x.data||[]);
    state.user=user; state.profile=profile;
  }
  const panel=(id,html)=>{const p=document.getElementById('panel-'+id); if(p)p.innerHTML=html;};
  const docsFor=id=>state.docs.filter(d=>d.pratica_id===id);
  const practiceOptions=()=>'<option value="">— seleziona —</option>'+state.practices.map(p=>'<option value="'+p.id+'">'+esc(p.client_name)+' · '+esc(p.legal_area||'')+'</option>').join('');
  const isAdmin=()=>state.profile && ['studio','admin'].includes(state.profile.role);
  const auditLabel=t=>({gemini_bozza_generata:'Bozza generata con IA',
  ai_comunicazione_generata:'Comunicazione generata con IA',bozza_approvata:'Bozza approvata dallo Studio',lab_comunicazione_preparata:'Comunicazione LAB preparata',test_flow_created:'Flusso di test creato'}[t]||t||'Attivita');
  const auditText=a=>{const d=a&&a.details||{};if(a.event_type==='gemini_bozza_generata')return 'Modalita LAB gratuita · Modello: '+(d.model||'IA gratuita');if(a.event_type==='bozza_approvata')return 'Bozza approvata · ID: '+(d.bozza_id||'—');if(a.event_type==='lab_comunicazione_preparata')return 'Destinatario: '+(d.recipient||'—')+' · Nessun invio reale';if(a.event_type==='test_flow_created')return 'Flusso Cliente → Studio · Cliente: '+(d.client_email||'—');return Object.keys(d).length?Object.entries(d).map(([k,v])=>k+': '+String(v)).join(' · '):'—'};
  const auditPractice=a=>{const p=state.practices.find(x=>x.id===a.pratica_id);return p?(p.client_name||'Fascicolo')+' · '+(p.legal_area||''):(a.pratica_id?'Fascicolo di test':'—')};

  let studioAuthReady=false;
  async function refreshAll(){
    if(!studioAuthReady){
      renderError('Accesso Studio richiesto.');
      return;
    }
    try{await loadData();renderAll()}catch(e){console.error(e);renderError(e.message)}
  }
  function renderError(msg){['dashboard','team','clients','agenda','pec-client','pct-deposit','time-tracker','billing','client-portal','archive'].forEach(id=>{const p=document.getElementById('panel-'+id);if(p){const b=p.querySelector('[data-module-body]');if(b)b.innerHTML='<div style="padding:14px;color:#b91c1c">'+esc(msg)+'</div>'}})}
  function bindMenu(id,fn){document.querySelectorAll('.menu-item').forEach(m=>{if((m.getAttribute('onclick')||'').includes("'"+id+"'"))m.addEventListener('click',()=>setTimeout(fn,0))})}

  function renderStudioNotifications(){
    const unread=state.notifications.filter(n=>!n.letta_at).length;
    const count=document.getElementById('studioNotifyCount');
    if(count){count.textContent=String(unread);count.style.display=unread?'inline-block':'none';}
    const list=document.getElementById('studioNotifyList');
    if(list) list.innerHTML=state.notifications.length?state.notifications.map(n=>'<div class="studio-notify-row '+(!n.letta_at?'unread':'')+'"><strong>'+esc(n.titolo)+'</strong><div>'+esc(n.messaggio||'')+'</div><small>'+fmt(n.created_at)+'</small></div>').join(''):'<div style="padding:24px;text-align:center;color:#64748b">Nessuna notifica.</div>';
  }
  function bindStudioNotifications(){
    const b=document.getElementById('studioNotifyBtn'), m=document.getElementById('studioNotifyModal'), x=document.getElementById('studioNotifyClose'), r=document.getElementById('studioNotifyRead');
    if(!b||!m)return;
    b.onclick=async()=>{renderStudioNotifications();m.style.display='grid'};
    if(x)x.onclick=()=>m.style.display='none';
    if(r)r.onclick=async()=>{await getClient().from('studio_notifiche').update({letta_at:new Date().toISOString()}).eq('recipient_user_id',state.user.id).is('letta_at',null);await refreshAll();renderStudioNotifications();};
  }

  function renderDashboard(){
    const next=state.agenda.filter(a=>a.status==='da_fare' && new Date(a.starts_at)>=new Date()).slice(0,10);
    const recent=state.audit.slice(0,10);
    panel('dashboard','<div class="grid-3" style="margin-bottom:20px"><div class="stat-card"><span>Fascicoli</span><h4>'+state.practices.length+'</h4></div><div class="stat-card"><span>Scadenze aperte</span><h4>'+state.agenda.filter(a=>a.status==='da_fare').length+'</h4></div><div class="stat-card"><span>Comunicazioni</span><h4>'+state.communications.length+'</h4></div></div><div class="card" style="margin-bottom:20px;border-left:4px solid #2563eb"><h3 style="margin-top:0">🧭 Percorso operativo dello Studio</h3><p style="font-size:12px;color:#475569;margin-bottom:12px">Usa questo ordine per gestire una nuova pratica senza confondere le funzioni.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px"><div><strong>1. 👥 Cliente</strong><br><span style="font-size:12px;color:#64748b">Verifica anagrafica e accesso al Portale.</span></div><div><strong>2. 📁 Fascicolo</strong><br><span style="font-size:12px;color:#64748b">Apri o controlla la pratica e i documenti.</span></div><div><strong>3. 🔎 Analisi AI</strong><br><span style="font-size:12px;color:#64748b">Comprendi documenti e situazione del caso.</span></div><div><strong>4. ✨ Redazione Atti</strong><br><span style="font-size:12px;color:#64748b">Prepara atti giuridici collegati al fascicolo.</span></div><div><strong>5. ✉️ Lettere</strong><br><span style="font-size:12px;color:#64748b">Prepara comunicazioni professionali.</span></div><div><strong>6. 👨‍⚖️ Revisione</strong><br><span style="font-size:12px;color:#64748b">Il professionista verifica e approva prima dell’uso.</span></div></div><div style="margin-top:12px;padding:9px;background:#fffbeb;border-radius:8px;font-size:12px;color:#92400e"><strong>🧠 LAB:</strong> serve per sperimentare l’AI gratuitamente. Non sostituisce il flusso operativo del fascicolo.</div></div><div class="card"><h3>Attività recenti reali</h3><table><thead><tr><th>Data</th><th>Attivita</th><th>Fascicolo</th><th>Dettagli</th></tr></thead><tbody data-module-body>'+(recent.map(a=>'<tr><td>'+fmt(a.created_at)+'</td><td>'+esc(auditLabel(a.event_type))+'</td><td>'+esc(auditPractice(a))+'</td><td>'+esc(auditText(a))+'</td></tr>').join('')||'<tr><td colspan="4">Nessun evento.</td></tr>')+'</tbody></table></div><div class="card"><h3>Prossime scadenze</h3><table><thead><tr><th>Data</th><th>Titolo</th><th>Stato</th></tr></thead><tbody>'+(next.map(a=>'<tr><td>'+fmt(a.starts_at)+'</td><td>'+esc(a.title)+'</td><td>'+esc(a.status)+'</td></tr>').join('')||'<tr><td colspan="3">Nessuna scadenza.</td></tr>')+'</tbody></table></div>');
  }

  function renderTeam(){
    panel('team','<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><h3>⚖️ Gestione Professionisti & Team Silella</h3><div id="teamStatus" style="font-size:12px;color:#64748b">Dati reali Supabase</div></div><button class="btn btn-info" id="teamRefresh">Aggiorna</button></div><div class="card" style="margin-top:14px;background:#f8fafc"><h4>Aggiungi professionista</h4><form id="teamInviteForm" style="display:grid;grid-template-columns:1fr 1fr 160px auto;gap:8px;align-items:end"><div class="form-group"><label>Nome</label><input id="inviteName" required></div><div class="form-group"><label>Email</label><input id="inviteEmail" type="email" required></div><div class="form-group"><label>Ruolo</label><select id="inviteRole"><option value="studio">Professionista</option><option value="admin">Admin</option></select></div><button class="btn btn-success">Invia invito</button></form><div id="teamInviteStatus" style="font-size:12px;margin-top:8px"></div></div><div style="overflow:auto"><table><thead><tr><th>Professionista</th><th>Ruolo</th><th>Fascicoli</th><th>Email</th><th>Stato</th></tr></thead><tbody data-module-body>'+state.team.map(u=>'<tr><td>'+esc(u.full_name||u.user_id)+'</td><td>'+esc(u.role)+'</td><td>'+state.practices.filter(p=>p.owner_user_id===u.user_id).length+'</td><td>'+esc(u.user_id===state.user.id?state.user.email:'—')+'</td><td>Registrato</td></tr>').join('')+'</tbody></table></div></div>');
    document.getElementById('teamRefresh').onclick=refreshAll;
    document.getElementById('teamInviteForm').onsubmit=async e=>{e.preventDefault();const s=document.getElementById('teamInviteStatus');s.textContent='Invio…';const {data:{session}}=await getClient().auth.getSession();const r=await fetch(window.STUDIO_SUPABASE_URL+'/functions/v1/studio-invita-professionista',{method:'POST',headers:{apikey:window.STUDIO_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({email:inviteEmail.value,full_name:inviteName.value,role:inviteRole.value})});const out=await r.json().catch(()=>({}));s.textContent=out.ok?'Invito inviato. Il professionista completerà l’attivazione tramite email.':('Errore: '+(out.error||'invito non riuscito'));if(out.ok)e.target.reset();await loadData();};
  }

  function renderClients(){
    const rows=state.clients;
    panel('clients','<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><h3>👥 Anagrafica Clienti</h3><div style="font-size:12px;color:#64748b">Il Cliente è il contenitore principale. Da qui si gestiscono anagrafica, accesso al portale, privacy, pratiche e documenti personali.</div></div><button class="btn btn-info" id="clientsRefresh">Aggiorna</button></div>'+
      '<div class="card" style="margin-top:14px;background:#f8fafc"><h4>Nuovo cliente</h4><form id="clientForm" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;align-items:end"><input id="clName" placeholder="Nome / società" required><input id="clTax" placeholder="CF / P.IVA"><input id="clEmail" type="email" placeholder="Email"><input id="clPhone" placeholder="Telefono"><button class="btn btn-success">Salva</button></form><div id="clientStatus" style="font-size:12px;margin-top:8px"></div></div>'+
      '<div style="overflow:auto"><table><thead><tr><th>Nome</th><th>CF/P.IVA</th><th>Email</th><th>Portale</th><th>Stato</th><th>Azioni</th></tr></thead><tbody data-module-body>'+
      (rows.map(c=>'<tr><td><strong>'+esc(c.full_name)+'</strong></td><td>'+esc(c.tax_id||'—')+'</td><td>'+esc(c.email||'—')+'</td><td>'+(c.user_id?'<span class="badge-status status-sent">Attivo</span>':'<span class="badge-status">Non attivo</span>')+'</td><td>'+esc(c.status||'—')+'</td><td><button class="btn btn-info" data-open-client="'+c.id+'">Apri</button> <button class="btn btn-danger" data-del-client="'+c.id+'">Elimina</button></td></tr>').join('')||'<tr><td colspan="6">Nessun cliente.</td></tr>')+'</tbody></table></div></div>');
    document.getElementById('clientsRefresh').onclick=refreshAll;
    document.getElementById('clientForm').onsubmit=async e=>{
      e.preventDefault();const {error}=await getClient().from('studio_clienti').insert({full_name:clName.value.trim(),tax_id:clTax.value.trim()||null,email:clEmail.value.trim()||null,phone:clPhone.value.trim()||null,created_by:state.user.id});
      document.getElementById('clientStatus').textContent=error?error.message:'Cliente salvato.';
      if(!error){e.target.reset();await refreshAll()}
    };
    document.querySelectorAll('[data-open-client]').forEach(b=>b.onclick=()=>openClientDetail(b.dataset.openClient));
    document.querySelectorAll('[data-del-client]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Eliminare definitivamente il cliente e i documenti del portale collegati?'))return;
      b.disabled=true;b.textContent='Eliminazione…';
      try{
        const c=getClient();const {data:docs,error:de}=await c.from('studio_portale_documenti').select('storage_path').eq('cliente_id',b.dataset.delClient);if(de)throw de;
        const paths=(docs||[]).map(x=>x.storage_path).filter(Boolean);if(paths.length){const {error:se}=await c.storage.from('studio-legale-documenti').remove(paths);if(se)throw se}
        const {error}=await c.from('studio_clienti').delete().eq('id',b.dataset.delClient);if(error)throw error;await refreshAll();
      }catch(err){b.disabled=false;b.textContent='Elimina';alert('Eliminazione cliente non riuscita: '+(err?.message||err))}
    });
  }

  async function openClientDetail(clientId){
    const client=state.clients.find(x=>x.id===clientId);if(!client)return;
    const c=getClient();
    const [{data:practices},{data:docs},{data:consents},{data:informative}]=await Promise.all([
      c.from('studio_pratiche').select('*').eq('client_id',client.id).order('created_at',{ascending:false}),
      c.from('studio_portale_documenti').select('*').eq('cliente_id',client.id).order('created_at',{ascending:false}),
      c.from('studio_privacy_consensi').select('*,studio_privacy_informative(titolo,versione)').eq('cliente_id',client.id).order('registrato_at',{ascending:false}),
      c.from('studio_privacy_informative').select('id,titolo,versione,stato').eq('tipo','clienti').order('created_at',{ascending:false})
    ]);
    const m=document.createElement('div');m.className='modal';m.style.zIndex='10000';
    const active=(informative||[]).find(x=>x.stato==='attiva');
    m.innerHTML='<div class="modalBox" style="width:min(1050px,100%);max-height:90vh;overflow:auto"><div class="modalHead"><div><h2>'+esc(client.full_name)+'</h2><div class="status">'+esc(client.email||'')+' · '+esc(client.tax_id||'')+'</div></div><button class="iconBtn" id="closeClientDetail">✕</button></div>'+
      '<div class="grid2" style="margin-top:16px"><div class="notice"><strong>Portale</strong><br>'+(client.user_id?'Accesso attivo':'Accesso non attivo')+'</div><div class="notice"><strong>Privacy</strong><br>'+((consents||[]).length?'Presa visione registrata':'Da completare')+(active?' · versione attiva '+esc(active.versione): ' · nessuna informativa attiva')+'</div></div>'+
      '<div class="actions" style="margin-top:16px"><button class="btn gold" id="clientInvitePrivacy">'+(client.user_id?'Invia informativa privacy':'Invita al Portale e invia privacy')+'</button></div>'+
      '<div class="card" style="margin-top:16px"><h3>Nuova pratica</h3><form id="clientPracticeForm"><div class="grid2"><div class="field"><label>Area legale</label><input id="cpArea" required></div><div class="field"><label>Controparte</label><input id="cpCounterparty"></div></div><div class="field"><label>Descrizione / oggetto</label><textarea id="cpDescription" required></textarea></div><div id="cpStatus" class="status"></div><button class="btn btn-success">Crea fascicolo</button></form></div>'+
      '<div class="card" style="margin-top:16px"><h3>Pratiche del cliente</h3><div id="clientPracticeList">'+((practices||[]).map(p=>'<div class="doc"><div class="docMain"><div class="docName">'+esc(p.legal_area||'Pratica')+'</div><div class="docMeta">'+fmt(p.created_at)+' · '+esc(p.status)+' · '+esc(p.counterparty||'nessuna controparte')+'</div></div></div>').join('')||'<div class="empty">Nessuna pratica.</div>')+'</div></div>'+
      '<div class="card" style="margin-top:16px"><h3>Documenti del portale</h3><div>'+((docs||[]).map(d=>'<div class="doc"><div class="docMain"><div class="docName">'+esc(d.file_name)+'</div><div class="docMeta">'+esc(d.direction)+' · '+esc(d.document_kind)+' · '+esc(d.status)+' · '+fmt(d.created_at)+'</div></div>'+(d.status==='restituito'?'<button class="btn btn-success" data-verify-doc="'+d.id+'">Convalida</button>':'')+'</div>').join('')||'<div class="empty">Nessun documento.</div>')+'</div></div>'+
      '<div class="card" style="margin-top:16px"><h3>Privacy</h3><div>'+((consents||[]).map(x=>'<div class="notice" style="margin-bottom:8px">'+esc(x.tipo_azione||x.tipo||'presa visione')+' · '+esc(x.studio_privacy_informative?.versione||x.versione||'')+' · '+fmt(x.registrato_at||x.accepted_at)+'</div>').join('')||'<div class="empty">Nessuna registrazione privacy.</div>')+'</div></div></div>';
    document.body.appendChild(m);
    const close=()=>m.remove();m.querySelector('#closeClientDetail').onclick=close;
    m.querySelector('#clientInvitePrivacy').onclick=async()=>{
      const s=m.querySelector('#cpStatus');const b=m.querySelector('#clientInvitePrivacy');b.disabled=true;b.textContent='Operazione in corso…';
      try{
        let target=state.clients.find(x=>x.id===client.id);
        if(!target.user_id){
          const email=target.email||prompt('Email del cliente per l’accesso al portale:','');
          if(!email)throw Error('Email obbligatoria per l’invito.');
          const {data:{session}}=await c.auth.getSession();if(!session)throw Error('Sessione Studio non disponibile.');
          const r=await fetch(window.STUDIO_SUPABASE_URL+'/functions/v1/studio-invita-cliente',{method:'POST',headers:{apikey:window.STUDIO_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({client_id:target.id,email:email.trim().toLowerCase()})});
          const out=await r.json();if(!out.ok)throw Error(out.error||'Invito non riuscito.');
          await loadData();target=state.clients.find(x=>x.id===client.id);
        }
        const {data:infos,error:ie}=await c.from('studio_privacy_informative').select('id').eq('tipo','clienti').eq('stato','attiva').order('valida_dal',{ascending:false}).limit(1).maybeSingle();if(ie)throw ie;if(!infos)throw Error('Nessuna informativa privacy attiva.');
        const {data:out,error}=await c.functions.invoke('studio-privacy-portal',{body:{action:'send',informative_id:infos.id,client_id:target.id}});if(error)throw error;if(!out?.ok)throw Error(out?.error||'Invio informativa non riuscito.');
        b.textContent='Informativa inviata';s.textContent='Informativa inviata al cliente e disponibile nel Portale.';await loadData();
      }catch(e){b.disabled=false;b.textContent='Invia informativa privacy';s.textContent='Errore: '+(e?.message||e)}
    };
    m.querySelector('#clientPracticeForm').onsubmit=async e=>{
      e.preventDefault();const s=m.querySelector('#cpStatus');s.textContent='Creazione fascicolo…';
      const row={client_id:client.id,client_name:client.full_name,tax_id:client.tax_id||'N/D',legal_area:m.querySelector('#cpArea').value.trim(),counterparty:m.querySelector('#cpCounterparty').value.trim()||null,description:m.querySelector('#cpDescription').value.trim(),status:'nuova',intake_source:'studio',owner_user_id:state.user.id,client_user_id:client.user_id||null,ai_status:'non_avviata'};
      const {data:p,error}=await c.from('studio_pratiche').insert(row).select().single();if(error){s.textContent='Errore: '+error.message;return}
      await c.from('studio_audit').insert({pratica_id:p.id,actor_user_id:state.user.id,event_type:'pratica_creata_studio',details:{cliente_id:client.id}});
      s.textContent='Fascicolo creato correttamente.';e.target.reset();await loadData();close();
    };
    m.querySelectorAll('[data-verify-doc]').forEach(b=>b.onclick=async()=>{
      b.disabled=true;b.textContent='Convalida…';const {error}=await c.from('studio_portale_documenti').update({status:'verificato',verified_at:new Date().toISOString()}).eq('id',b.dataset.verifyDoc);if(error){b.disabled=false;b.textContent='Convalida';alert(error.message);return}
      await c.from('studio_audit').insert({pratica_id:docs.find(d=>d.id===b.dataset.verifyDoc)?.pratica_id||null,actor_user_id:state.user.id,event_type:'documento_portale_verificato',details:{documento_id:b.dataset.verifyDoc}});b.textContent='Convalidato';await loadData();
    });
  }

  function renderAgenda(){
    panel('agenda',`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><h3>📅 Agenda Legale & Scadenze</h3><div style="font-size:12px;color:#64748b">Scadenze e udienze persistenti in studio_agenda</div></div><button class="btn btn-info" id="agendaRefresh">Aggiorna</button></div>
    <div class="card" style="margin-top:14px;background:#f8fafc"><h4 style="margin:0 0 8px">➕ Nuovo evento</h4><form id="agendaForm" style="display:grid;grid-template-columns:2fr 1.2fr 1fr 1.2fr 1fr auto;gap:8px;align-items:end"><input id="agTitle" placeholder="Titolo" required><select id="agPractice">${practiceOptions()}</select><select id="agType"><option value="udienza">Udienza</option><option value="termine">Termine</option><option value="deposito">Deposito</option><option value="adempimento">Adempimento</option><option value="appuntamento">Appuntamento</option><option value="altro">Altro</option></select><input id="agStart" type="datetime-local" required><select id="agPriority"><option value="normale">Normale</option><option value="alta">Alta</option><option value="urgente">Urgente</option><option value="bassa">Bassa</option></select><button class="btn btn-success">Salva</button></form>
      <div id="hearingFields" style="display:none;margin-top:12px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px"><div style="font-size:12px;font-weight:700;margin-bottom:8px">⚖️ Dati dell'udienza</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px"><input id="agCourt" placeholder="Tribunale"><input id="agSection" placeholder="Sezione"><input id="agJudge" placeholder="Giudice"><input id="agRG" placeholder="Numero R.G."><input id="agRoom" placeholder="Aula"><input id="agAddress" placeholder="Indirizzo"><input id="agNotes" placeholder="Note / adempimenti collegati" style="grid-column:span 2"><label style="grid-column:span 4;display:flex;gap:8px;align-items:center;font-size:12px"><input id="agClientVisible" type="checkbox" checked> Mostra questa informazione al cliente nel Portale</label></div></div><div id="agendaStatus" style="font-size:12px;margin-top:8px"></div></div>
    <table><thead><tr><th>Data</th><th>Cliente/Fascicolo</th><th>Evento</th><th>Tipo</th><th>Sede</th><th>Priorità</th><th>Stato</th><th>Azioni</th></tr></thead><tbody data-module-body>${state.agenda.map(a=>{const p=state.practices.find(p=>p.id===a.pratica_id);const location=a.location||'—';return '<tr><td>'+fmt(a.starts_at)+'</td><td>'+esc(p?.client_name||'—')+'</td><td>'+esc(a.title)+'</td><td>'+esc(a.type)+'</td><td>'+esc(location)+'</td><td>'+esc(a.priority)+'</td><td>'+esc(a.status)+'</td><td>'+(a.status==='da_fare'?'<button class="btn btn-success" data-ag-done="'+a.id+'">Completa</button> ':'')+'<button class="btn btn-danger" data-ag-del="'+a.id+'">Elimina</button></td></tr>'}).join('')||'<tr><td colspan="8">Nessun evento.</td></tr>'}</tbody></table></div>`);
    document.getElementById('agendaRefresh').onclick=refreshAll;const type=document.getElementById('agType'),hf=document.getElementById('hearingFields');const toggleHearing=()=>{hf.style.display=type.value==='udienza'?'block':'none';};type.onchange=toggleHearing;toggleHearing();
    document.getElementById('agendaForm').onsubmit=async e=>{e.preventDefault();const isH=type.value==='udienza';const location=isH?[agCourt.value.trim(),agSection.value.trim(),agRoom.value.trim(),agAddress.value.trim()].filter(Boolean).join(' · ')||null:null;const notes=isH?[agJudge.value.trim()?('Giudice: '+agJudge.value.trim()):'',agRG.value.trim()?('R.G.: '+agRG.value.trim()):'',agNotes.value.trim()].filter(Boolean).join(' · ')||null:null;const {error}=await getClient().from('studio_agenda').insert({title:agTitle.value.trim(),pratica_id:agPractice.value||null,type:type.value,starts_at:new Date(agStart.value).toISOString(),priority:agPriority.value,created_by:state.user.id,location,notes,client_visible:isH&&agClientVisible.checked,client_note:isH?(agNotes.value.trim()||null):null});document.getElementById('agendaStatus').textContent=error?'Errore: '+error.message:(isH?'Udienza salvata in agenda e collegata al fascicolo.':'Evento salvato in agenda.');if(!error){e.target.reset();toggleHearing();refreshAll();}};
    document.querySelectorAll('[data-ag-done]').forEach(b=>b.onclick=async()=>{const {error}=await getClient().from('studio_agenda').update({status:'completata'}).eq('id',b.dataset.agDone);if(error)alert(error.message);else refreshAll()});document.querySelectorAll('[data-ag-del]').forEach(b=>b.onclick=async()=>{if(!confirm("Eliminare evento?"))return;const {error}=await getClient().from('studio_agenda').delete().eq('id',b.dataset.agDel);if(error)alert(error.message);else refreshAll()});
  }

  function renderPec(){
    panel('pec-client','<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><h3>✉️ Comunicazioni Studio</h3><div style="font-size:12px;color:#64748b">Registro persistente · nessuna casella PEC automatica collegata</div></div><button class="btn btn-info" id="pecRefresh">Aggiorna</button></div><div class="card" style="margin-top:14px;background:#f8fafc"><form id="pecForm" style="display:grid;grid-template-columns:1fr 1fr 1fr 2fr auto;gap:8px;align-items:end"><select id="pcChannel"><option value="email">Email</option><option value="pec">PEC</option><option value="pct">PCT</option></select><select id="pcPractice">'+practiceOptions()+'</select><input id="pcRecipient" placeholder="Destinatario"><input id="pcSubject" placeholder="Oggetto / contenuto" required><button class="btn btn-success">Registra</button></form><div id="pecStatus" style="font-size:12px;margin-top:8px"></div></div><table><thead><tr><th>Data</th><th>Canale</th><th>Pratica</th><th>Destinatario</th><th>Oggetto</th><th>Stato</th></tr></thead><tbody data-module-body>'+(state.communications.map(r=>'<tr><td>'+fmt(r.sent_at||r.created_at)+'</td><td>'+esc(r.channel)+'</td><td>'+esc(r.pratica_id||'—')+'</td><td>'+esc(r.recipient||'—')+'</td><td>'+esc(r.subject||r.body||'—')+'</td><td>'+esc(r.status||'—')+'</td></tr>').join('')||'<tr><td colspan="6">Nessuna comunicazione.</td></tr>')+'</tbody></table></div>');
    document.getElementById('pecRefresh').onclick=refreshAll;
    document.getElementById('pecForm').onsubmit=async e=>{e.preventDefault();const {error}=await getClient().from('studio_comunicazioni').insert({channel:pcChannel.value,pratica_id:pcPractice.value||null,recipient:pcRecipient.value.trim()||null,subject:pcSubject.value.trim(),body:pcSubject.value.trim(),status:'registrata',created_by:state.user.id,sent_at:new Date().toISOString()});document.getElementById('pecStatus').textContent=error?error.message:'Comunicazione registrata. Nessun invio PEC automatico è stato eseguito.';if(!error){e.target.reset();refreshAll()}};
  }

  function renderPct(){
    panel('pct-deposit','<div class="card"><h3>🏛️ Deposito Telematico PCT</h3><div style="font-size:12px;color:#64748b">Gestione della pratica di deposito persistente. Nessun invio ministeriale viene simulato.</div><div class="card" style="margin-top:14px;background:#f8fafc"><form id="pctForm" style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:end"><select id="pctPractice" required>'+practiceOptions()+'</select><input id="pctType" placeholder="Tipo atto" required><input id="pctRecipient" placeholder="Ufficio / destinatario"><button class="btn btn-success">Crea deposito</button></form><div id="pctStatus" style="font-size:12px;margin-top:8px"></div></div><table><thead><tr><th>Data</th><th>Pratica</th><th>Tipo</th><th>Ufficio</th><th>Stato</th><th>Azioni</th></tr></thead><tbody data-module-body>'+(state.pct.map(p=>'<tr><td>'+fmt(p.created_at)+'</td><td>'+esc(state.practices.find(x=>x.id===p.pratica_id)?.client_name||p.pratica_id)+'</td><td>'+esc(p.type)+'</td><td>'+esc(p.recipient||'—')+'</td><td>'+esc(p.status)+'</td><td><select data-pct-status="'+p.id+'"><option>preparazione</option><option>pronto</option><option>inviato</option><option>ricevuto</option><option>rifiutato</option><option>annullato</option></select></td></tr>').join('')||'<tr><td colspan="6">Nessun deposito.</td></tr>')+'</tbody></table></div>');
    document.getElementById('pctForm').onsubmit=async e=>{e.preventDefault();const {error}=await getClient().from('studio_pct_depositi').insert({pratica_id:pctPractice.value,created_by:state.user.id,type:pctType.value.trim(),recipient:pctRecipient.value.trim()||null,status:'preparazione'});document.getElementById('pctStatus').textContent=error?error.message:'Deposito creato in stato preparazione.';if(!error){e.target.reset();refreshAll()}};
    document.querySelectorAll('[data-pct-status]').forEach(s=>{const row=state.pct.find(x=>x.id===s.dataset.pctStatus);s.value=row?.status||'preparazione';s.onchange=async()=>{const {error}=await getClient().from('studio_pct_depositi').update({status:s.value,submitted_at:s.value==='inviato'?new Date().toISOString():row.submitted_at}).eq('id',s.dataset.pctStatus);if(error)alert(error.message);else refreshAll()}});
  }

  function renderTimer(){
    const open=state.time.find(x=>x.user_id===state.user.id&&!x.ended_at);
    panel('time-tracker','<div class="card"><h3>⏱️ Time Tracker & Ore Lavorate</h3><div style="font-size:12px;color:#64748b">Sessioni persistenti in studio_time_entries</div><div class="card" style="margin-top:14px;background:#f8fafc"><form id="timeForm" style="display:grid;grid-template-columns:2fr 2fr auto;gap:8px"><select id="timePractice">'+practiceOptions()+'</select><input id="timeDesc" placeholder="Attività"><button class="btn btn-success">'+(open?'Sessione già attiva':'Avvia sessione')+'</button></form><div id="timeStatus" style="font-size:12px;margin-top:8px"></div></div><table><thead><tr><th>Inizio</th><th>Fine</th><th>Durata</th><th>Pratica</th><th>Attività</th><th>Azioni</th></tr></thead><tbody data-module-body>'+(state.time.map(t=>'<tr><td>'+fmt(t.started_at)+'</td><td>'+fmt(t.ended_at)+'</td><td>'+esc(t.duration_seconds!=null?Math.floor(t.duration_seconds/60)+' min':'in corso')+'</td><td>'+esc(state.practices.find(p=>p.id===t.pratica_id)?.client_name||'—')+'</td><td>'+esc(t.description||'—')+'</td><td>'+(!t.ended_at&&t.user_id===state.user.id?'<button class="btn btn-danger" data-time-stop="'+t.id+'">Ferma</button>':'')+'</td></tr>').join('')||'<tr><td colspan="6">Nessuna sessione.</td></tr>')+'</tbody></table></div>');
    document.getElementById('timeForm').onsubmit=async e=>{e.preventDefault();if(open){document.getElementById('timeStatus').textContent='Esiste già una sessione aperta: usa Ferma.';return}const {error}=await getClient().from('studio_time_entries').insert({pratica_id:timePractice.value||null,user_id:state.user.id,started_at:new Date().toISOString(),description:timeDesc.value.trim()||null});document.getElementById('timeStatus').textContent=error?error.message:'Sessione avviata.';if(!error)refreshAll()};
    document.querySelectorAll('[data-time-stop]').forEach(b=>b.onclick=async()=>{const {error}=await getClient().from('studio_time_entries').update({ended_at:new Date().toISOString()}).eq('id',b.dataset.timeStop);if(error)alert(error.message);else refreshAll()});
  }

  function renderBilling(){
    panel('billing','<div class="card"><h3>💶 Parcelle & Fatturazione</h3><div style="font-size:12px;color:#64748b">Fatture persistenti in studio_fatture · SDI esterno non collegato</div><div class="card" style="margin-top:14px;background:#f8fafc"><form id="billForm" style="display:grid;grid-template-columns:1fr 1fr 2fr 1fr 1fr auto;gap:8px;align-items:end"><select id="billClient">'+state.clients.map(c=>'<option value="'+c.id+'">'+esc(c.full_name)+'</option>').join('')+'</select><select id="billPractice">'+practiceOptions()+'</select><input id="billDesc" placeholder="Descrizione" required><input id="billSub" type="number" min="0" step="0.01" placeholder="Imponibile" required><input id="billVat" type="number" min="0" step="0.01" placeholder="IVA" value="0"><button class="btn btn-success">Salva</button></form><div id="billStatus" style="font-size:12px;margin-top:8px"></div></div><table><thead><tr><th>N.</th><th>Data</th><th>Cliente</th><th>Descrizione</th><th>Totale</th><th>Stato</th><th>SDI</th></tr></thead><tbody data-module-body>'+(state.bills.map(b=>'<tr><td>'+esc(b.invoice_number||'—')+'</td><td>'+day(b.issue_date)+'</td><td>'+esc(state.clients.find(c=>c.id===b.cliente_id)?.full_name||'—')+'</td><td>'+esc(b.description)+'</td><td>€ '+Number(b.total||0).toFixed(2)+'</td><td>'+esc(b.status)+'</td><td>'+esc(b.sdi_status)+'</td></tr>').join('')||'<tr><td colspan="7">Nessuna fattura.</td></tr>')+'</tbody></table></div>');
    document.getElementById('billForm').onsubmit=async e=>{e.preventDefault();const sub=Number(billSub.value||0),vat=Number(billVat.value||0);const {error}=await getClient().from('studio_fatture').insert({cliente_id:billClient.value||null,pratica_id:billPractice.value||null,created_by:state.user.id,description:billDesc.value.trim(),subtotal:sub,vat,total:sub+vat,status:'bozza',sdi_status:'non_collegato'});document.getElementById('billStatus').textContent=error?error.message:'Fattura salvata in bozza.';if(!error){e.target.reset();refreshAll()}};
  }

  function renderPortal(){
    const linked=state.clients.filter(c=>c.user_id);
    panel('client-portal','<div class="card"><h3>🌐 Portale Clienti</h3><div style="font-size:12px;color:#64748b">Inviti, documenti e richieste di firma collegati al cliente.</div>'+
      '<div class="card" style="margin-top:14px;background:#f8fafc"><form id="portalForm" style="display:grid;grid-template-columns:2fr 2fr auto;gap:8px"><select id="portalClient" required>'+state.clients.map(c=>'<option value="'+c.id+'">'+esc(c.full_name)+'</option>').join('')+'</select><input id="portalEmail" type="email" placeholder="Email cliente" required><button class="btn btn-success">Invita / attiva</button></form><div id="portalStatus" style="font-size:12px;margin-top:8px"></div></div>'+
      '<div class="card" style="margin-top:14px;background:#f8fafc"><h4>Invia documento al cliente</h4><form id="portalDocForm" style="display:grid;grid-template-columns:1.3fr 1.3fr 1fr 1.2fr auto;gap:8px;align-items:end"><select id="docClient" required>'+linked.map(c=>'<option value="'+c.id+'">'+esc(c.full_name)+'</option>').join('')+'</select><select id="docPractice"><option value="">Documento non collegato a pratica</option>'+state.practices.map(p=>'<option value="'+p.id+'">'+esc(p.client_name)+' · '+esc(p.legal_area||'')+'</option>').join('')+'</select><select id="docMode"><option value="nessuna">Nessuna firma</option><option value="download_upload">Scarica · firma · ricarica</option><option value="online">Firma online (servizio esterno)</option><option value="qualificata">Firma qualificata (servizio esterno)</option><option value="spid">Firma con SPID (servizio esterno)</option></select><input id="docFile" type="file" required><button class="btn btn-success">Invia</button></form><div id="portalDocStatus" style="font-size:12px;margin-top:8px"></div></div>'+
      '<table><thead><tr><th>Cliente</th><th>Email</th><th>Invitato</th><th>Stato</th></tr></thead><tbody data-module-body>'+((state.portalInvites.map(i=>'<tr><td>'+esc(state.clients.find(c=>c.id===i.client_id)?.full_name||'—')+'</td><td>'+esc(i.email)+'</td><td>'+fmt(i.invited_at)+'</td><td>'+esc(i.status)+'</td></tr>').join(''))||'<tr><td colspan="4">Nessun invito.</td></tr>')+'</tbody></table>'+
      '<h4 style="margin-top:22px">Ultimi documenti portale</h4><table><thead><tr><th>Data</th><th>Cliente</th><th>Documento</th><th>Direzione</th><th>Stato</th></tr></thead><tbody>'+((state.portalDocs.map(d=>'<tr><td>'+fmt(d.created_at)+'</td><td>'+esc(state.clients.find(c=>c.id===d.cliente_id)?.full_name||'—')+'</td><td>'+esc(d.file_name)+'</td><td>'+esc(d.direction)+'</td><td>'+esc(d.status)+'</td></tr>').join(''))||'<tr><td colspan="5">Nessun documento.</td></tr>')+'</tbody></table></div>');
    document.getElementById('portalForm').onsubmit=async e=>{e.preventDefault();const s=document.getElementById('portalStatus');const {data:{session}}=await getClient().auth.getSession();if(!session){s.textContent='Sessione non disponibile.';return}s.textContent='Invio invito…';const r=await fetch(window.STUDIO_SUPABASE_URL+'/functions/v1/studio-invita-cliente',{method:'POST',headers:{apikey:window.STUDIO_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({client_id:portalClient.value,email:portalEmail.value.trim().toLowerCase()})});const out=await r.json().catch(()=>({}));s.textContent=out.ok?'Invito cliente inviato via Auth.':'Errore: '+(out.error||'invito non riuscito');if(out.ok){e.target.reset();refreshAll()}};
    document.getElementById('portalDocForm').onsubmit=async e=>{e.preventDefault();const s=document.getElementById('portalDocStatus');const client=state.clients.find(c=>c.id===docClient.value);const file=document.getElementById('docFile').files[0];if(!client?.user_id){s.textContent='Il cliente non ha ancora un accesso attivo.';return}if(!file){s.textContent='Seleziona un file.';return}if(file.size>10*1024*1024){s.textContent='Il file supera 10 MB.';return}const path='studio/'+client.id+'/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const up=await getClient().storage.from('studio-legale-documenti').upload(path,file,{contentType:file.type,upsert:false});if(up.error){s.textContent=up.error.message;return}const mode=docMode.value;const {error}=await getClient().from('studio_portale_documenti').insert({pratica_id:docPractice.value||null,cliente_id:client.id,sender_user_id:state.user.id,recipient_user_id:client.user_id,file_name:file.name,storage_path:path,mime_type:file.type,size_bytes:file.size,direction:'studio_to_client',document_kind:'documento',status:mode==='nessuna'?'inviato':'da_firmare',signature_mode:mode,version:1});s.textContent=error?error.message:'Documento inviato al cliente.';if(!error){e.target.reset();refreshAll()}};
  }

  function renderArchive(){
    panel('archive','<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><h3>🗄️ Archivio Storico e Audit Trail</h3><div style="font-size:12px;color:#64748b">Dati reali da studio_audit</div></div><button class="btn btn-info" id="archiveRefresh">Aggiorna</button></div><table><thead><tr><th>Data</th><th>Attivita</th><th>Fascicolo</th><th>Utente</th><th>Dettagli</th></tr></thead><tbody data-module-body>'+(state.audit.map(a=>'<tr><td>'+fmt(a.created_at)+'</td><td>'+esc(auditLabel(a.event_type))+'</td><td>'+esc(auditPractice(a))+'</td><td>'+esc(a.actor_user_id||'—')+'</td><td>'+esc(auditText(a))+'</td></tr>').join('')||'<tr><td colspan="5">Nessun evento.</td></tr>')+'</tbody></table></div>');
    document.getElementById('archiveRefresh').onclick=refreshAll;
  }

  function renderAll(){renderDashboard();renderTeam();renderClients();renderAgenda();renderPec();renderPct();renderTimer();renderBilling();renderPortal();renderArchive();renderStudioNotifications();bindStudioNotifications();if(window.renderStudioHelpForActive)window.renderStudioHelpForActive();}
  function init(){
    ['dashboard','team','clients','agenda','pec-client','pct-deposit','time-tracker','billing','client-portal','archive'].forEach(id=>bindMenu(id,refreshAll));
    const c=getClient();
    if(c)c.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_IN'&&session){
        studioAuthReady=true;
        refreshAll();
      }else if(event==='SIGNED_OUT'){
        studioAuthReady=false;
        renderError('Accesso Studio richiesto.');
      }
    });
    renderError('Accesso Studio richiesto.');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();