(function(){
  'use strict';
  const sb=window.supabase.createClient(window.STUDIO_SUPABASE_URL,window.STUDIO_SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:'silella-studio-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let user=null;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=v=>v?new Date(v).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}):'—';
  const msg=(t,ok=false)=>{if($('privacyStatus')){$('privacyStatus').textContent=t;$('privacyStatus').style.color=ok?'#166534':'#475569'}};
  const typeLabel={accesso:'Accesso',rettifica:'Rettifica',cancellazione:'Cancellazione',limitazione:'Limitazione',opposizione:'Opposizione',portabilita:'Portabilità',altro:'Altro'};

  function formFields(kind,data={}){
    if(kind==='treatment') return '<div class="grid-2">'+
      field('Nome trattamento','ptNome',data.nome)+field('Finalità','ptFinalita',data.finalita)+
      field('Base giuridica','ptBase',data.base_giuridica)+field('Categorie interessati','ptInteressati',data.categorie_interessati)+
      field('Categorie dati','ptDati',data.categorie_dati)+field('Destinatari','ptDestinatari',data.destinatari)+
      field('Conservazione','ptConservazione',data.conservazione)+field('Misure di sicurezza','ptMisure',data.misure_sicurezza)+
      '</div><div style="margin-top:12px"><label>Stato</label><select id="ptStato"><option value="attivo">Attivo</option><option value="in_revisione">In revisione</option><option value="archiviato">Archiviato</option></select></div>'+
      actions('saveTreatment','cancelTreatment');
    if(kind==='request') return '<div class="grid-2">'+
      field('Nome richiedente','prNome',data.richiedente_nome)+field('Email','prEmail',data.richiedente_email)+
      '<div class="form-group"><label>Tipo richiesta</label><select id="prTipo">'+Object.entries(typeLabel).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></div>'+
      field('Scadenza','prScadenza',data.scadenza_at?data.scadenza_at.slice(0,10):'','date')+
      '</div>'+area('Descrizione','prDescrizione',data.descrizione)+area('Note interne','prNote',data.note)+
      '<div class="form-group"><label>Stato</label><select id="prStato"><option value="aperta">Aperta</option><option value="in_lavorazione">In lavorazione</option><option value="evasa">Evasa</option><option value="chiusa">Chiusa</option></select></div>'+
      actions('saveRequest','cancelRequest');
    return '<div class="grid-2">'+
      field('Titolo evento','pbTitolo',data.titolo)+field('Rilevato il','pbRilevato',data.rilevato_at?data.rilevato_at.slice(0,16):'','datetime-local')+
      '<div class="form-group"><label>Rischio</label><select id="pbRischio"><option value="basso">Basso</option><option value="medio">Medio</option><option value="alto">Alto</option><option value="critico">Critico</option></select></div>'+
      '<div class="form-group"><label>Stato</label><select id="pbStato"><option value="aperto">Aperto</option><option value="in_valutazione">In valutazione</option><option value="gestito">Gestito</option><option value="chiuso">Chiuso</option></select></div>'+
      '</div>'+area('Descrizione','pbDescrizione',data.descrizione)+area('Categorie dati','pbDati',data.categorie_dati)+area('Interessati coinvolti','pbInteressati',data.interessati_coinvolti)+area('Azioni intraprese','pbAzioni',data.azioni_intrapprese)+
      '<div class="grid-2"><label><input type="checkbox" id="pbGarante" '+(data.notifica_garante?'checked':'')+'> Notifica Garante</label><label><input type="checkbox" id="pbInteressati" '+(data.notifica_interessati?'checked':'')+'> Notifica interessati</label></div>'+
      actions('saveBreach','cancelBreach');
  }
  function field(label,id,value='',type='text'){return '<div class="form-group"><label>'+esc(label)+'</label><input id="'+id+'" type="'+type+'" value="'+esc(value)+'"></div>'}
  function area(label,id,value=''){return '<div class="form-group"><label>'+esc(label)+'</label><textarea id="'+id+'" rows="3">'+esc(value)+'</textarea></div>'}
  function actions(save,cancel){return '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-success" type="button" id="'+save+'">Salva</button><button class="btn" type="button" id="'+cancel+'">Annulla</button></div>'}

  async function ensureAccess(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session) throw Error('Sessione Studio non disponibile.');
    const {data:p,error}=await sb.from('studio_utenti').select('role').eq('user_id',session.user.id).maybeSingle();
    if(error||!['studio','admin'].includes(p?.role)) throw Error('Accesso non autorizzato.');
    user=session.user;
  }

  async function loadAll(){
    try{await ensureAccess();
      const [t,r,b]=await Promise.all([
        sb.from('studio_privacy_trattamenti').select('*').order('created_at',{ascending:false}),
        sb.from('studio_privacy_richieste').select('*').order('ricevuta_at',{ascending:false}),
        sb.from('studio_privacy_breach').select('*').order('rilevato_at',{ascending:false})
      ]);
      if(t.error)throw t.error;if(r.error)throw r.error;if(b.error)throw b.error;
      renderTreatments(t.data||[]);renderRequests(r.data||[]);renderBreaches(b.data||[]);
      msg('Gestione Privacy aggiornata.',true);
    }catch(e){console.error(e);msg(e.message||'Errore caricamento Privacy.')}
  }

  function renderTreatments(rows){
    $('privacyTreatments').innerHTML=rows.length?'<table><thead><tr><th>Trattamento</th><th>Base giuridica</th><th>Conservazione</th><th>Stato</th><th></th></tr></thead><tbody>'+
      rows.map(x=>'<tr><td><b>'+esc(x.nome)+'</b><br><small>'+esc(x.finalita||'')+'</small></td><td>'+esc(x.base_giuridica||'—')+'</td><td>'+esc(x.conservazione||'—')+'</td><td>'+esc(x.stato)+'</td><td><button class="btn" onclick="window.editPrivacyTreatment(\''+x.id+'\')">Modifica</button></td></tr>').join('')+
      '</tbody></table>':'<div style="padding:14px;background:#f8fafc;border-radius:8px">Nessun trattamento ancora registrato.</div>';
  }
  function renderRequests(rows){
    $('privacyRequests').innerHTML=rows.length?'<table><thead><tr><th>Richiedente</th><th>Tipo</th><th>Ricevuta</th><th>Scadenza</th><th>Stato</th><th></th></tr></thead><tbody>'+
      rows.map(x=>'<tr><td><b>'+esc(x.richiedente_nome)+'</b><br><small>'+esc(x.richiedente_email||'')+'</small></td><td>'+esc(typeLabel[x.tipo_richiesta]||x.tipo_richiesta)+'</td><td>'+fmt(x.ricevuta_at)+'</td><td>'+fmt(x.scadenza_at)+'</td><td>'+esc(x.stato)+'</td><td><button class="btn" onclick="window.editPrivacyRequest(\''+x.id+'\')">Modifica</button></td></tr>').join('')+
      '</tbody></table>':'<div style="padding:14px;background:#f8fafc;border-radius:8px">Nessuna richiesta registrata.</div>';
  }
  function renderBreaches(rows){
    $('privacyBreaches').innerHTML=rows.length?'<table><thead><tr><th>Evento</th><th>Rilevato</th><th>Rischio</th><th>Stato</th><th>Notifiche</th><th></th></tr></thead><tbody>'+
      rows.map(x=>'<tr><td><b>'+esc(x.titolo)+'</b></td><td>'+fmt(x.rilevato_at)+'</td><td>'+esc(x.rischio||'—')+'</td><td>'+esc(x.stato)+'</td><td>'+((x.notifica_garante?'Garante ':'')+(x.notifica_interessati?'Interessati':'')||'—')+'</td><td><button class="btn" onclick="window.editPrivacyBreach(\''+x.id+'\')">Modifica</button></td></tr>').join('')+
      '</tbody></table>':'<div style="padding:14px;background:#f8fafc;border-radius:8px">Nessun data breach registrato.</div>';
  }

  function showBox(name){
    ['privacyTreatmentBox','privacyRequestBox','privacyBreachBox'].forEach(x=>$(x).style.display=x===name?'block':'none');
  }
  function openForm(kind,data={}){
    const box=$(kind==='treatment'?'privacyTreatmentForm':kind==='request'?'privacyRequestForm':'privacyBreachForm');
    box.innerHTML=formFields(kind,data);box.style.display='block';
    if(kind==='treatment'&&data.stato)$('ptStato').value=data.stato;
    if(kind==='request'){if(data.tipo_richiesta)$('prTipo').value=data.tipo_richiesta;if(data.stato)$('prStato').value=data.stato}
    if(kind==='breach'){if(data.rischio)$('pbRischio').value=data.rischio;if(data.stato)$('pbStato').value=data.stato}
    if(kind==='treatment'){$('saveTreatment').onclick=()=>saveTreatment(data.id);$('cancelTreatment').onclick=()=>$(box).style.display='none'}
    if(kind==='request'){$('saveRequest').onclick=()=>saveRequest(data.id);$('cancelRequest').onclick=()=>$(box).style.display='none'}
    if(kind==='breach'){$('saveBreach').onclick=()=>saveBreach(data.id);$('cancelBreach').onclick=()=>$(box).style.display='none'}
  }
  async function getRow(table,id){const {data,error}=await sb.from(table).select('*').eq('id',id).single();if(error)throw error;return data}
  async function saveTreatment(id){
    const row={nome:$('ptNome').value.trim(),finalita:$('ptFinalita').value.trim(),base_giuridica:$('ptBase').value.trim(),categorie_interessati:$('ptInteressati').value.trim(),categorie_dati:$('ptDati').value.trim(),destinatari:$('ptDestinatari').value.trim(),conservazione:$('ptConservazione').value.trim(),misure_sicurezza:$('ptMisure').value.trim(),stato:$('ptStato').value,updated_by:user.id,updated_at:new Date().toISOString()};
    if(!row.nome){alert('Inserisci il nome del trattamento.');return}
    const q=id?sb.from('studio_privacy_trattamenti').update(row).eq('id',id):sb.from('studio_privacy_trattamenti').insert({...row,created_by:user.id});
    const {error}=await q;if(error){alert(error.message);return}$('privacyTreatmentForm').style.display='none';await loadAll();
  }
  async function saveRequest(id){
    const row={richiedente_nome:$('prNome').value.trim(),richiedente_email:$('prEmail').value.trim()||null,tipo_richiesta:$('prTipo').value,descrizione:$('prDescrizione').value.trim(),scadenza_at:$('prScadenza').value?new Date($('prScadenza').value+'T23:59:59').toISOString():null,note:$('prNote').value.trim(),stato:$('prStato').value,updated_at:new Date().toISOString()};
    if(!row.richiedente_nome){alert('Inserisci il nome del richiedente.');return}
    const q=id?sb.from('studio_privacy_richieste').update(row).eq('id',id):sb.from('studio_privacy_richieste').insert({...row,created_by:user.id});
    const {error}=await q;if(error){alert(error.message);return}$('privacyRequestForm').style.display='none';await loadAll();
  }
  async function saveBreach(id){
    const row={titolo:$('pbTitolo').value.trim(),rilevato_at:$('pbRilevato').value?new Date($('pbRilevato').value).toISOString():new Date().toISOString(),descrizione:$('pbDescrizione').value.trim(),categorie_dati:$('pbDati').value.trim(),interessati_coinvolti:$('pbInteressati').value.trim(),azioni_intrapprese:$('pbAzioni').value.trim(),rischio:$('pbRischio').value,stato:$('pbStato').value,notifica_garante:$('pbGarante').checked,notifica_interessati:$('pbInteressati').checked,updated_at:new Date().toISOString()};
    if(!row.titolo){alert('Inserisci il titolo dell’evento.');return}
    const q=id?sb.from('studio_privacy_breach').update(row).eq('id',id):sb.from('studio_privacy_breach').insert({...row,created_by:user.id});
    const {error}=await q;if(error){alert(error.message);return}$('privacyBreachForm').style.display='none';await loadAll();
  }

  window.editPrivacyTreatment=async id=>{try{showBox('privacyTreatmentBox');openForm('treatment',await getRow('studio_privacy_trattamenti',id))}catch(e){alert(e.message)}};
  window.editPrivacyRequest=async id=>{try{showBox('privacyRequestBox');openForm('request',await getRow('studio_privacy_richieste',id))}catch(e){alert(e.message)}};
  window.editPrivacyBreach=async id=>{try{showBox('privacyBreachBox');openForm('breach',await getRow('studio_privacy_breach',id))}catch(e){alert(e.message)}};

  if(typeof STUDIO_HELP!=='undefined')STUDIO_HELP.privacy={title:'Gestione Privacy',intro:'Registro operativo per organizzare i principali adempimenti privacy dello Studio.',steps:['Registra i trattamenti con finalità, base giuridica, dati, interessati, destinatari, conservazione e misure di sicurezza.','Registra le richieste degli interessati e aggiorna stato e scadenza.','In caso di incidente, registra il data breach e documenta valutazione e azioni intraprese.','Mantieni le informazioni aggiornate e fai verificare al professionista la documentazione definitiva.'],studio:'Questa sezione è uno strumento organizzativo e non sostituisce la valutazione legale o privacy dello Studio.',client:'Il Cliente continua a usare il Portale Clienti per documenti, pratiche e comunicazioni.'};

  $('privacyTabTreatments').onclick=()=>showBox('privacyTreatmentBox');
  $('privacyTabRequests').onclick=()=>showBox('privacyRequestBox');
  $('privacyTabBreaches').onclick=()=>showBox('privacyBreachBox');
  $('privacyNewTreatment').onclick=()=>{showBox('privacyTreatmentBox');openForm('treatment')};
  $('privacyNewRequest').onclick=()=>{showBox('privacyRequestBox');openForm('request')};
  $('privacyNewBreach').onclick=()=>{showBox('privacyBreachBox');openForm('breach')};
  $('privacyRefresh').onclick=loadAll;
  loadAll();
})();