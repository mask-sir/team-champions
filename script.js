
const ADMIN_PASSWORD_KEY = 'tcwc_admin_pw';
const DATA_KEY = 'tcwc_data';
const HISTORY_KEY = 'tcwc_history';

const FLAGS = { ARGENTINA: '&#127462;&#127479;', PORTUGAL: '&#127477;&#127481;', BRAZIL: '&#127463;&#127479;', SPAIN: '&#127466;&#127480;' };
const TEAM_ORDER = ['ARGENTINA','PORTUGAL','BRAZIL','SPAIN'];

function getDefaultData() {
  return {
    date: new Date().toISOString().split('T')[0],
    players: [
      {name:'Saidali A P',team:'ARGENTINA',working:true,vol:2},
      {name:'Najmal K',team:'ARGENTINA',working:true,vol:5},
      {name:'Muhammed Sinan M T',team:'ARGENTINA',working:true,vol:2},
      {name:'Ruvaishid T',team:'ARGENTINA',working:true,vol:2},
      {name:'Ummer Suhail M',team:'ARGENTINA',working:true,vol:1},
      {name:'Abdul Jaleel',team:'PORTUGAL',working:true,vol:7},
      {name:'Shijil Mon P',team:'PORTUGAL',working:true,vol:1},
      {name:'Muhammed Ramees C',team:'PORTUGAL',working:true,vol:0},
      {name:'Abhinand T',team:'BRAZIL',working:true,vol:2},
      {name:'Ashik Rahman',team:'BRAZIL',working:true,vol:1},
      {name:'Abdul Mujeeb',team:'BRAZIL',working:true,vol:1},
      {name:'Abdul Noushad V',team:'BRAZIL',working:true,vol:2},
      {name:'Muhammed Shahid K',team:'SPAIN',working:true,vol:0},
    ]
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? JSON.parse(raw) : getDefaultData();
  } catch(e) { return getDefaultData(); }
}

function saveData(d) {
  localStorage.setItem(DATA_KEY, JSON.stringify(d));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveHistory(h) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

function getTeamScore(players, team) {
  const members = players.filter(p => p.team === team && p.working);
  if (!members.length) return 0;
  const total = members.reduce((s, p) => s + (p.vol || 0), 0);
  return total / members.length;
}

function getTeamTotal(players, team) {
  return players.filter(p => p.team === team).reduce((s, p) => s + (p.vol || 0), 0);
}

function getWorkingCount(players, team) {
  return players.filter(p => p.team === team && p.working).length;
}

function renderStandings() {
  const data = loadData();
  const teams = TEAM_ORDER.map(t => ({
    team: t,
    score: getTeamScore(data.players, t),
    total: getTeamTotal(data.players, t),
    working: getWorkingCount(data.players, t),
    members: data.players.filter(p => p.team === t)
  })).sort((a, b) => b.score - a.score);

  const snap = document.getElementById('snap-date-label');
  if (snap) snap.textContent = 'Date: ' + (data.date || today());

  const grid = document.getElementById('team-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const maxScore = teams[0].score || 1;
  teams.forEach((t, i) => {
    const card = document.createElement('div');
    card.className = 'team-card' + (i === 0 ? ' rank-1' : '');
    const pct = Math.round((t.score / maxScore) * 100);
    card.innerHTML = `
      <div class="rank-badge">${i+1}</div>
      <div class="flag">${FLAGS[t.team] || ''}</div>
      <div class="team-name">${t.team}</div>
      <div class="score-big">${t.score.toFixed(2)}</div>
      <div class="score-label">avg vol/working member &nbsp; <span class="stat-pill">&#128200; Total: ${t.total}</span></div>
      <div class="prog-wrap">
        <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
        <div class="prog-label"><span>${t.working} working</span><span>${t.members.length} total</span></div>
      </div>
      <div class="members">
        ${t.members.map(p => `
          <div class="member-row">
            <span class="name">${p.working ? '<span class="working-dot"></span>' : ''}${p.name}</span>
            <span class="vol">FTD: <span>${p.vol}</span></span>
          </div>`).join('')}
      </div>`;
    grid.appendChild(card);
  });

  document.getElementById('standings-date').textContent = 'Date: ' + (data.date || today());
}

function renderDaily() {
  const data = loadData();
  const sorted = [...data.players].sort((a, b) => (b.vol||0) - (a.vol||0));
  const tbody = document.getElementById('daily-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  sorted.forEach((p, i) => {
    const tr = document.createElement('tr');
    if (i === 0) tr.className = 'rank-1-row';
    tr.innerHTML = `
      <td class="rank-col">${i+1}</td>
      <td>${p.name}</td>
      <td>${FLAGS[p.team]||''} ${p.team}</td>
      <td>${p.working ? '<span style="color:var(--accent)">Yes</span>' : '<span style="color:var(--muted)">No</span>'}</td>
      <td>${p.vol}</td>
      <td class="pts">${p.working ? p.vol.toFixed(1) : '-'}</td>`;
    tbody.appendChild(tr);
  });
}

function renderMonthly() {
  const data = loadData();
  const history = loadHistory();
  const allDays = [data, ...history];

  const playerMap = {};
  data.players.forEach(p => {
    playerMap[p.name] = { name: p.name, team: p.team, days: 0, total: 0 };
  });
  allDays.forEach(day => {
    day.players.forEach(p => {
      if (!playerMap[p.name]) playerMap[p.name] = { name: p.name, team: p.team, days: 0, total: 0 };
      if (p.working) {
        playerMap[p.name].days++;
        playerMap[p.name].total += (p.vol || 0);
      }
    });
  });

  const sorted = Object.values(playerMap).sort((a, b) => b.total - a.total);
  const totalVol = sorted.reduce((s, p) => s + p.total, 0);
  const topPlayer = sorted[0] || {};
  const activeDays = allDays.length;

  const statCards = document.getElementById('monthly-stat-cards');
  if (statCards) {
    statCards.innerHTML = `
      <div class="card card-sm"><h3>Total volume</h3><div style="font-family:var(--font-display);font-size:28px;color:var(--gold)">${totalVol}</div></div>
      <div class="card card-sm"><h3>Days recorded</h3><div style="font-family:var(--font-display);font-size:28px;color:var(--gold)">${activeDays}</div></div>
      <div class="card card-sm"><h3>Top scorer</h3><div style="font-family:var(--font-display);font-size:18px;color:var(--gold)">${topPlayer.name||'-'}</div><div style="font-size:12px;color:var(--muted)">${topPlayer.total||0} vol</div></div>
      <div class="card card-sm"><h3>Active players</h3><div style="font-family:var(--font-display);font-size:28px;color:var(--gold)">${sorted.filter(p=>p.days>0).length}</div></div>
    `;
  }

  const tbody = document.getElementById('monthly-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  sorted.forEach((p, i) => {
    const avg = p.days ? (p.total / p.days).toFixed(2) : 0;
    const tr = document.createElement('tr');
    if (i === 0) tr.className = 'rank-1-row';
    tr.innerHTML = `
      <td class="rank-col">${i+1}</td>
      <td>${p.name}</td>
      <td>${FLAGS[p.team]||''} ${p.team}</td>
      <td>${p.days}</td>
      <td>${p.total}</td>
      <td class="pts">${avg}</td>`;
    tbody.appendChild(tr);
  });
}

function renderMOTM() {
  const data = loadData();
  const working = data.players.filter(p => p.working).sort((a, b) => (b.vol||0) - (a.vol||0));
  const top = working[0];
  const wrap = document.getElementById('motm-card-wrap');
  if (!wrap || !top) return;

  const initials = top.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  wrap.innerHTML = `
    <div class="motm-card">
      <div style="font-size:12px;color:var(--gold);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">&#11088; Man of the match</div>
      <div class="motm-avatar">${initials}</div>
      <div class="motm-name">${top.name}</div>
      <div class="motm-team">${FLAGS[top.team]||''} ${top.team}</div>
      <div class="star-row">${'<span class="star">&#9733;</span>'.repeat(5)}</div>
      <div class="motm-vol">${top.vol}</div>
      <div class="motm-vol-label">FTD volume today</div>
    </div>`;

  const tbody = document.getElementById('motm-top5-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  working.slice(0, 5).forEach((p, i) => {
    const tr = document.createElement('tr');
    if (i === 0) tr.className = 'rank-1-row';
    tr.innerHTML = `<td class="rank-col">${i+1}</td><td>${p.name}</td><td>${FLAGS[p.team]||''} ${p.team}</td><td class="pts">${p.vol}</td>`;
    tbody.appendChild(tr);
  });
}

function renderPerformers() {
  const data = loadData();
  const history = loadHistory();
  const allDays = [data, ...history];
  const playerMap = {};
  data.players.forEach(p => { playerMap[p.name] = { name: p.name, team: p.team, days: 0, total: 0 }; });
  allDays.forEach(day => {
    day.players.forEach(p => {
      if (!playerMap[p.name]) playerMap[p.name] = { name: p.name, team: p.team, days: 0, total: 0 };
      if (p.working) { playerMap[p.name].days++; playerMap[p.name].total += (p.vol || 0); }
    });
  });

  const sorted = Object.values(playerMap).sort((a, b) => b.total - a.total).slice(0, 6);
  const maxVol = sorted[0]?.total || 1;
  const grid = document.getElementById('performers-grid');
  if (!grid) return;
  grid.innerHTML = '';

  sorted.forEach((p, i) => {
    const pct = Math.round((p.total / maxVol) * 100);
    const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--pitch-light);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:16px;color:var(--gold);">${initials}</div>
        <div>
          <div style="font-weight:500;font-size:14px;">${p.name}</div>
          <div style="font-size:11px;color:var(--muted);">${FLAGS[p.team]||''} ${p.team}</div>
        </div>
        ${i === 0 ? '<span style="margin-left:auto;font-size:18px;">&#127942;</span>' : ''}
      </div>
      <div style="font-family:var(--font-display);font-size:28px;color:var(--gold);">${p.total}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">Total FTD vol &nbsp;·&nbsp; ${p.days} days</div>
      <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>`;
    grid.appendChild(div);
  });
}

function renderHistory() {
  const data = loadData();
  const history = loadHistory();
  const all = [data, ...history];
  const list = document.getElementById('history-list');
  if (!list) return;
  list.innerHTML = '';

  if (all.length === 0) {
    list.innerHTML = '<div style="color:var(--muted);font-size:14px;padding:20px 0;">No history yet. Scores will appear here as you update daily data.</div>';
    return;
  }

  all.forEach(day => {
    const entry = document.createElement('div');
    entry.className = 'history-entry';
    const scores = TEAM_ORDER.map(t => ({
      team: t,
      score: getTeamScore(day.players || [], t),
      total: getTeamTotal(day.players || [], t)
    })).sort((a, b) => b.score - a.score);

    entry.innerHTML = `
      <div class="h-date">&#128197; ${day.date || '—'}</div>
      <div class="h-scores">
        ${scores.map((s, i) => `
          <div class="h-score-item">
            <div class="h-flag">${FLAGS[s.team]||''} ${i === 0 ? '&#127942;' : ''}</div>
            <div class="h-val">${s.score.toFixed(2)}</div>
            <div class="h-team">${s.team}</div>
          </div>`).join('')}
      </div>`;
    list.appendChild(entry);
  });
}

function nav(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('sec-' + section);
  if (sec) sec.classList.add('active');
  event.currentTarget.classList.add('active');

  if (section === 'standings') renderStandings();
  if (section === 'daily') renderDaily();
  if (section === 'monthly') renderMonthly();
  if (section === 'motm') renderMOTM();
  if (section === 'performers') renderPerformers();
  if (section === 'history') renderHistory();

  if (window.innerWidth < 640) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function today() { return new Date().toISOString().split('T')[0]; }

function openAdmin() {
  document.getElementById('admin-overlay').classList.add('open');
  document.getElementById('admin-pin-screen').style.display = 'block';
  document.getElementById('admin-content').style.display = 'none';
  document.getElementById('pin-error').textContent = '';
  document.getElementById('pin-input').value = '';
  setTimeout(() => document.getElementById('pin-input').focus(), 100);
}

function closeAdmin() {
  document.getElementById('admin-overlay').classList.remove('open');
}

function checkPin() {
  const pw = localStorage.getItem(ADMIN_PASSWORD_KEY) || 'admin123';
  const entered = document.getElementById('pin-input').value;
  if (entered === pw) {
    document.getElementById('admin-pin-screen').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
    renderAdminScores();
    renderAdminPlayers();
    const dateInput = document.getElementById('admin-date');
    if (dateInput) dateInput.value = loadData().date || today();
  } else {
    document.getElementById('pin-error').textContent = 'Wrong password. Try again.';
    document.getElementById('pin-input').value = '';
  }
}

function adminTab(tab) {
  ['scores','players','settings'].forEach(t => {
    const el = document.getElementById('admin-' + t + '-tab');
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', ['scores','players','settings'][i] === tab);
  });
}

function renderAdminScores() {
  const data = loadData();
  const tbody = document.getElementById('admin-score-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  data.players.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${FLAGS[p.team]||''} ${p.team}</td>
      <td><select data-i="${i}" class="working-sel">
        <option value="1" ${p.working?'selected':''}>Yes</option>
        <option value="0" ${!p.working?'selected':''}>No</option>
      </select></td>
      <td><input type="number" min="0" data-i="${i}" class="vol-input" value="${p.vol||0}"></td>`;
    tbody.appendChild(tr);
  });
}

function renderAdminPlayers() {
  const data = loadData();
  const tbody = document.getElementById('players-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  data.players.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${FLAGS[p.team]||''} ${p.team}</td>
      <td><button onclick="removePlayer(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;">&#10005; Remove</button></td>`;
    tbody.appendChild(tr);
  });
}

function saveScores() {
  const data = loadData();
  const history = loadHistory();
  const dateInput = document.getElementById('admin-date');
  const newDate = dateInput ? dateInput.value : today();

  if (data.date && data.date !== newDate) {
    history.unshift({ date: data.date, players: JSON.parse(JSON.stringify(data.players)) });
    if (history.length > 90) history.pop();
    saveHistory(history);
  }

  document.querySelectorAll('.working-sel').forEach(sel => {
    const i = parseInt(sel.dataset.i);
    data.players[i].working = sel.value === '1';
  });
  document.querySelectorAll('.vol-input').forEach(inp => {
    const i = parseInt(inp.dataset.i);
    data.players[i].vol = parseInt(inp.value) || 0;
  });
  data.date = newDate;
  saveData(data);
  showToast('Scores saved!');
  closeAdmin();
  renderStandings();
}

function addPlayer() {
  const name = document.getElementById('new-player-name').value.trim();
  const team = document.getElementById('new-player-team').value;
  if (!name) return;
  const data = loadData();
  data.players.push({ name, team, working: true, vol: 0 });
  saveData(data);
  document.getElementById('new-player-name').value = '';
  renderAdminPlayers();
  renderAdminScores();
  showToast('Player added!');
}

function removePlayer(i) {
  const data = loadData();
  data.players.splice(i, 1);
  saveData(data);
  renderAdminPlayers();
  renderAdminScores();
  showToast('Player removed');
}

function changePassword() {
  const pw = document.getElementById('new-password').value;
  if (pw.length < 4) { showToast('Min 4 characters'); return; }
  localStorage.setItem(ADMIN_PASSWORD_KEY, pw);
  document.getElementById('new-password').value = '';
  showToast('Password updated!');
}

function saveSheetConfig() {
  const key = document.getElementById('sheets-api-key').value.trim();
  localStorage.setItem('tcwc_sheets_key', key);
  showToast('Config saved — see setup guide below');
}

function resetMonth() {
  if (!confirm('Reset all monthly history? This cannot be undone.')) return;
  localStorage.removeItem(HISTORY_KEY);
  showToast('Monthly data reset');
  closeAdmin();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 2500);
}

function downloadSnapshot() {
  const target = document.getElementById('snapshot-target');
  html2canvas(target, { backgroundColor: '#0f1f16', scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = 'standings-' + (loadData().date || today()) + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Image downloaded!');
  });
}

function downloadSection(sectionId) {
  const target = document.getElementById(sectionId);
  html2canvas(target, { backgroundColor: '#0f1f16', scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = sectionId + '-' + today() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Image downloaded!');
  });
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function init() {
  const now = new Date();
  const opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  document.getElementById('side-date').textContent = now.toLocaleDateString('en-IN', opts);
  document.getElementById('side-month').textContent = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  renderStandings();
}

init();