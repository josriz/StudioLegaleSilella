(() => {
  const getClient = () => {
    if (window.STUDIO_SUPABASE_CLIENT) return window.STUDIO_SUPABASE_CLIENT;
    if (!window.supabase || !window.STUDIO_SUPABASE_URL || !window.STUDIO_SUPABASE_PUBLISHABLE_KEY) return null;
    return (window.STUDIO_SUPABASE_CLIENT = window.supabase.createClient(
      window.STUDIO_SUPABASE_URL,
      window.STUDIO_SUPABASE_PUBLISHABLE_KEY
    ));
  };

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const date = v => v ? new Date(v).toLocaleString('it-IT') : '—';

  const state = { practices: [], docs: [], audit: [], communications: [], team: [] };

  async function loadData() {
    const client = getClient();
    if (!client) throw new Error('Servizio Supabase non disponibile.');
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new Error('Sessione Studio non autenticata.');
    const results = await Promise.all([
      client.from('studio_pratiche').select('id,client_name,tax_id,legal_area,counterparty,status,created_at,updated_at,owner_user_id').order('created_at',{ascending:false}),
      client.from('studio_documenti').select('id,pratica_id,file_name,size_bytes,created_at').order('created_at',{ascending:false}),
      client.from('studio_audit').select('*').order('created_at',{ascending:false}).limit(100),
      client.from('studio_comunicazioni').select('*').order('created_at',{ascending:false}).limit(100),
      client.from('studio_utenti').select('user_id,role,full_name,created_at').order('created_at',{ascending:true})
    ]);
    for (const r of results) if (r.error) throw r.error;
    state.practices = results[0].data || [];
    state.docs = results[1].data || [];
    state.audit = results[2].data || [];
    state.communications = results[3].data || [];
    state.team = results[4].data || [];
    state.user = user;
  }

  function panel(id, html) {
    const p = document.getElementById('panel-' + id);
    if (p) p.innerHTML = html;
  }

  function docsFor(id) { return state.docs.filter(d => d.pratica_id === id); }

  function bindMenu(id, fn) {
    document.querySelectorAll('.menu-item').forEach(m => {
      const oc = m.getAttribute('onclick') || '';
      if (oc.includes("'"+id+"'")) m.addEventListener('click', () => setTimeout(fn, 0));
    });
  }

  async function refreshAll() {
    try {
      await loadData();
      renderAll();
    } catch (e) {
      console.error('Studio modules:', e);
      renderError(e.message || 'Errore di caricamento');
    }
  }

  function renderError(message) {
    ['team','agenda','pec-client','pct-deposit','time-tracker','billing','client-portal','archive'].forEach(id => {
      const p=document.getElementById('panel-'+id);
      if(p) {
        const box=p.querySelector('[data-module-body]');
        if(box) box.innerHTML='<div style="padding:14px;color:#b91c1c">'+esc(message)+'</div>';
      }
    });
  }

  function renderTeam() {
    panel('team', '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><h3>⚖️ Gestione Professionisti & Team Silella</h3><div data-module-body style="font-size:12px;color:#64748b">Dati reali Supabase</div></div><button class="btn btn-info" id="teamRefresh" type="button">Aggiorna</button></div><div style="overflow:auto;margin-top:14px"><table><thead><tr><th>Professionista</th><th>Ruolo</th><th>Fascicoli assegnati</th><th>Email</th><th>Stato</th></tr></thead><tbody data-team-body></tbody></table></div></div>');
    const email=state.user?.email||'';
    document.querySelector('[data-team-body]').innerHTML=state.team.map(u=>{
      const count=state.practices.filter(p=>p.owner_user_id===u.user_id).length;
      return '<tr><td><strong>'+esc(u.full_name||u.user_id)+'</strong></td><td>'+esc(u.role)+'</td><td>'+count+'</td><td>'+esc(u.user_id===state.user?.id?email:'—')+'</td><td><span class="badge-status status-sent">Registrato</span></td></tr>';
    }).join('') || '<tr><td colspan="5">Nessun professionista visibile.</td></tr>';
    document.getElementById('teamRefresh').onclick=refreshAll;
  }

  function renderAgenda() {
    panel('agenda','<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><h3>📅 Agenda Legale & Scadenze</h3><div style="font-size:12px;color:#64748b">Audit schema: nessuna tabella scadenze presente in Supabase</div></div><button class="btn btn-info" id="agendaRefresh" type="button">Aggiorna</button></div><div data-module-body style="margin-top:14px;padding:14px;background:#f8fafc;border-radius:8px">Nessuna scadenza inventata: il database attuale non contiene un modulo agenda/scadenze persistente.</div></div>');
    document.getElementById('agendaRefresh').onclick=refreshAll;
  }

  function renderPec() {
    const rows=state.communications;
    panel('pec-client','<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><h3>✉️ Comunicazioni Studio</h3><div style="font-size:12px;color:#64748b">Dati reali da studio_comunicazioni · nessuna casella PEC collegata</div></div><button class="btn btn-info" id="pecRefresh" type="button">Aggiorna</button></div><div style="overflow:auto;margin-top:14px"><table><thead><tr><th>Data</th><th>Canale</th><th>Pratica</th><th>Oggetto / contenuto</th><th>Stato</th></tr></thead><tbody data-module-body>'+ (rows.length?rows.map(r=>'<tr><td>'+date(r.created_at)+'</td><td>'+esc(r.channel||'—')+'</td><td>'+esc(r.pratica_id||'—')+'</td><td>'+esc(r.subject||r.content||r.body||'—')+'</td><td>'+esc(r.status||'—')+'</td></tr>').join(''):'<tr><td colspan="5">Nessuna comunicazione registrata.</td></tr>')+'</tbody></table></div></div>');
    document.getElementById('pecRefresh').onclick=refreshAll;
  }

  function renderPct() {
    const pct=state.communications.filter(r=>String(r.channel||'').toLowerCase()==='pct');
    panel('pct-deposit','<div class="card"><h3>🏛️ Deposito Telematico (PCT)</h3><div style="font-size:12px;color:#64748b;margin-bottom:14px">Audit: non esiste nel progetto una funzione PCT reale né un connettore ministeriale. Il pannello non simula invii.</div><div data-module-body>'+ (pct.length ? pct.map(r=>'<div style="padding:10px;border-bottom:1px solid #e2e8f0"><strong>'+esc(r.subject||'Deposito PCT')+'</strong><br><small>'+date(r.created_at)+' · '+esc(r.status||'—')+'</small></div>').join('') : '<div style="padding:14px;background:#f8fafc;border-radius:8px">Nessun deposito PCT reale registrato.</div>')+'</div></div>');
  }

  function renderTimer() {
    panel('time-tracker','<div class="card"><h3>⏱️ Time Tracker & Ore Lavorate</h3><div style="font-size:12px;color:#64748b">Modalità locale: nessuna tabella time-tracking presente nel database.</div><div style="margin:18px 0;font-family:monospace;font-size:30px;font-weight:700" id="moduleStopwatch">00:00:00</div><button class="btn btn-success" id="moduleTimerStart" type="button">Avvia</button> <button class="btn btn-danger" id="moduleTimerStop" type="button">Ferma</button><div id="moduleTimerStatus" style="margin-top:12px"></div></div>');
    let elapsed=Number(sessionStorage.getItem('studio_timer_seconds')||0), started=sessionStorage.getItem('studio_timer_started')==='1', tick=null;
    const out=document.getElementById('moduleStopwatch');
    const paint=()=>{const h=String(Math.floor(elapsed/3600)).padStart(2,'0'),m=String(Math.floor(elapsed%3600/60)).padStart(2,'0'),s=String(elapsed%60).padStart(2,'0');out.textContent=h+':'+m+':'+s;};
    const start=()=>{if(tick)return;started=true;sessionStorage.setItem('studio_timer_started','1');tick=setInterval(()=>{elapsed++;sessionStorage.setItem('studio_timer_seconds',String(elapsed));paint();},1000);};
    const stop=()=>{if(tick){clearInterval(tick);tick=null;} started=false;sessionStorage.setItem('studio_timer_started','0');document.getElementById('moduleTimerStatus').textContent='Sessione fermata. Salvataggio persistente non disponibile nel database attuale.';};
    paint(); document.getElementById('moduleTimerStart').onclick=start; document.getElementById('moduleTimerStop').onclick=stop; if(started) start();
  }

  function renderBilling() {
    panel('billing','<div class="card"><h3>💶 Parcelle & Fatturazione Elettronica SDI</h3><div data-module-body style="margin-top:12px;padding:14px;background:#f8fafc;border-radius:8px"><strong>Modulo SDI non collegato.</strong><br>Audit database: non esiste una tabella fatture/SDI nel progetto. Il pannello non mostra fatture fittizie.</div><div style="margin-top:14px;font-size:12px;color:#64748b">Pratiche presenti: '+state.practices.length+' · clienti/pratiche reali disponibili nel modulo Fascicoli.</div></div>');
  }

  function renderPortal() {
    const rows=state.practices.map(p=>'<tr><td>'+esc(p.client_name)+'</td><td>'+date(p.updated_at||p.created_at)+'</td><td>'+docsFor(p.id).length+'</td><td>'+esc(p.status||'—')+'</td></tr>').join('');
    panel('client-portal','<div class="card"><h3>🌐 Portale Clienti (Extranet)</h3><div style="font-size:12px;color:#64748b">Dati reali da pratiche/documenti · gestione account cliente non configurata</div><div style="overflow:auto;margin-top:14px"><table><thead><tr><th>Cliente</th><th>Ultimo aggiornamento</th><th>File</th><th>Stato pratica</th></tr></thead><tbody data-module-body>'+ (rows||'<tr><td colspan="4">Nessuna pratica.</td></tr>')+'</tbody></table></div></div>');
  }

  function renderArchive() {
    const rows=state.audit.map(a=>'<tr><td>'+date(a.created_at||a.timestamp)+'</td><td>'+esc(a.action||a.event_type||a.operation||'—')+'</td><td>'+esc(a.user_id||'—')+'</td><td>'+esc(a.details||a.metadata||a.description||'—')+'</td></tr>').join('');
    panel('archive','<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><h3>🗄️ Archivio Storico e Audit Trail</h3><div style="font-size:12px;color:#64748b">Dati reali da studio_audit</div></div><button class="btn btn-info" id="archiveRefresh" type="button">Aggiorna</button></div><div style="overflow:auto;margin-top:14px"><table><thead><tr><th>Timestamp</th><th>Operazione</th><th>Utente</th><th>Dettagli</th></tr></thead><tbody data-module-body>'+ (rows||'<tr><td colspan="4">Nessun evento.</td></tr>')+'</tbody></table></div></div>');
    document.getElementById('archiveRefresh').onclick=refreshAll;
  }

  function renderAll(){ renderTeam(); renderAgenda(); renderPec(); renderPct(); renderTimer(); renderBilling(); renderPortal(); renderArchive(); }

  function init(){
    ['team','agenda','pec-client','pct-deposit','time-tracker','billing','client-portal','archive'].forEach(id=>bindMenu(id,refreshAll));
    refreshAll();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();