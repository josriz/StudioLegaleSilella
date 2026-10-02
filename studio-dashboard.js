(() => {
  const init = async () => {
    if (!window.supabase || !window.STUDIO_SUPABASE_URL || !window.STUDIO_SUPABASE_PUBLISHABLE_KEY) {
      console.error('Configurazione Supabase non disponibile.');
      return;
    }

    const client = window.STUDIO_SUPABASE_CLIENT || (window.STUDIO_SUPABASE_CLIENT = window.supabase.createClient(
      window.STUDIO_SUPABASE_URL,
      window.STUDIO_SUPABASE_PUBLISHABLE_KEY,
      {auth:{storageKey:'silella-studio-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
    ));

    const menu = document.querySelector('.sidebar-menu');
    const contentArea = document.querySelector('.content-area');
    if (!menu || !contentArea || document.getElementById('panel-studio-pratiche')) return;

    const item = document.createElement('a');
    item.className = 'menu-item';
    item.innerHTML = '📥 <span>Pratiche ricevute</span>';
    item.href = '#';

    const panel = document.createElement('div');
    panel.id = 'panel-studio-pratiche';
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <h3 style="margin:0">📥 Pratiche ricevute dal Portale Clienti</h3>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-info" id="studioRefresh" type="button">Aggiorna</button>
            <button class="btn" id="studioLogout" type="button">Esci</button>
          </div>
        </div>
        <div id="studioAuthStatus" style="margin-top:10px;font-size:12px;color:#64748b"></div>
        <div style="overflow-x:auto;margin-top:14px">
          <table>
            <thead>
              <tr>
                <th>Ricezione</th>
                <th>Cliente</th>
                <th>Area</th>
                <th>Controparte</th>
                <th>Richiesta</th>
                <th>Allegati</th>
                <th>Stato</th>
                <th>Gestione</th>
              </tr>
            </thead>
            <tbody id="studioPracticesBody">
              <tr><td colspan="8">Accesso richiesto.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    contentArea.appendChild(panel);
    menu.appendChild(item);

    const body = document.getElementById('studioPracticesBody');
    const status = document.getElementById('studioAuthStatus');
    const loginModal = document.createElement('div');
    loginModal.id = 'studioLoginModal';
    loginModal.style.cssText = 'display:flex;position:fixed;inset:0;background:#ffffff;z-index:9999;align-items:center;justify-content:center;padding:20px;';
    loginModal.innerHTML = `
      <div style="width:min(420px,100%);background:#fff;border-radius:14px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.25)">
        <h2 style="margin:0 0 6px">Accesso Studio Legale Silella</h2>
        <p style="margin:0 0 18px;color:#64748b;font-size:14px">Accedi per visualizzare le pratiche ricevute dai clienti.</p>
        <form id="studioLoginForm">
          <label style="display:block;margin-bottom:6px;font-weight:600">Email</label>
          <input id="studioLoginEmail" type="email" autocomplete="username" required style="width:100%;box-sizing:border-box;margin-bottom:14px;padding:10px;border:1px solid #cbd5e1;border-radius:8px">
          <label style="display:block;margin-bottom:6px;font-weight:600">Password</label>
          <input id="studioLoginPassword" type="password" autocomplete="current-password" required style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:10px;border:1px solid #cbd5e1;border-radius:8px">
          <div id="studioLoginError" style="min-height:20px;color:#b91c1c;font-size:13px;margin-bottom:10px"></div>
          <button id="studioLoginSubmit" type="submit" class="btn btn-info" style="width:100%">Accedi</button>
        </form>
      </div>
    `;
    document.body.appendChild(loginModal);

    function esc(v) {
      return String(v ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[c]));
    }

    let studioAccessGranted = false;

    function showLogin() {
      document.getElementById('studioLoginError').textContent = '';
      document.getElementById('studioLoginPassword').value = '';
      loginModal.style.display = 'flex';
      setTimeout(() => document.getElementById('studioLoginEmail').focus(), 50);
    }

    function hideLogin() {
      loginModal.style.display = 'none';
    }

    async function getAuthorizedStudioUser(user) {
      if (!user) return null;

      const { data, error } = await client
        .from('studio_utenti')
        .select('user_id,role,full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Verifica ruolo Area Studio:', error);
        return null;
      }

      if (!data || data.role !== 'studio') return null;
      return user;
    }

    async function ensureAuth() {
      if (!studioAccessGranted) {
        showLogin();
        return null;
      }

      const { data: { user }, error } = await client.auth.getUser();
      if (user) {
        const authorizedUser = await getAuthorizedStudioUser(user);
        if (authorizedUser) return authorizedUser;

        await client.auth.signOut();
        studioAccessGranted = false;
        const errorBox = document.getElementById('studioLoginError');
        if (errorBox) errorBox.textContent = 'Questo account non è autorizzato all’Area Studio.';
        showLogin();
        return null;
      }

      // Nessuna sessione: AuthSessionMissingError è normale al primo accesso.
      // In questo caso apriamo il login invece di trattarlo come errore applicativo.
      if (error && error.name !== 'AuthSessionMissingError') {
        console.error(error);
        status.textContent = 'Errore autenticazione: ' + (error.message || error.name || 'errore sconosciuto');
      }

      showLogin();
      return null;
    }

    async function loadPractices() {
      body.innerHTML = '<tr><td colspan="8">Caricamento…</td></tr>';

      const user = await ensureAuth();
      if (!user) {
        status.textContent = 'Accesso richiesto.';
        body.innerHTML = '<tr><td colspan="8">Effettua l’accesso per visualizzare le pratiche.</td></tr>';
        return;
      }

      const { data, error } = await client
        .from('studio_pratiche')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        status.textContent = 'Errore nel caricamento delle pratiche.';
        body.innerHTML = '<tr><td colspan="8">Impossibile caricare le pratiche.</td></tr>';
        console.error(error);
        return;
      }

      status.textContent = 'Accesso autenticato · ' + user.email + ' · ' + data.length + ' pratiche';

      body.innerHTML = data.length
        ? data.map(p =>
            '<tr>' +
            '<td>' + esc(new Date(p.created_at).toLocaleString('it-IT')) + '</td>' +
            '<td><strong>' + esc(p.client_name) + '</strong><br><small>' + esc(p.tax_id) + '</small></td>' +
            '<td>' + esc(p.legal_area) + '</td>' +
            '<td>' + esc(p.counterparty) + '</td>' +
            '<td style="min-width:260px">' + esc(p.description) + '</td>' +
            '<td>' + esc(p.file_names || 'Nessuno') + '</td>' +
            '<td><span class="badge-status status-sent">' + esc(p.status) + '</span></td>' +
            '<td><button class="btn btn-info studio-open" type="button" data-id="' + esc(p.id) + '">Apri pratica</button></td>' +
            '</tr>'
          ).join('')
        : '<tr><td colspan="8">Nessuna pratica ricevuta.</td></tr>';
    }

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('.studio-open');
      if (!btn) return;
      await openPractice(btn.dataset.id);
    });

    async function openPractice(practiceId) {
      const user = await ensureAuth();
      if (!user) return;
      const { data: practice, error: practiceError } = await client.from('studio_pratiche').select('*').eq('id', practiceId).maybeSingle();
      if (practiceError || !practice) { alert('Pratica non trovata.'); return; }
      const { data: docs, error: docsError } = await client.from('studio_documenti').select('id,file_name,storage_path,mime_type,size_bytes,created_at').eq('pratica_id', practiceId).order('created_at', { ascending: true });
      if (docsError) { alert('Impossibile caricare gli allegati: ' + docsError.message); return; }
      const detail = document.createElement('div');
      detail.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
      detail.innerHTML = '<div style="width:min(900px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:14px;padding:24px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">📁 Pratica · '+esc(practice.client_name)+'</h2><button class="btn" id="closePractice" type="button">Chiudi</button></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px">' +
        '<div><strong>Cliente</strong><br>'+esc(practice.client_name)+'</div><div><strong>Codice fiscale / P.IVA</strong><br>'+esc(practice.tax_id)+'</div>' +
        '<div><strong>Area legale</strong><br>'+esc(practice.legal_area)+'</div><div><strong>Controparte</strong><br>'+esc(practice.counterparty)+'</div>' +
        '<div><strong>Stato</strong><br>'+esc(practice.status)+'</div><div><strong>AI</strong><br>'+esc(practice.ai_status || 'non avviata')+'</div></div>' +
        '<div style="margin-top:18px"><strong>Esposizione dei fatti / richiesta</strong><div style="margin-top:7px;padding:12px;background:#f8fafc;border-radius:8px;white-space:pre-wrap">'+esc(practice.description)+'</div></div>' +
        '<div style="margin-top:18px"><strong>📎 Allegati</strong><div id="practiceDocs" style="margin-top:8px"></div></div></div>';
      document.body.appendChild(detail);
      detail.querySelector('#closePractice').onclick=()=>detail.remove();
      const docsBox=detail.querySelector('#practiceDocs');
      if(!docs || !docs.length){docsBox.innerHTML='<div style="color:#64748b">Nessun allegato.</div>';return;}
      docsBox.innerHTML=docs.map(d=>'<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #e2e8f0"><div><strong>'+esc(d.file_name)+'</strong><br><small style="color:#64748b">'+esc(d.mime_type||'')+' · '+Math.round(Number(d.size_bytes||0)/1024)+' KB</small></div><button class="btn btn-info doc-open" type="button" data-path="'+esc(d.storage_path)+'">Apri allegato</button></div>').join('');
      docsBox.querySelectorAll('.doc-open').forEach(btn=>btn.onclick=async()=>{
        btn.disabled=true;btn.textContent='Apertura…';
        const {data,error}=await client.storage.from('studio-legale-documenti').createSignedUrl(btn.dataset.path,300);
        btn.disabled=false;btn.textContent='Apri allegato';
        if(error||!data?.signedUrl){alert('Impossibile aprire il documento: '+(error?.message||'URL non disponibile'));return;}
        window.open(data.signedUrl,'_blank','noopener,noreferrer');
      });
    }

    document.getElementById('studioLoginForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('studioLoginEmail').value.trim();
      const password = document.getElementById('studioLoginPassword').value;
      const errorBox = document.getElementById('studioLoginError');
      const button = document.getElementById('studioLoginSubmit');

      errorBox.textContent = '';
      button.disabled = true;
      button.textContent = 'Accesso in corso…';

      const { data: authData, error } = await client.auth.signInWithPassword({ email, password });

      button.disabled = false;
      button.textContent = 'Accedi';

      if (error) {
        errorBox.textContent = 'Accesso non riuscito: ' + (error?.message || error?.name || 'errore autenticazione');
        console.error(error);
        return;
      }

      const authorizedUser = await getAuthorizedStudioUser(authData?.user);
      if (!authorizedUser) {
        await client.auth.signOut();
        studioAccessGranted = false;
        errorBox.textContent = 'Accesso negato: questo account è abilitato come Cliente e non può entrare nell’Area Studio.';
        return;
      }

      studioAccessGranted = true;
      hideLogin();
      await loadPractices();
    });

    document.getElementById('studioRefresh').addEventListener('click', loadPractices);

    document.getElementById('studioLogout').addEventListener('click', async () => {
      await client.auth.signOut();
      studioAccessGranted = false;
      status.textContent = 'Sessione chiusa.';
      showLogin();
      body.innerHTML = '<tr><td colspan="8">Effettua nuovamente l’accesso per visualizzare le pratiche.</td></tr>';
    });

    item.addEventListener('click', async (e) => {
      e.preventDefault();
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
      item.classList.add('active');
      panel.classList.add('active');
      const title = document.getElementById('headerTitle');
      if (title) title.innerText = 'Pratiche ricevute dal Portale Clienti';
      await loadPractices();
    });

    // Il login deve essere sempre visibile all'apertura della pagina.
    // Non usiamo una sessione locale già presente per saltare il gate:
    // l'accesso viene verificato esplicitamente con email e password.
    studioAccessGranted = false;
    showLogin();

    client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        studioAccessGranted = false;
        showLogin();
      }
      if (!session && panel.classList.contains('active')) {
        status.textContent = 'Sessione chiusa.';
        body.innerHTML = '<tr><td colspan="8">Effettua nuovamente l’accesso per visualizzare le pratiche.</td></tr>';
      }
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();