(() => {
const init=async()=>{
 const sb=window.getStudioSupabaseClient ? window.getStudioSupabaseClient() : window.STUDIO_SUPABASE_CLIENT;
 if(!sb){ console.error('[Lexroom] Client Supabase Studio non disponibile.'); return; }
 const {data:{user}}=await sb.auth.getUser();
 if(!user){
  if(!window.__lexroomLabAuthListener){
   window.__lexroomLabAuthListener=true;
   sb.auth.onAuthStateChange((_event,session)=>{ if(session) init(); });
  }
  return;
 }
 const {data:profile}=await sb.from('studio_utenti').select('role').eq('user_id',user.id).maybeSingle();
 if(!profile||!['studio','admin'].includes(profile.role))return;
 const menu=document.querySelector('.sidebar-menu'), area=document.querySelector('.content-area');
 if(!menu||!area||document.getElementById('panel-lexroom'))return;
 const item=document.createElement('a');item.className='menu-item';item.href='#';item.innerHTML='🧪 <span>Lexroom LAB</span>';
 const panel=document.createElement('div');panel.id='panel-lexroom';panel.className='panel';
 panel.innerHTML=`
 <div class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><h3>🧠 Lexroom AI — Laboratorio gratuito</h3><span style="font-size:11px;color:#166534;background:#dcfce7;padding:5px 8px;border-radius:10px">LAB · nessuna API AI a pagamento</span><button class="btn btn-info" type="button" id="lxHelp">❓ HELP</button><button class="btn btn-info" id="lxRefresh">Aggiorna</button></div><p id="lxStatus" style="font-size:12px;color:#64748b;margin:8px 0"></p>
 <div style="overflow:auto"><table><thead><tr><th>Data</th><th>Cliente</th><th>Materia</th><th>Stato</th><th>AI</th><th>Azioni</th></tr></thead><tbody id="lxBody"></tbody></table></div></div>
 <div class="card"><h3>📚 Modelli dello Studio</h3><form id="lxModelForm"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><input id="lxTitle" placeholder="Nome modello" required><input id="lxArea" placeholder="Materia"></div><textarea id="lxContent" placeholder="Incolla qui il modello o le istruzioni dello Studio" style="width:100%;min-height:140px;margin-top:10px"></textarea><button class="btn btn-success" style="margin-top:8px">Salva modello</button></form><div id="lxModels" style="margin-top:12px"></div></div>
 <div class="card" id="lxDetail" style="display:none"><h3 id="lxDetailTitle"></h3><div id="lxDetailBody"></div></div>`;

 const commItem=document.createElement('a');
 commItem.className='menu-item';
 commItem.href='#';
 commItem.innerHTML='✉️ <span>Lettere & Comunicazioni AI</span>';
 const commPanel=document.createElement('div');
 commPanel.id='panel-communications-ai';
 commPanel.className='panel';
 commPanel.innerHTML=`
 <div class="card">
   <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
     <div><h3>✉️ Lettere & Comunicazioni AI</h3><p style="font-size:12px;color:#64748b;margin-top:5px">Genera una bozza di lettera o comunicazione partendo da un fascicolo, dai modelli dello Studio e dalle istruzioni dell’avvocato.</p></div>
     <button class="btn btn-info" type="button" id="commHelp">❓ HELP</button>
   </div>
   <div class="card" style="margin-top:14px;background:#f8fafc">
     <div class="grid-2">
       <div class="form-group"><label>Fascicolo di riferimento</label><select id="commPractice" style="width:100%"><option value="">Seleziona un fascicolo…</option></select></div>
       <div class="form-group"><label>Tipo di comunicazione</label><select id="commType" style="width:100%">
         <option>Lettera al cliente</option><option>Lettera alla controparte</option><option>Diffida</option><option>Sollecito di pagamento</option><option>Richiesta documentazione</option><option>Riscontro a comunicazione ricevuta</option><option>Comunicazione professionale</option><option>Email professionale</option><option>Altro</option>
       </select></div>
       <div class="form-group"><label>Destinatario <span style="font-weight:400;color:#64748b">(facoltativo)</span></label><input id="commRecipient" placeholder="Nome / email / PEC"></div>
       <div class="form-group"><label>Oggetto <span style="font-weight:400;color:#64748b">(facoltativo: l’AI può proporlo)</span></label><input id="commSubject" placeholder="Oggetto della comunicazione"></div>
     </div>
     <div class="form-group"><label>Istruzioni dell’avvocato</label><textarea id="commInstructions" rows="5" placeholder="Es. Scrivi una diffida formale per il mancato pagamento della fattura, chiedendo il pagamento entro 10 giorni."></textarea></div>
     <button class="btn btn-success" type="button" id="commGenerate">Genera comunicazione con AI 🚀</button>
     <div id="commStatus" style="font-size:12px;color:#64748b;margin-top:9px"></div>
   </div>
 </div>
 <div class="card">
   <h3>📝 Bozza generata</h3>
   <div id="commOutput" style="white-space:pre-wrap;line-height:1.55;font-size:13px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;min-height:160px">Seleziona un fascicolo e inserisci le istruzioni per iniziare.</div>
   <div style="margin-top:10px;padding:10px;border:1px solid #fde68a;border-radius:8px;background:#fffbeb;color:#92400e;font-size:12px;line-height:1.45"><strong>Importante:</strong> questa funzione genera e salva una <strong>bozza</strong>. Nessuna email o PEC viene inviata automaticamente. L’avvocato deve verificare il testo prima dell’uso.</div>
 </div>
 <div class="card">
   <h3>📨 Comunicazioni generate recentemente</h3>
   <div id="commHistory" style="font-size:12px;color:#64748b">Caricamento…</div>
 </div>`;
 area.appendChild(commPanel);
 menu.appendChild(commItem);

 const commEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const commPractice=commPanel.querySelector('#commPractice');
 const commStatus=commPanel.querySelector('#commStatus');
 const commOutput=commPanel.querySelector('#commOutput');
 const commHistory=commPanel.querySelector('#commHistory');

 async function loadCommunicationData(){
   const {data:practices,error}=await sb.from('studio_pratiche').select('id,client_name,legal_area,counterparty,description').order('created_at',{ascending:false});
   if(error){commStatus.textContent='Errore nel caricamento dei fascicoli: '+error.message;return;}
   commPractice.innerHTML='<option value="">Seleziona un fascicolo…</option>'+(practices||[]).map(p=>'<option value="'+commEsc(p.id)+'">'+commEsc((p.client_name||'Fascicolo')+' · '+(p.legal_area||'Materia non indicata')+' · '+(p.counterparty||'Controparte non indicata'))+'</option>').join('');
   const {data:comms}=await sb.from('studio_comunicazioni').select('created_at,recipient,subject,status,channel,pratica_id').order('created_at',{ascending:false}).limit(20);
   commHistory.innerHTML=(comms||[]).length?(comms||[]).map(x=>'<div style="padding:9px;border-bottom:1px solid #e2e8f0"><strong>'+commEsc(x.subject||'Comunicazione senza oggetto')+'</strong><div style="margin-top:3px">'+commEsc(x.recipient||'Destinatario da indicare')+' · '+commEsc(x.status||'bozza')+' · '+commEsc(x.created_at?new Date(x.created_at).toLocaleString('it-IT'):'—')+'</div></div>').join(''):'Nessuna comunicazione generata.';
 }

 async function generateCommunication(){
   const practiceId=commPractice.value;
   const instructions=commPanel.querySelector('#commInstructions').value.trim();
   if(!practiceId){commStatus.textContent='Seleziona prima il fascicolo di riferimento.';return;}
   if(!instructions){commStatus.textContent='Inserisci le istruzioni dell’avvocato.';return;}
   const {data:{session},error:sessionError}=await sb.auth.getSession();
   if(sessionError||!session?.access_token){commStatus.textContent='Sessione Studio non disponibile. Effettua nuovamente l’accesso.';return;}
   const btn=commPanel.querySelector('#commGenerate');
   btn.disabled=true; btn.textContent='Generazione AI in corso…'; commStatus.textContent='L’AI sta preparando la bozza…';
   try{
     const r=await fetch(fn,{method:'POST',headers:{apikey:window.STUDIO_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({
       practiceId,action:'communication_ai',
       communicationType:commPanel.querySelector('#commType').value,
       recipient:commPanel.querySelector('#commRecipient').value.trim(),
       subject:commPanel.querySelector('#commSubject').value.trim(),
       instructions
     })});
     const out=await r.json().catch(()=>({}));
     if(!r.ok||!out.ok){commStatus.textContent=out.error||'Generazione non riuscita.';return;}
     commOutput.textContent=out.text||'Nessun testo restituito.';
     commStatus.textContent='Bozza generata e salvata nello storico. Modello AI: '+(out.model||'—')+'. Nessun invio effettuato.';
     await loadCommunicationData();
   }catch(e){console.error(e);commStatus.textContent=e?.message||'Errore durante la generazione.';}
   finally{btn.disabled=false;btn.textContent='Genera comunicazione con AI 🚀';}
 }

 commPanel.querySelector('#commHelp')?.addEventListener('click',()=>window.openStudioHelp&&window.openStudioHelp('communications'));
 commPanel.querySelector('#commGenerate').onclick=generateCommunication;
 commItem.onclick=async e=>{e.preventDefault();document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('active'));commItem.classList.add('active');commPanel.classList.add('active');const t=document.getElementById('headerTitle');if(t)t.innerText='Lettere & Comunicazioni AI';await loadCommunicationData();};
 area.appendChild(panel);menu.appendChild(item);
 const body=panel.querySelector('#lxBody'),status=panel.querySelector('#lxStatus'),detail=panel.querySelector('#lxDetail');
 panel.querySelector('#lxHelp')?.addEventListener('click',()=>window.openStudioHelp&&window.openStudioHelp('lexroom'));
 const fn=window.STUDIO_SUPABASE_URL+'/functions/v1/studio-lexroom';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function load(){
  const {data,error}=await sb.from('studio_pratiche').select('*').order('created_at',{ascending:false});
  if(error){status.textContent='Errore: '+error.message;return}
  status.textContent=user.email+' · '+data.length+' pratiche';
  body.innerHTML=data.map(p=>'<tr><td>'+esc(new Date(p.created_at).toLocaleString('it-IT'))+'</td><td><strong>'+esc(p.client_name)+'</strong></td><td>'+esc(p.legal_area)+'</td><td>'+esc(p.status)+'</td><td>'+esc(p.ai_status)+'</td><td><button class="btn btn-info lx-an" data-id="'+p.id+'">Analisi LAB</button> <button class="btn btn-success lx-dr" data-id="'+p.id+'">Bozza LAB</button></td></tr>').join('');
  body.querySelectorAll('.lx-an').forEach(b=>b.onclick=()=>run(b.dataset.id,'lab_analyze'));
  body.querySelectorAll('.lx-dr').forEach(b=>b.onclick=()=>run(b.dataset.id,'lab_draft'));
 }
 async function prepareLabSend(id,to,subject){const {data:{session}}=await sb.auth.getSession();if(!session)return;const r=await fetch(fn,{method:'POST',headers:{apikey:window.STUDIO_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({practiceId:id,action:'lab_send',to,subject})});const out=await r.json().catch(()=>({}));status.textContent=out.ok?'Comunicazione preparata in LAB. Nessuna email reale è stata inviata.':(out.error||'Preparazione non riuscita');if(out.ok)load()} async function run(id,action){
  status.textContent='Lexroom in elaborazione…';
  const {data:{session}}=await sb.auth.getSession(); if(!session)return;
  const r=await fetch(fn,{method:'POST',headers:{apikey:window.STUDIO_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({practiceId:id,action})});
  const out=await r.json().catch(()=>({}));
  if(!r.ok||!out.ok){status.textContent=out.error||'Lexroom non disponibile';return}
  detail.style.display='block';
  detail.querySelector('#lxDetailTitle').textContent=action==='lab_draft'?'Bozza LAB gratuita':action==='draft'?'Bozza Lexroom':action==='approve'?'Bozza approvata':'Analisi LAB gratuita';
  const isDraft=action==='draft'||action==='lab_draft';
  const showApprove=isDraft;
  const showSend=action==='approve';
  detail.querySelector('#lxDetailBody').innerHTML=(out.text?'<pre id="lxText" style="white-space:pre-wrap;font:13px/1.5 inherit">'+esc(out.text)+'</pre>':'<p>Operazione completata.</p>')+
    (showApprove?'<div style="margin-top:12px"><button class="btn btn-success" id="lxApprove">Approva bozza</button></div>':'')+
    (showSend?'<div style="margin-top:12px"><button class="btn btn-info" id="lxSend">Prepara comunicazione LAB</button></div>':'');

  const approveBtn=detail.querySelector('#lxApprove');
  const sendBtn=detail.querySelector('#lxSend');
  if(approveBtn)approveBtn.onclick=()=>run(id,'approve');
  if(sendBtn)sendBtn.onclick=async()=>{
    const to=prompt('Destinatario della comunicazione:');
    if(!to)return;
    const subj=prompt('Oggetto della comunicazione:','Comunicazione Studio Legale Silella');
    if(!subj)return;
    await prepareLabSend(id,to,subj);
  };
  status.textContent=action.startsWith('lab_')?'Operazione LAB completata gratuitamente.':'Lexroom completata.';
  await load();
 }
 async function loadModels(){const {data}=await sb.from('studio_modelli').select('*').order('created_at',{ascending:false});panel.querySelector('#lxModels').innerHTML=(data||[]).map(m=>'<div style="padding:9px;border-bottom:1px solid #e2e8f0"><strong>'+esc(m.title)+'</strong> · '+esc(m.legal_area||'')+'</div>').join('')}
 panel.querySelector('#lxModelForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.from('studio_modelli').insert({title:panel.querySelector('#lxTitle').value.trim(),legal_area:panel.querySelector('#lxArea').value.trim()||null,content:panel.querySelector('#lxContent').value,created_by:user.id});if(error)alert(error.message);else{e.target.reset();loadModels()}};
 panel.querySelector('#lxRefresh').onclick=load; item.onclick=async e=>{e.preventDefault();document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('active'));item.classList.add('active');panel.classList.add('active');const t=document.getElementById('headerTitle');if(t)t.innerText='Lexroom LAB — Test gratuito';await load();await loadModels()};
 load();loadModels();
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();