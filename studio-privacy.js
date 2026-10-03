(function(){
  'use strict';
  const sb=window.supabase.createClient(window.STUDIO_SUPABASE_URL,window.STUDIO_SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:'silella-studio-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let user=null, clients=[], informatives=[], treatments=[];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=v=>v?new Date(v).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}):'—';
  const date=v=>v?new Date(v).toLocaleDateString('it-IT'):'—';
  const msg=(t,ok=false)=>{if($('privacyStatus')){$('privacyStatus').textContent=t;$('privacyStatus').style.color=ok?'#166534':'#475569'}};
  const typeLabel={accesso:'Accesso',rettifica:'Rettifica',cancellazione:'Cancellazione',limitazione:'Limitazione',opposizione:'Opposizione',portabilita:'Portabilità',altro:'Altro'};

  async function ensureAccess(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session) throw Error('Sessione Studio non disponibile.');
    const {data:p,error}=await sb.from('studio_utenti').select('role').eq('user_id',session.user.id).maybeSingle();
    if(error||!['studio','admin'].includes(p?.role)) throw Error('Accesso non autorizzato.');
    user=session.user;
  }
  function field(label,id,value='',type='text',placeholder=''){return '<div class="form-group"><label>'+esc(label)+'</label><input id="'+id+'" type="'+type+'" value="'+esc(value)+'" placeholder="'+esc(placeholder)+'"></div>'}
  function area(label,id,value=''){return '<div class="form-group"><label>'+esc(label)+'</label><textarea id="'+id+'" rows="3">'+esc(value)+'</textarea></div>'}
  function actions(save,cancel){return '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-success" type="button" id="'+save+'">Salva</button><button class="btn" type="button" id="'+cancel+'">Annulla</button></div>'}
  function showBox(name){['privacyTreatmentBox','privacyRequestBox','privacyBreachBox','privacyInformativeBox','privacyConsensiBox','privacyResponsabiliBox','privacyDpiaBox'].forEach(x=>{if($(x))$(x).style.display=x===name?'block':'none'})}
  function optionList(rows,valueKey,labelKey,selected){return rows.map(x=>'<option value="'+esc(x[valueKey])+'" '+(String(x[valueKey])===String(selected||'')?'selected':'')+'>'+esc(x[labelKey])+'</option>').join('')}

  function treatmentForm(data={}){
    return '<div class="grid-2">'+field('Nome trattamento','ptNome',data.nome)+field('Finalità','ptFinalita',data.finalita)+field('Base giuridica','ptBase',data.base_giuridica)+field('Categorie interessati','ptInteressati',data.categorie_interessati)+field('Categorie dati','ptDati',data.categorie_dati)+field('Destinatari','ptDestinatari',data.destinatari)+field('Conservazione','ptConservazione',data.conservazione)+field('Misure di sicurezza','ptMisure',data.misure_sicurezza)+'</div><div class="form-group"><label>Stato</label><select id="ptStato"><option value="attivo">Attivo</option><option value="in_revisione">In revisione</option><option value="archiviato">Archiviato</option></select></div>'+actions('saveTreatment','cancelTreatment');
  }
  function requestForm(data={}){
    return '<div class="grid-2">'+field('Nome richiedente','prNome',data.richiedente_nome)+field('Email','prEmail',data.richiedente_email)+
      '<div class="form-group"><label>Tipo richiesta</label><select id="prTipo">'+Object.entries(typeLabel).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></div>'+
      field('Ricevuta il','prRicevuta',data.ricevuta_at?data.ricevuta_at.slice(0,16):new Date().toISOString().slice(0,16),'datetime-local')+
      field('Scadenza ordinaria','prScadenza',data.scadenza_at?data.scadenza_at.slice(0,10):'','date')+
      field('Verifica identità','prIdentita',data.verifica_identita,'text','es. documento verificato / non necessaria')+
      '</div>'+area('Descrizione','prDescrizione',data.descrizione)+area('Note interne','prNote',data.note)+
      '<div class="grid-2">'+field('Risposta il','prRisposta',data.risposta_at?data.risposta_at.slice(0,16):'','datetime-local')+field('Proroga fino al','prProroga',data.proroga_at?data.proroga_at.slice(0,16):'','datetime-local')+
      '</div>'+area('Motivazione proroga','prMotivazione',data.motivazione_proroga)+area('Esito risposta','prEsito',data.esito_risposta)+area('Evidenza risposta / riferimento','prEvidenza',data.evidenza_risposta)+
      '<div class="form-group"><label>Stato</label><select id="prStato"><option value="aperta">Aperta</option><option value="in_lavorazione">In lavorazione</option><option value="evasa">Evasa</option><option value="chiusa">Chiusa</option></select></div>'+actions('saveRequest','cancelRequest');
  }
  function breachForm(data={}){
    return '<div class="grid-2">'+field('Titolo evento','pbTitolo',data.titolo)+field('Rilevato il','pbRilevato',data.rilevato_at?data.rilevato_at.slice(0,16):'','datetime-local')+
      '<div class="form-group"><label>Rischio</label><select id="pbRischio">'+['basso','medio','alto','critico'].map(v=>'<option value="'+v+'">'+v.charAt(0).toUpperCase()+v.slice(1)+'</option>').join('')+'</select></div>'+
      '<div class="form-group"><label>Stato</label><select id="pbStato"><option value="aperto">Aperto</option><option value="in_valutazione">In valutazione</option><option value="gestito">Gestito</option><option value="chiuso">Chiuso</option></select></div>'+
      '</div>'+area('Descrizione','pbDescrizione',data.descrizione)+area('Categorie dati','pbDati',data.categorie_dati)+area('Interessati coinvolti','pbInteressati',data.interessati_coinvolti)+area('Valutazione del rischio','pbValutazione',data.valutazione_rischio)+area('Azioni intraprese','pbAzioni',data.azioni_intrapprese)+area('Misure preventive/correttive','pbMisure',data.misure_preventive)+
      '<div class="grid-2">'+field('Notifica Garante il','pbGaranteAt',data.notifica_garante_at?data.notifica_garante_at.slice(0,16):'','datetime-local')+field('Notifica interessati il','pbInteressatiAt',data.notifica_interessati_at?data.notifica_interessati_at.slice(0,16):'','datetime-local')+field('Riferimento Garante','pbRiferimento',data.riferimento_garante)+field('Decisione sulla notifica','pbDecisione',data.decisione_notifica)+'</div>'+
      '<div class="grid-2"><label><input type="checkbox" id="pbGarante" '+(data.notifica_garante?'checked':'')+'> Notifica Garante prevista/effettuata</label><label><input type="checkbox" id="pbNotificaInteressati" '+(data.notifica_interessati?'checked':'')+'> Notifica interessati prevista/effettuata</label></div>'+
      field('Data chiusura','pbChiusura',data.data_chiusura?data.data_chiusura.slice(0,16):'','datetime-local')+actions('saveBreach','cancelBreach');
  }
  function informativeForm(data={}){
    return '<div class="grid-2">'+field('Titolo','piTitolo',data.titolo)+field('Tipo','piTipo',data.tipo||'clienti')+field('Versione','piVersione',data.versione||'1.0')+field('Valida dal','piDal',data.valida_dal||'','date')+field('Valida al','piAl',data.valida_al||'','date')+
      '<div class="form-group"><label>Stato</label><select id="piStato"><option value="bozza">Bozza</option><option value="attiva">Attiva</option><option value="archiviata">Archiviata</option></select></div></div>'+
      area('Testo informativa','piContenuto',data.contenuto)+area('Note','piNote',data.note)+actions('saveInformative','cancelInformative');
  }
  function consentForm(data={}){
    return '<div class="grid-2">'+
      '<div class="form-group"><label>Cliente</label><select id="pcCliente"><option value="">Seleziona cliente</option>'+optionList(clients,'id','full_name',data.cliente_id)+'</select></div>'+
      '<div class="form-group"><label>Informativa / versione</label><select id="pcInformativa"><option value="">Seleziona informativa</option>'+optionList(informatives,'id', 'titolo',data.informativa_id)+'</select></div>'+
      '<div class="form-group"><label>Azione</label><select id="pcAzione"><option value="presa_visione">Presa visione</option><option value="consenso">Consenso</option><option value="revoca">Revoca</option></select></div>'+
      field('Finalità','pcFinalita',data.finalita)+field('Registrato il','pcData',data.registrato_at?data.registrato_at.slice(0,16):new Date().toISOString().slice(0,16),'datetime-local')+field('Fonte','pcFonte',data.fonte,'text','portale, email, documento cartaceo...')+
      '</div>'+area('Evidenza / riferimento','pcEvidenza',data.evidenza)+area('Note','pcNote',data.note)+actions('saveConsent','cancelConsent');
  }
  function processorForm(data={}){
    return '<div class="grid-2">'+field('Denominazione','ppNome',data.denominazione)+field('Servizio','ppServizio',data.servizio)+field('Ruolo','ppRuolo',data.ruolo||'Responsabile del trattamento')+
      '<div class="form-group"><label>Stato contratto / nomina</label><select id="ppStato">'+['da_verificare','in_raccolta','firmato','scaduto','chiuso'].map(v=>'<option value="'+v+'">'+v.replace('_',' ')+'</option>').join('')+'</select></div>'+
      field('Data contratto','ppData',data.contratto_data||'','date')+field('Scadenza','ppScadenza',data.scadenza_data||'','date')+field('Paesi di trattamento','ppPaesi',data.paesi_trattamento)+field('Contatto','ppContatto',data.contatto)+'</div>'+area('Sub-responsabili / catena fornitori','ppSub',data.subresponsabili)+area('Note','ppNote',data.note)+actions('saveProcessor','cancelProcessor');
  }
  function dpiaForm(data={}){
    return '<div class="grid-2">'+field('Titolo valutazione','pdTitolo',data.titolo)+
      '<div class="form-group"><label>Trattamento collegato</label><select id="pdTrattamento"><option value="">Nessuno</option>'+optionList(treatments,'id','nome',data.trattamento_id)+'</select></div>'+
      '<div class="form-group"><label>Stato</label><select id="pdStato">'+['bozza','in_valutazione','approvata','non_necessaria','archiviata'].map(v=>'<option value="'+v+'">'+v.replace('_',' ')+'</option>').join('')+'</select></div>'+
      field('Riesame effettuato','pdRiesame',data.riesame_at?data.riesame_at.slice(0,16):'','datetime-local')+field('Prossimo riesame','pdProssimo',data.prossimo_riesame_at?data.prossimo_riesame_at.slice(0,16):'','datetime-local')+'</div>'+
      area('Necessità / motivazione','pdNecessita',data.necessita)+area('Rischi per diritti e libertà','pdRischi',data.rischi)+area('Misure di mitigazione','pdMisure',data.misure)+area('Rischio residuo','pdResiduo',data.rischio_residuo)+area('Esito','pdEsito',data.esito)+area('Note','pdNote',data.note)+actions('saveDpia','cancelDpia');
  }

  function renderTreatments(rows){treatments=rows;$('privacyTreatments').innerHTML=rows.length?'<table><thead><tr><th>Trattamento</th><th>Base</th><th>Conservazione</th><th>Stato</th><th></th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+esc(x.nome)+'</b><br><small>'+esc(x.finalita||'')+'</small></td><td>'+esc(x.base_giuridica||'—')+'</td><td>'+esc(x.conservazione||'—')+'</td><td>'+esc(x.stato)+'</td><td><button class="btn" onclick="window.editPrivacyTreatment(\''+x.id+'\')">Modifica</button></td></tr>').join('')+'</tbody></table>':'<div style="padding:14px;background:#f8fafc;border-radius:8px">Nessun trattamento ancora registrato.</div>'}
  function renderRequests(rows){$('privacyRequests').innerHTML=rows.length?'<table><thead><tr><th>Richiedente</th><th>Tipo</th><th>Ricevuta</th><th>Scadenza</th><th>Stato</th><th></th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+esc(x.richiedente_nome)+'</b><br><small>'+esc(x.richiedente_email||'')+'</small></td><td>'+esc(typeLabel[x.tipo_richiesta]||x.tipo_richiesta)+'</td><td>'+fmt(x.ricevuta_at)+'</td><td>'+date(x.scadenza_at)+'</td><td>'+esc(x.stato)+'</td><td><button class="btn" onclick="window.editPrivacyRequest(\''+x.id+'\')">Modifica</button></td></tr>').join('')+'</tbody></table>':'<div style="padding:14px;background:#f8fafc;border-radius:8px">Nessuna richiesta registrata.</div>'}
  function renderBreaches(rows){$('privacyBreaches').innerHTML=rows.length?'<table><thead><tr><th>Evento</th><th>Rilevato</th><th>Rischio</th><th>Stato</th><th>Notifiche</th><th></th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+esc(x.titolo)+'</b></td><td>'+fmt(x.rilevato_at)+'</td><td>'+esc(x.rischio||'—')+'</td><td>'+esc(x.stato)+'</td><td>'+((x.notifica_garante?'Garante ':'')+(x.notifica_interessati?'Interessati':'')||'—')+'</td><td><button class="btn" onclick="window.editPrivacyBreach(\''+x.id+'\')">Modifica</button></td></tr>').join('')+'</tbody></table>':'<div style="padding:14px;background:#f8fafc;border-radius:8px">Nessun data breach registrato.</div>'}
  function renderInformative(rows){informatives=rows;$('privacyInformatives').innerHTML=rows.length?'<table><thead><tr><th>Titolo</th><th>Versione</th><th>Validità</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+esc(x.titolo)+'</b><br><small>'+esc(x.tipo)+'</small></td><td>'+esc(x.versione)+'</td><td>'+date(x.valida_dal)+' → '+date(x.valida_al)+'</td><td>'+esc(x.stato)+'</td><td style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" onclick="window.editPrivacyInformative(\''+x.id+'\')">Modifica</button>'+(x.stato==='attiva'&&x.tipo==='clienti'?'<button class="btn btn-success" onclick="window.sendPrivacyInformative(\''+x.id+'\')">Invia al cliente</button>':'')+'</td></tr>').join('')+'</tbody></table>':'<div style="padding:14px;background:#f8fafc;border-radius:8px">Nessuna informativa registrata.</div>'}
  function renderConsensi(rows){$('privacyConsensi').innerHTML=rows.length?'<table><thead><tr><th>Cliente</th><th>Informativa</th><th>Azione</th><th>Data</th><th>Fonte</th><th>Gestione</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.studio_clienti?.full_name||x.client_name||'—')+'</td><td>'+esc(x.studio_privacy_informative?.titolo||x.informativa_titolo||'—')+(x.informativa_versione?' <small>v'+esc(x.informativa_versione)+'</small>':'')+'</td><td>'+esc(x.tipo_azione||x.tipo||'—')+'</td><td>'+fmt(x.registrato_at||x.accepted_at)+'</td><td>'+esc(x.fonte||'portale')+'</td><td>'+(x._portal?'<span style="color:#166534;font-weight:600">Portale</span>':'<button class="btn" onclick="window.editPrivacyConsent(\''+x.id+'\')">Modifica</button>')+'</td></tr>').join('')+'</tbody></table>':'<div style="padding:14px;background:#f8fafc;border-radius:8px">Nessuna registrazione.</div>'}
  function renderProcessors(rows){$('privacyResponsabili').innerHTML=rows.length?'<table><thead><tr><th>Fornitore</th><th>Servizio</th><th>Nomina</th><th>Scadenza</th><th></th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+esc(x.denominazione)+'</b></td><td>'+esc(x.servizio||'—')+'</td><td>'+esc(x.contratto_stato)+'</td><td>'+date(x.scadenza_data)+'</td><td><button class="btn" onclick="window.editPrivacyProcessor(\''+x.id+'\')">Modifica</button></td></tr>').join('')+'</tbody></table>':'<div style="padding:14px;background:#f8fafc;border-radius:8px">Nessun responsabile registrato.</div>'}
  function renderDpia(rows){$('privacyDpia').innerHTML=rows.length?'<table><thead><tr><th>Valutazione</th><th>Trattamento</th><th>Stato</th><th>Prossimo riesame</th><th></th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+esc(x.titolo)+'</b></td><td>'+esc(x.studio_privacy_trattamenti?.nome||'—')+'</td><td>'+esc(x.stato)+'</td><td>'+fmt(x.prossimo_riesame_at)+'</td><td><button class="btn" onclick="window.editPrivacyDpia(\''+x.id+'\')">Modifica</button></td></tr>').join('')+'</tbody></table>':'<div style="padding:14px;background:#f8fafc;border-radius:8px">Nessuna DPIA/valutazione registrata.</div>'}

  async function getRow(table,id){const {data,error}=await sb.from(table).select('*').eq('id',id).single();if(error)throw error;return data}
  async function save(table,row,id){const q=id?sb.from(table).update(row).eq('id',id):sb.from(table).insert({...row,created_by:user.id});const {error}=await q;if(error)throw error;await loadAll()}

  async function saveTreatment(id){try{const row={nome:$('ptNome').value.trim(),finalita:$('ptFinalita').value.trim(),base_giuridica:$('ptBase').value.trim(),categorie_interessati:$('ptInteressati').value.trim(),categorie_dati:$('ptDati').value.trim(),destinatari:$('ptDestinatari').value.trim(),conservazione:$('ptConservazione').value.trim(),misure_sicurezza:$('ptMisure').value.trim(),stato:$('ptStato').value,updated_by:user.id,updated_at:new Date().toISOString()};if(!row.nome)throw Error('Inserisci il nome del trattamento.');await save('studio_privacy_trattamenti',row,id);$('privacyTreatmentForm').style.display='none'}catch(e){alert(e.message)}}
  async function saveRequest(id){try{const row={richiedente_nome:$('prNome').value.trim(),richiedente_email:$('prEmail').value.trim()||null,tipo_richiesta:$('prTipo').value,descrizione:$('prDescrizione').value.trim(),ricevuta_at:$('prRicevuta').value?new Date($('prRicevuta').value).toISOString():new Date().toISOString(),scadenza_at:$('prScadenza').value?new Date($('prScadenza').value+'T23:59:59').toISOString():null,verifica_identita:$('prIdentita').value.trim(),risposta_at:$('prRisposta').value?new Date($('prRisposta').value).toISOString():null,proroga_at:$('prProroga').value?new Date($('prProroga').value).toISOString():null,motivazione_proroga:$('prMotivazione').value.trim(),esito_risposta:$('prEsito').value.trim(),evidenza_risposta:$('prEvidenza').value.trim(),note:$('prNote').value.trim(),stato:$('prStato').value,updated_at:new Date().toISOString()};if(!row.richiedente_nome)throw Error('Inserisci il nome del richiedente.');await save('studio_privacy_richieste',row,id);$('privacyRequestForm').style.display='none'}catch(e){alert(e.message)}}
  async function saveBreach(id){try{const row={titolo:$('pbTitolo').value.trim(),rilevato_at:$('pbRilevato').value?new Date($('pbRilevato').value).toISOString():new Date().toISOString(),descrizione:$('pbDescrizione').value.trim(),categorie_dati:$('pbDati').value.trim(),interessati_coinvolti:$('pbInteressati').value.trim(),valutazione_rischio:$('pbValutazione').value.trim(),azioni_intrapprese:$('pbAzioni').value.trim(),misure_preventive:$('pbMisure').value.trim(),rischio:$('pbRischio').value,stato:$('pbStato').value,notifica_garante:$('pbGarante').checked,notifica_interessati:$('pbNotificaInteressati').checked,notifica_garante_at:$('pbGaranteAt').value?new Date($('pbGaranteAt').value).toISOString():null,notifica_interessati_at:$('pbInteressatiAt').value?new Date($('pbInteressatiAt').value).toISOString():null,riferimento_garante:$('pbRiferimento').value.trim(),decisione_notifica:$('pbDecisione').value.trim(),data_chiusura:$('pbChiusura').value?new Date($('pbChiusura').value).toISOString():null,updated_at:new Date().toISOString()};if(!row.titolo)throw Error('Inserisci il titolo dell’evento.');await save('studio_privacy_breach',row,id);$('privacyBreachForm').style.display='none'}catch(e){alert(e.message)}}
  async function sendPrivacyInformative(id){
    const informative=informatives.find(x=>x.id===id);
    if(!informative||informative.stato!=='attiva'){alert('Attiva prima l’informativa da inviare.');return}
    const options=clients.filter(x=>x.user_id).map(x=>'<option value="'+x.id+'">'+esc(x.full_name||x.user_id)+'</option>').join('');
    if(!options){alert('Nessun cliente con accesso attivo al Portale.');return}
    const m=document.createElement('div');m.className='modal';m.innerHTML='<div class="modalBox"><div class="modalHead"><h2>Invia informativa al cliente</h2><button class="iconBtn" type="button" id="closePrivacySend">✕</button></div><p class="status">Il sistema genera il PDF dalla versione attiva, lo collega al cliente e lo mette nella sezione “Da firmare”.</p><div class="form-group"><label>Cliente</label><select id="privacySendClient"><option value="">Seleziona cliente</option>'+options+'</select></div><div id="privacySendStatus" class="status"></div><div class="actions"><button class="btn outline" type="button" id="cancelPrivacySend">Annulla</button><button class="btn gold" type="button" id="confirmPrivacySend">Invia</button></div></div>';document.body.appendChild(m);
    const close=()=>m.remove();m.querySelector('#closePrivacySend').onclick=close;m.querySelector('#cancelPrivacySend').onclick=close;
    m.querySelector('#confirmPrivacySend').onclick=async()=>{const clientId=m.querySelector('#privacySendClient').value,s=m.querySelector('#privacySendStatus'),b=m.querySelector('#confirmPrivacySend');if(!clientId){s.textContent='Seleziona un cliente.';return}b.disabled=true;s.textContent='Generazione PDF e invio…';try{const {data,error}=await sb.functions.invoke('studio-privacy-portal',{body:{action:'send',informative_id:id,client_id:clientId}});if(error)throw error;if(!data?.ok)throw Error(data?.error||'Invio non riuscito.');s.textContent='Documento inviato al Portale Cliente.';setTimeout(()=>{close();loadAll()},500)}catch(e){b.disabled=false;s.textContent=e.message||'Errore invio.'}};
}
async function saveInformative(id){try{const row={titolo:$('piTitolo').value.trim(),tipo:$('piTipo').value.trim(),versione:$('piVersione').value.trim(),contenuto:$('piContenuto').value.trim(),stato:$('piStato').value,valida_dal:$('piDal').value||null,valida_al:$('piAl').value||null,note:$('piNote').value.trim(),updated_by:user.id,updated_at:new Date().toISOString()};if(!row.titolo||!row.contenuto)throw Error('Titolo e testo informativa sono obbligatori.');await save('studio_privacy_informative',row,id);$('privacyInformativeForm').style.display='none'}catch(e){alert(e.message)}}
  async function saveConsent(id){try{const row={cliente_id:$('pcCliente').value||null,user_id:null,informativa_id:$('pcInformativa').value||null,tipo_azione:$('pcAzione').value,finalita:$('pcFinalita').value.trim(),registrato_at:$('pcData').value?new Date($('pcData').value).toISOString():new Date().toISOString(),fonte:$('pcFonte').value.trim(),evidenza:$('pcEvidenza').value.trim(),note:$('pcNote').value.trim()};if(!row.cliente_id||!row.informativa_id)throw Error('Seleziona cliente e informativa.');const c=clients.find(x=>x.id===row.cliente_id);row.user_id=c?.user_id||null;row.esito=row.tipo_azione==='revoca'?'revocato':'registrato';await save('studio_privacy_consensi',row,id);$('privacyConsentForm').style.display='none'}catch(e){alert(e.message)}}
  async function saveProcessor(id){try{const row={denominazione:$('ppNome').value.trim(),servizio:$('ppServizio').value.trim(),ruolo:$('ppRuolo').value.trim(),contratto_stato:$('ppStato').value,contratto_data:$('ppData').value||null,scadenza_data:$('ppScadenza').value||null,paesi_trattamento:$('ppPaesi').value.trim(),subresponsabili:$('ppSub').value.trim(),contatto:$('ppContatto').value.trim(),note:$('ppNote').value.trim(),updated_by:user.id,updated_at:new Date().toISOString()};if(!row.denominazione)throw Error('Inserisci la denominazione.');await save('studio_privacy_responsabili',row,id);$('privacyProcessorForm').style.display='none'}catch(e){alert(e.message)}}
  async function saveDpia(id){try{const row={trattamento_id:$('pdTrattamento').value||null,titolo:$('pdTitolo').value.trim(),necessita:$('pdNecessita').value.trim(),rischi:$('pdRischi').value.trim(),misure:$('pdMisure').value.trim(),rischio_residuo:$('pdResiduo').value.trim(),esito:$('pdEsito').value.trim(),stato:$('pdStato').value,riesame_at:$('pdRiesame').value?new Date($('pdRiesame').value).toISOString():null,prossimo_riesame_at:$('pdProssimo').value?new Date($('pdProssimo').value).toISOString():null,note:$('pdNote').value.trim(),updated_by:user.id,updated_at:new Date().toISOString()};if(!row.titolo)throw Error('Inserisci il titolo della valutazione.');await save('studio_privacy_dpia',row,id);$('privacyDpiaForm').style.display='none'}catch(e){alert(e.message)}}

  function openForm(kind,data={}){
    const map={treatment:['privacyTreatmentForm',treatmentForm],request:['privacyRequestForm',requestForm],breach:['privacyBreachForm',breachForm],informative:['privacyInformativeForm',informativeForm],consent:['privacyConsentForm',consentForm],processor:['privacyProcessorForm',processorForm],dpia:['privacyDpiaForm',dpiaForm]};
    const [id,fn]=map[kind];const box=$(id);box.innerHTML=fn(data);box.style.display='block';
    if(kind==='treatment'){if(data.stato)$('ptStato').value=data.stato;$('saveTreatment').onclick=()=>saveTreatment(data.id);$('cancelTreatment').onclick=()=>box.style.display='none'}
    if(kind==='request'){if(data.tipo_richiesta)$('prTipo').value=data.tipo_richiesta;if(data.stato)$('prStato').value=data.stato;$('saveRequest').onclick=()=>saveRequest(data.id);$('cancelRequest').onclick=()=>box.style.display='none'}
    if(kind==='breach'){if(data.rischio)$('pbRischio').value=data.rischio;if(data.stato)$('pbStato').value=data.stato;$('saveBreach').onclick=()=>saveBreach(data.id);$('cancelBreach').onclick=()=>box.style.display='none'}
    if(kind==='informative'){if(data.stato)$('piStato').value=data.stato;$('saveInformative').onclick=()=>saveInformative(data.id);$('cancelInformative').onclick=()=>box.style.display='none'}
    if(kind==='consent'){$('saveConsent').onclick=()=>saveConsent(data.id);$('cancelConsent').onclick=()=>box.style.display='none';if(data.tipo_azione)$('pcAzione').value=data.tipo_azione}
    if(kind==='processor'){if(data.contratto_stato)$('ppStato').value=data.contratto_stato;$('saveProcessor').onclick=()=>saveProcessor(data.id);$('cancelProcessor').onclick=()=>box.style.display='none'}
    if(kind==='dpia'){if(data.stato)$('pdStato').value=data.stato;$('saveDpia').onclick=()=>saveDpia(data.id);$('cancelDpia').onclick=()=>box.style.display='none'}
  }

  window.editPrivacyTreatment=async id=>{try{showBox('privacyTreatmentBox');openForm('treatment',await getRow('studio_privacy_trattamenti',id))}catch(e){alert(e.message)}};
  window.editPrivacyRequest=async id=>{try{showBox('privacyRequestBox');openForm('request',await getRow('studio_privacy_richieste',id))}catch(e){alert(e.message)}};
  window.editPrivacyBreach=async id=>{try{showBox('privacyBreachBox');openForm('breach',await getRow('studio_privacy_breach',id))}catch(e){alert(e.message)}};
  window.editPrivacyInformative=async id=>{try{showBox('privacyInformativeBox');openForm('informative',await getRow('studio_privacy_informative',id))}catch(e){alert(e.message)}};
  window.editPrivacyConsent=async id=>{try{showBox('privacyConsensiBox');openForm('consent',await getRow('studio_privacy_consensi',id))}catch(e){alert(e.message)}};
  window.editPrivacyProcessor=async id=>{try{showBox('privacyResponsabiliBox');openForm('processor',await getRow('studio_privacy_responsabili',id))}catch(e){alert(e.message)}};
  window.editPrivacyDpia=async id=>{try{showBox('privacyDpiaBox');openForm('dpia',await getRow('studio_privacy_dpia',id))}catch(e){alert(e.message)}};

  async function loadAll(){
    try{await ensureAccess();
      const [t,r,b,i,c,pc,p,d,cl]=await Promise.all([
        sb.from('studio_privacy_trattamenti').select('*').order('created_at',{ascending:false}),
        sb.from('studio_privacy_richieste').select('*').order('ricevuta_at',{ascending:false}),
        sb.from('studio_privacy_breach').select('*').order('rilevato_at',{ascending:false}),
        sb.from('studio_privacy_informative').select('*').order('created_at',{ascending:false}),
        sb.from('studio_privacy_consensi').select('*,studio_clienti(full_name),studio_privacy_informative(titolo,versione)').order('registrato_at',{ascending:false}),
        sb.from('studio_consensi_portale').select('*,studio_privacy_informative(titolo,versione)').eq('tipo','privacy').order('accepted_at',{ascending:false}),
        sb.from('studio_privacy_responsabili').select('*').order('created_at',{ascending:false}),
        sb.from('studio_privacy_dpia').select('*,studio_privacy_trattamenti(nome)').order('created_at',{ascending:false}),
        sb.from('studio_clienti').select('id,user_id,full_name').order('full_name')
      ]);
      for(const x of [t,r,b,i,c,pc,p,d,cl])if(x.error)throw x.error;
      clients=cl.data||[];
      const clientByUser=new Map(clients.map(x=>[x.user_id,x]));
      const portalPrivacy=(pc.data||[]).map(x=>({...x,_portal:true,client_name:clientByUser.get(x.user_id)?.full_name||x.user_id}));
      renderTreatments(t.data||[]);renderRequests(r.data||[]);renderBreaches(b.data||[]);renderInformative(i.data||[]);renderConsensi([...(c.data||[]),...portalPrivacy]);renderProcessors(p.data||[]);renderDpia(d.data||[]);
      msg('Gestione Privacy aggiornata.',true);
    }catch(e){console.error(e);msg(e.message||'Errore caricamento Privacy.')}
  }

  if(typeof STUDIO_HELP!=='undefined')STUDIO_HELP.privacy={title:'Gestione Privacy',intro:'Modulo operativo per organizzare i principali adempimenti privacy dello Studio.',steps:['Registro trattamenti: finalità, base giuridica, dati, interessati, destinatari, conservazione e sicurezza.','Informative: testo, versione, validità e stato. Solo le informative attive di tipo clienti vengono rese visibili nel Portale Clienti.','Consensi/prese visione: collega il cliente alla versione dell’informativa e conserva l’evidenza.','Responsabili: censisci fornitori e stato della nomina/contratto.','Richieste interessati: traccia identità, scadenze, risposta, proroghe ed evidenze.','DPIA: documenta necessità, rischi, misure, rischio residuo e riesami quando richiesto.','Data breach: documenta valutazione, decisione di notifica, notifiche e misure correttive.'],studio:'Strumento organizzativo: i testi delle informative, le basi giuridiche e le valutazioni devono essere parametrizzati ai trattamenti reali dello Studio e verificati professionalmente.',client:'Il Portale Clienti gestisce pratiche, documenti, comunicazioni e registra la presa visione dell’informativa privacy attiva.'};

  const tabs=[['privacyTabTreatments','privacyTreatmentBox'],['privacyTabRequests','privacyRequestBox'],['privacyTabBreaches','privacyBreachBox'],['privacyTabInformative','privacyInformativeBox'],['privacyTabConsensi','privacyConsensiBox'],['privacyTabResponsabili','privacyResponsabiliBox'],['privacyTabDpia','privacyDpiaBox']];
  tabs.forEach(([a,b])=>{if($(a))$(a).onclick=()=>showBox(b)});
  if($('privacyNewTreatment'))$('privacyNewTreatment').onclick=()=>{showBox('privacyTreatmentBox');openForm('treatment')};
  if($('privacyNewRequest'))$('privacyNewRequest').onclick=()=>{showBox('privacyRequestBox');openForm('request')};
  if($('privacyNewBreach'))$('privacyNewBreach').onclick=()=>{showBox('privacyBreachBox');openForm('breach')};
  if($('privacyNewInformative'))$('privacyNewInformative').onclick=()=>{showBox('privacyInformativeBox');openForm('informative')};
  if($('privacyNewConsent'))$('privacyNewConsent').onclick=()=>{showBox('privacyConsensiBox');openForm('consent')};
  if($('privacyNewProcessor'))$('privacyNewProcessor').onclick=()=>{showBox('privacyResponsabiliBox');openForm('processor')};
  if($('privacyNewDpia'))$('privacyNewDpia').onclick=()=>{showBox('privacyDpiaBox');openForm('dpia')};
  if($('privacyRefresh'))$('privacyRefresh').onclick=loadAll;
  loadAll();
})();