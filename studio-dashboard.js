(() => {
  const showStartupError = (message) => {
    document.body.classList.add('studio-auth-pending');
    let overlay = document.getElementById('studioStartupError');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'studioStartupError';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.94);color:#0f172a;font-family:Segoe UI,Tahoma,sans-serif';
      overlay.innerHTML = '<div style="width:min(520px,100%);padding:28px;border-radius:18px;background:#fff;box-shadow:0 24px 80px #0006"><h2 style="margin:0 0 12px">Area Studio non disponibile</h2><p id="studioStartupErrorMessage" style="line-height:1.55"></p><p style="margin-top:14px;font-size:13px;color:#475569">La pagina non è stata aperta per proteggere i dati riservati. Ricarica la pagina; se il problema persiste, serve correggere il caricamento tecnico.</p><button type="button" onclick="location.reload()" style="margin-top:18px;padding:10px 16px;border:0;border-radius:8px;background:#1e293b;color:#fff;cursor:pointer">Riprova</button></div>';
      document.body.appendChild(overlay);
    }
    document.getElementById('studioStartupErrorMessage').textContent = message;
  };

  const init = async () => {
    if (!window.supabase || !window.STUDIO_SUPABASE_URL || !window.STUDIO_SUPABASE_PUBLISHABLE_KEY) {
      console.error('Configurazione Supabase non disponibile.');
      showStartupError('Configurazione Supabase non caricata. Nessun dato dello Studio è stato mostrato.');
      return;
    }

    let client = window.getStudioSupabaseClient ? window.getStudioSupabaseClient() : window.STUDIO_SUPABASE_CLIENT;
    if (!client && window.studioSupabaseReady) {
      try { client = await window.studioSupabaseReady; } catch (error) {
        console.error('[Studio Auth] Impossibile inizializzare il client Supabase Studio.', error);
        showStartupError('Il servizio di accesso non è stato inizializzato. Dettaglio: ' + (error?.message || 'errore non specificato'));
        return;
      }
    }
    if (!client) {
      console.error('[Studio Auth] Client Supabase Studio non disponibile.');
      showStartupError('Il client di accesso non è disponibile. Nessun dato dello Studio è stato mostrato.');
      return;
    }

    // Gate di sicurezza anticipato: la dashboard resta nascosta finché l'utente non è autenticato e autorizzato.
    {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) {
        location.replace('studio.html?logout='+Date.now());
        return;
      }
      const { data: profile, error: roleError } = await client
        .from('studio_utenti')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (roleError || !['studio','admin'].includes(profile?.role)) {
        await client.auth.signOut({scope:'local'});
        location.replace('studio.html');
        return;
      }
      document.body.classList.remove('studio-auth-pending');
    }

    const menu = document.querySelector('.sidebar-menu');
    const contentArea = document.querySelector('.content-area');
    if (!menu || !contentArea || document.getElementById('panel-studio-pratiche')) return;

    const item = document.createElement('a');
    item.className = 'menu-item';
    item.innerHTML = '<span class="menu-photo menu-photo--pratiche"><img src="https://cdn.jsdelivr.net/npm/@tabler/icons@3.34.0/icons/outline/inbox.svg" alt="" aria-hidden="true"></span><span>Pratiche ricevute</span>';
    item.href = '#';

    const panel = document.createElement('div');
    panel.id = 'panel-studio-pratiche';
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <h3 style="margin:0">📥 Pratiche ricevute dal Portale Clienti</h3>
          <div style="display:flex;gap:8px;align-items:center"><button class="btn btn-info" id="studioPracticesHelp" type="button">❓ HELP</button>
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
    const clientPortalItem = menu.querySelector('[onclick*="switchTab(\'client-portal\'"]');
    if (clientPortalItem) clientPortalItem.insertAdjacentElement('afterend', item);
    else menu.appendChild(item);

    document.getElementById('studioPracticesHelp')?.addEventListener('click',()=>window.openStudioHelp&&window.openStudioHelp('studio-pratiche'));

    const body = document.getElementById('studioPracticesBody');
    const status = document.getElementById('studioAuthStatus');
    function esc(v) {
      return String(v ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[c]));
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

      if (!data || !['studio','admin'].includes(data.role)) return null;
      return user;
    }

    async function ensureAuth() {
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) {
        location.replace('studio.html');
        return null;
      }
      const authorizedUser = await getAuthorizedStudioUser(user);
      if (!authorizedUser) {
        await client.auth.signOut({scope:'local'});
        location.replace('studio.html');
        return null;
      }
      document.body.classList.remove('studio-auth-pending');
      return authorizedUser;
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
            '<td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-info studio-open" type="button" data-id="' + esc(p.id) + '">Apri pratica</button><button class="btn btn-danger studio-delete" type="button" data-id="' + esc(p.id) + '">Elimina</button></div></td>' +
            '</tr>'
          ).join('')
        : '<tr><td colspan="8">Nessuna pratica ricevuta.</td></tr>';
    }

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('.studio-open');
      if (btn) {
        await openPractice(btn.dataset.id);
        return;
      }
      const del = e.target.closest('.studio-delete');
      if (!del) return;
      const practiceId = del.dataset.id;
      if (!confirm('Eliminare definitivamente questa pratica e tutti i dati collegati?')) return;
      del.disabled = true;
      del.textContent = 'Eliminazione…';
      try {
        const { data: docs, error: docsError } = await client
          .from('studio_documenti')
          .select('storage_path')
          .eq('pratica_id', practiceId);
        if (docsError) throw docsError;
        const { data: portalDocs, error: portalDocsError } = await client
          .from('studio_portale_documenti')
          .select('storage_path')
          .eq('pratica_id', practiceId);
        if (portalDocsError) throw portalDocsError;
        const paths = [...(docs || []), ...(portalDocs || [])]
          .map(x => x.storage_path)
          .filter(Boolean);
        if (paths.length) {
          const { error: storageError } = await client.storage
            .from('studio-legale-documenti')
            .remove(paths);
          if (storageError) throw storageError;
        }
        const { error: deleteError } = await client
          .from('studio_pratiche')
          .delete()
          .eq('id', practiceId);
        if (deleteError) throw deleteError;
        await loadPractices();
      } catch (err) {
        del.disabled = false;
        del.textContent = 'Elimina';
        alert('Eliminazione pratica non riuscita: ' + (err?.message || err));
      }
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

    document.getElementById('studioRefresh').addEventListener('click', loadPractices);

    document.getElementById('studioLogout').addEventListener('click', async () => {
      await client.auth.signOut({scope:'local'});
      location.replace('studio.html');
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

    const initialUser = await ensureAuth();
    if (initialUser) {
      await loadPractices();
    }

  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();