(() => {
  const init = async () => {
    if (!window.supabase || !window.STUDIO_SUPABASE_URL || !window.STUDIO_SUPABASE_PUBLISHABLE_KEY) {
      console.error('Configurazione Supabase non disponibile.');
      return;
    }

    const client = window.supabase.createClient(
      window.STUDIO_SUPABASE_URL,
      window.STUDIO_SUPABASE_PUBLISHABLE_KEY
    );

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
              </tr>
            </thead>
            <tbody id="studioPracticesBody">
              <tr><td colspan="7">Accesso richiesto.</td></tr>
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
    loginModal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;align-items:center;justify-content:center;padding:20px;';
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

    function showLogin() {
      document.getElementById('studioLoginError').textContent = '';
      document.getElementById('studioLoginPassword').value = '';
      loginModal.style.display = 'flex';
      setTimeout(() => document.getElementById('studioLoginEmail').focus(), 50);
    }

    function hideLogin() {
      loginModal.style.display = 'none';
    }

    async function ensureAuth() {
      const { data: { user }, error } = await client.auth.getUser();
      if (error) {
        console.error(error);
        return false;
      }
      if (user) return user;
      showLogin();
      return null;
    }

    async function loadPractices() {
      body.innerHTML = '<tr><td colspan="7">Caricamento…</td></tr>';

      const user = await ensureAuth();
      if (!user) {
        status.textContent = 'Accesso richiesto.';
        body.innerHTML = '<tr><td colspan="7">Effettua l’accesso per visualizzare le pratiche.</td></tr>';
        return;
      }

      const { data, error } = await client
        .from('studio_pratiche')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        status.textContent = 'Errore nel caricamento delle pratiche.';
        body.innerHTML = '<tr><td colspan="7">Impossibile caricare le pratiche.</td></tr>';
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
            '</tr>'
          ).join('')
        : '<tr><td colspan="7">Nessuna pratica ricevuta.</td></tr>';
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

      const { error } = await client.auth.signInWithPassword({ email, password });

      button.disabled = false;
      button.textContent = 'Accedi';

      if (error) {
        errorBox.textContent = 'Accesso non riuscito. Verifica email e password.';
        console.error(error);
        return;
      }

      hideLogin();
      await loadPractices();
    });

    document.getElementById('studioRefresh').addEventListener('click', loadPractices);

    document.getElementById('studioLogout').addEventListener('click', async () => {
      await client.auth.signOut();
      status.textContent = 'Sessione chiusa.';
      body.innerHTML = '<tr><td colspan="7">Effettua nuovamente l’accesso per visualizzare le pratiche.</td></tr>';
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

    client.auth.onAuthStateChange((_event, session) => {
      if (!session && panel.classList.contains('active')) {
        status.textContent = 'Sessione chiusa.';
        body.innerHTML = '<tr><td colspan="7">Effettua nuovamente l’accesso per visualizzare le pratiche.</td></tr>';
      }
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();