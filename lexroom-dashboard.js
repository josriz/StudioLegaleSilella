(() => {
const init=async()=>{
 const sb=window.STUDIO_SUPABASE_CLIENT || (window.STUDIO_SUPABASE_CLIENT=window.supabase.createClient(window.STUDIO_SUPABASE_URL,window.STUDIO_SUPABASE_PUBLISHABLE_KEY));
 if(!window.__LEXROOM_AUTH_LISTENER__){
   window.__LEXROOM_AUTH_LISTENER__=true;
   sb.auth.onAuthStateChange((_event,session)=>{if(session)init();});
 }
 const {data:{user}}=await sb.auth.getUser(); if(!user)return;
 const {data:profile}=await sb.from('studio_utenti').select('role').eq('user_id',user.id).maybeSingle();
 if(!profile||!['studio','admin'].includes(profile.role))return;
 const menu=document.querySelector('.sidebar-menu'), area=document.querySelector('.content-area');
 if(!menu||!area)return;
 const existingPanel=document.getElementById('panel-lexroom');
 const existingItem=[...menu.querySelectorAll('.menu-item')].find(m=>m.textContent.includes('Lexroom LAB'));
 if(existingPanel&&existingItem)return;
 const item=document.createElement('a');item.className='menu-item';item.href='#';item.innerHTML='🧪 <span>Lexroom LAB</span>';
 const panel=document.createElement('div');panel.id='panel-lexroom';panel.className='panel';
 panel.innerHTML=`
 <div class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><h3>🧠 Lexroom AI — Laboratorio gratuito</h3><span style="font-size:11px;color:#166534;background:#dcfce7;padding:5px 8px;border-radius:10px">LAB · nessuna API AI a pagamento</span><button class="btn btn-info" id="lxRefresh">Aggiorna</button></div><p id="lxStatus" style="font-size:12px;color:#64748b;margin:8px 0"></p>
 <div style="overflow:auto"><table><thead><tr><th>Data</th><th>Cliente</th><th>Materia</th><th>Stato</th><th>AI</th><th>Azioni</th></tr></thead><tbody id="lxBody"></tbody></table></div></div>
 <div class="card"><h3>📚 Modelli dello Studio</h3><form id="lxModelForm"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><input id="lxTitle" placeholder="Nome modello" required><input id="lxArea" placeholder="Materia"></div><textarea id="lxContent" placeholder="Incolla qui il modello o le istruzioni dello Studio" style="width:100%;min-height:140px;margin-top:10px"></textarea><button class="btn btn-success" style="margin-top:8px">Salva modello</button></form><div id="lxModels" style="margin-top:12px"></div></div>
 <div class="card" id="lxDetail" style="display:none"><h3 id="lxDetailTitle"></h3><div id="lxDetailBody"></div></div>`;
 area.appendChild(panel);menu.appendChild(item);
 const body=panel.querySelector('#lxBody'),status=panel.querySelector('#lxStatus'),detail=panel.querySelector('#lxDetail');
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
    (showSend?'<div style="margin-top:12px"><button class="btn btn-info" id="lxSend">Prepara comunicazione LAB</button></div>');

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