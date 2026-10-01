(() => {
  const init = async () => {
    if (!window.supabase || !window.STUDIO_SUPABASE_URL || !window.STUDIO_SUPABASE_PUBLISHABLE_KEY) {
      console.error('Configurazione Supabase non disponibile.');
      return;
    }
    const client = window.supabase.createClient(window.STUDIO_SUPABASE_URL, window.STUDIO_SUPABASE_PUBLISHABLE_KEY);
    const menu = document.querySelector('.sidebar-menu');
    if (!menu || document.getElementById('panel-studio-pratiche')) return;

    const item = document.createElement('a');
    item.className = 'menu-item';
    item.innerHTML = '📥 <span>Pratiche ricevute</span>';
    item.href = '#';
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
    menu.appendChild(item);

    const panel = document.createElement('div');
    panel.id = 'panel-studio-pratiche';
    panel.className = 'panel';
    panel.innerHTML = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3>📥 Pratiche ricevute dal Portale Clienti</h3><button class="btn btn-info" id="studioRefresh">Aggiorna</button></div><div id="studioAuthStatus" style="margin-top:10px;font-size:12px;color:#64748b"></div><div style="overflow-x:auto"><table><thead><tr><th>Ricezione</th><th>Cliente</th><th>Area</th><th>Controparte</th><th>Richiesta</th><th>Allegati</th><th>Stato</th></tr></thead><tbody id="studioPracticesBody"><tr><td colspan="7">Seleziona “Pratiche ricevute” per caricare i dati.</td></tr></tbody></table></div></div>';
    document.querySelector('.content-area').appendChild(panel);
    document.getElementById('studioRefresh').addEventListener('click', loadPractices);

    function esc(v) {
      return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    async function ensureAuth() {
      const { data } = await client.auth.getSession();
      if (data.session) return true;
      const email = prompt('Accesso Studio Legale Silella\nEmail:');
      if (!email) return false;
      const password = prompt('Password:');
      if (!password) return false;
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        alert('Accesso non riuscito: ' + error.message);
        return false;
      }
      return true;
    }

    async function loadPractices() {
      const body = document.getElementById('studioPracticesBody');
      const status = document.getElementById('studioAuthStatus');
      body.innerHTML = '<tr><td colspan="7">Caricamento…</td></tr>';
      if (!(await ensureAuth())) {
        status.textContent = 'Accesso richiesto.';
        body.innerHTML = '<tr><td colspan="7">Nessuna sessione autenticata.</td></tr>';
        return;
      }
      const { data, error } = await client.from('studio_pratiche').select('*').order('created_at', { ascending: false });
      if (error) {
        status.textContent = 'Errore: ' + error.message;
        body.innerHTML = '<tr><td colspan="7">Impossibile caricare le pratiche.</td></tr>';
        console.error(error);
        return;
      }
      status.textContent = 'Accesso autenticato · ' + data.length + ' pratiche';
      body.innerHTML = data.length
        ? data.map(p => '<tr><td>' + esc(new Date(p.created_at).toLocaleString('it-IT')) + '</td><td><strong>' + esc(p.client_name) + '</strong><br><small>' + esc(p.tax_id) + '</small></td><td>' + esc(p.legal_area) + '</td><td>' + esc(p.counterparty) + '</td><td style="min-width:260px">' + esc(p.description) + '</td><td>' + esc(p.file_names || 'Nessuno') + '</td><td><span class="badge-status status-sent">' + esc(p.status) + '</span></td></tr>').join('')
        : '<tr><td colspan="7">Nessuna pratica ricevuta.</td></tr>';
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();