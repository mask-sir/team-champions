/* ─────────────────────────────────────────────────────────────
   Team Champions World Cup — script.js
   Data source: Google Sheets (published CSV, no API key needed)
   All admin & Sheet API key logic removed.
───────────────────────────────────────────────────────────── */

// ── Published CSV URLs (no API key required) ──────────────────
const PLAYERS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSYUWCc26thkqu-YY0ZM5a7BkRPBMt1-lXupWx8QocSnjSBPqnC3Mg7k48U1VfD19MCRm8D7Pg5dm_p/pub?gid=0&single=true&output=csv";
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSYUWCc26thkqu-YY0ZM5a7BkRPBMt1-lXupWx8QocSnjSBPqnC3Mg7k48U1VfD19MCRm8D7Pg5dm_p/pub?gid=771581313&single=true&output=csv";

// ── Constants ─────────────────────────────────────────────────
const FLAGS = {
  ARGENTINA: '&#127462;&#127479;',
  PORTUGAL:  '&#127477;&#127481;',
  BRAZIL:    '&#127463;&#127479;',
  SPAIN:     '&#127466;&#127480;'
};
const TEAM_ORDER = ['ARGENTINA', 'PORTUGAL', 'BRAZIL', 'SPAIN'];

// ── State ─────────────────────────────────────────────────────
let selectedDate = null;   // currently viewed date (dd/mm/yyyy string from sheet)
let allEntryLines = [];    // raw CSV rows (minus header) cached after fetch
let allPlayers = {};       // master player list from Players sheet
let allDates = [];         // sorted unique dates from entries sheet

// ── Helpers ───────────────────────────────────────────────────
function today() {
  return new Date().toISOString().split('T')[0];
}

function parseDate(str) {
  // Handles both dd/mm/yyyy and yyyy-mm-dd
  if (!str) return null;
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return new Date(+y, +m - 1, +d);
  }
  return new Date(str);
}

function formatDateLabel(str) {
  const d = parseDate(str);
  if (!d || isNaN(d)) return str;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = 'none'; }, 2500);
}

// ── Data loading ──────────────────────────────────────────────
async function getLiveData() {
  const [playersRes, entriesRes] = await Promise.all([
    fetch(PLAYERS_URL),
    fetch(SHEET_URL)
  ]);

  const playersCsv = await playersRes.text();
  const entriesCsv = await entriesRes.text();

  // Parse players sheet (header: Name, Team)
  const playersLines = playersCsv.trim().split('\n');
  playersLines.shift(); // remove header
  allPlayers = {};
  playersLines.forEach(row => {
    const cols = row.split(',');
    const name = cols[0]?.trim();
    const team = cols[1]?.trim().toUpperCase();
    if (name) {
  allPlayers[name] = {
  name,
  team,
  photo: cols[2]?.trim() || '',
  working: false,
  vol: 0,
  timestamp: null
};
    }
  });

  // Parse entries sheet (header: Timestamp, Date, Player, Working, FTD Vol)
  allEntryLines = entriesCsv.trim().split('\n');
  allEntryLines.shift(); // remove header

  // Collect all unique dates and sort descending
  const dateSet = new Set();
  allEntryLines.forEach(row => {
    const d = row.split(',')[1]?.trim();
    if (d) dateSet.add(d);
  });

  allDates = [...dateSet].sort((a, b) => {
    const da = parseDate(a), db = parseDate(b);
    return db - da; // newest first
  });

  // Populate date selector
  const dateSelect = document.getElementById('date-select');
  if (dateSelect) {
    dateSelect.innerHTML = '';
    allDates.forEach(date => {
      const opt = document.createElement('option');
      opt.value = date;
      opt.textContent = formatDateLabel(date);
      dateSelect.appendChild(opt);
    });
  }

  // Restore saved date or use latest date
const savedDate = localStorage.getItem('selectedDate');

if (savedDate && allDates.includes(savedDate)) {
  selectedDate = savedDate;
} else if (!selectedDate && allDates.length > 0) {
  selectedDate = allDates[0];
}
  if (dateSelect && selectedDate) {
    dateSelect.value = selectedDate;
  }

  return buildPlayersForDate(selectedDate);
}

function buildPlayersForDate(date) {
  // Clone master player list
  const snapshot = {};
  Object.values(allPlayers).forEach(p => {
    snapshot[p.name] = { ...p, working: false, vol: 0, timestamp: null };
  });

  // Apply entries for the chosen date (keep latest timestamp per player)
  allEntryLines.forEach(row => {
    const cols = row.split(',');
    const timestamp  = cols[0]?.trim();
    const entryDate  = cols[1]?.trim();
    const playerName = cols[2]?.trim();
    const working    = cols[3]?.trim().toUpperCase() === 'YES';
    const vol        = Number(cols[4]) || 0;

    if (entryDate !== date) return;
    if (!snapshot[playerName]) return;

    const prev = snapshot[playerName].timestamp;
    if (!prev || new Date(timestamp) > new Date(prev)) {
      snapshot[playerName].timestamp = timestamp;
      snapshot[playerName].working   = working;
      snapshot[playerName].vol       = vol;
    }
  });

  return Object.values(snapshot);
}

function buildAllDaysData() {
  // Returns array of { date, players[] } for all available dates
  return allDates.map(date => ({
    date,
    players: buildPlayersForDate(date)
  }));
}

// ── Team score helpers ─────────────────────────────────────────
function getTeamScore(players, team) {
  const working = players.filter(p => p.team === team && p.working);
  if (!working.length) return 0;
  return working.reduce((s, p) => s + (p.vol || 0), 0) / working.length;
}

function getTeamTotal(players, team) {
  return players.filter(p => p.team === team && p.working)
    .reduce((s, p) => s + (p.vol || 0), 0);
}

function getWorkingCount(players, team) {
  return players.filter(p => p.team === team && p.working).length;
}

// ── RENDER: Standings ─────────────────────────────────────────
function renderStandings() {
  const players = buildPlayersForDate(selectedDate);

  const dateLabel = formatDateLabel(selectedDate) || '—';
  const standingsDate = document.getElementById('standings-date');
  if (standingsDate) standingsDate.textContent = 'Date: ' + dateLabel;
  const snapLabel = document.getElementById('snap-date-label');
  if (snapLabel) snapLabel.textContent = 'Date: ' + dateLabel;

  const teams = TEAM_ORDER.map(t => ({
    team: t,
    score:   getTeamScore(players, t),
    total:   getTeamTotal(players, t),
    working: getWorkingCount(players, t),
    members: players.filter(p => p.team === t)
  })).sort((a, b) => b.score - a.score);

  const grid = document.getElementById('team-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const maxScore = teams[0].score || 1;
  teams.forEach((t, i) => {
    const card = document.createElement('div');
    card.className = 'team-card' + (i === 0 ? ' rank-1' : '');
    const pct = Math.round((t.score / maxScore) * 100);
    card.innerHTML = `
      <div class="rank-badge">${i + 1}</div>
      <div class="flag">${FLAGS[t.team] || ''}</div>
      <div class="team-name">${t.team}</div>
      <div class="score-big">${t.score.toFixed(2)}</div>
      <div class="score-label">avg vol / working member &nbsp;
        <span class="stat-pill">&#128200; Total: ${t.total}</span>
      </div>
      <div class="prog-wrap">
        <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
        <div class="prog-label">
          <span>${t.working} working</span>
          <span>${t.members.length} total</span>
        </div>
      </div>
      <div class="members">
        ${t.members.map(p => `
          <div class="member-row">
            <span class="name">
              ${p.working ? '<span class="working-dot"></span>' : ''}${p.name}
            </span>
            <span class="vol">FTD: <span>${p.vol}</span></span>
          </div>`).join('')}
      </div>`;
    grid.appendChild(card);
  });
}

// ── RENDER: Daily Scoreboard ──────────────────────────────────
function renderDaily() {
  const players = buildPlayersForDate(selectedDate);
  const dateLabel = formatDateLabel(selectedDate) || '—';

  const lbl = document.getElementById('daily-date-label');
  if (lbl) lbl.textContent = 'Individual performance — ' + dateLabel;

  const sorted = [...players].sort((a, b) => (b.vol || 0) - (a.vol || 0));
  const tbody = document.getElementById('daily-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  sorted.forEach((p, i) => {
    const tr = document.createElement('tr');
    if (i === 0 && p.vol > 0) tr.className = 'rank-1-row';
    tr.innerHTML = `
      <td class="rank-col">${i + 1}</td>
      <td>${p.name}</td>
      <td>${FLAGS[p.team] || ''} ${p.team}</td>
      <td>${p.working
        ? '<span style="color:var(--accent)">&#9679; Yes</span>'
        : '<span style="color:var(--muted)">No</span>'}</td>
      <td>${p.vol}</td>
      <td class="pts">${p.working ? p.vol.toFixed(1) : '—'}</td>`;
    tbody.appendChild(tr);
  });
}

// ── RENDER: Monthly Scoreboard ────────────────────────────────
function renderMonthly() {
  const allDaysData = buildAllDaysData();

  const monthlyView =
  document.getElementById('monthly-view')?.value || 'players';

  // Aggregate across all days
  const playerMap = {};
  Object.values(allPlayers).forEach(p => {
    playerMap[p.name] = { name: p.name, team: p.team, days: 0, total: 0 };
  });

  allDaysData.forEach(day => {
    day.players.forEach(p => {
      if (!playerMap[p.name]) {
        playerMap[p.name] = { name: p.name, team: p.team, days: 0, total: 0 };
      }
      if (p.working) {
        playerMap[p.name].days++;
        playerMap[p.name].total += (p.vol || 0);
      }
    });
  });

  const sorted = Object.values(playerMap).sort((a, b) => b.total - a.total);
  const totalVol    = sorted.reduce((s, p) => s + p.total, 0);
  const topPlayer   = sorted[0] || {};
 const activeDays = allDaysData.length;
  const activePlayers = sorted.filter(p => p.days > 0).length;

  // Stat cards
  const statCards = document.getElementById('monthly-stat-cards');
  if (statCards) {
    statCards.innerHTML = `
      <div class="card card-sm">
        <h3>Total Volume</h3>
        <div style="font-family:var(--font-display);font-size:28px;color:var(--gold)">${totalVol}</div>
      </div>
      <div class="card card-sm">
        <h3>Days Recorded</h3>
        <div style="font-family:var(--font-display);font-size:28px;color:var(--gold)">${allDaysData.length}</div>
      </div>
      <div class="card card-sm">
        <h3>Top Scorer</h3>
        <div style="font-family:var(--font-display);font-size:18px;color:var(--gold);line-height:1.2;">${topPlayer.name || '—'}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">${topPlayer.total || 0} vol</div>
      </div>
      <div class="card card-sm">
        <h3>Active Players</h3>
        <div style="font-family:var(--font-display);font-size:28px;color:var(--gold)">${activePlayers}</div>
      </div>`;
  }

  // Monthly label
  const lbl = document.getElementById('monthly-label');
  if (lbl) {
    const now = new Date();
    lbl.textContent = 'Cumulative rankings — ' +
      now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  // Table
 const headerRow =
  document.querySelector('#monthly-table thead tr');

const tbody = document.getElementById('monthly-tbody');
if (!tbody) return;

tbody.innerHTML = '';

if (monthlyView === 'players') {

  headerRow.innerHTML = `
    <th>#</th>
    <th>Name</th>
    <th>Team</th>
    <th>Days Active</th>
    <th>Total Vol</th>
    <th>Avg/Day</th>
  `;

  sorted.forEach((p, i) => {
    const avg = p.days ? (p.total / p.days).toFixed(2) : '0.00';
    const tr = document.createElement('tr');

    if (i === 0 && p.total > 0)
      tr.className = 'rank-1-row';

    tr.innerHTML = `
      <td class="rank-col">${i + 1}</td>
      <td>${p.name}</td>
      <td>${FLAGS[p.team] || ''} ${p.team}</td>
      <td>${p.days}</td>
      <td>${p.total}</td>
      <td class="pts">${avg}</td>`;

    tbody.appendChild(tr);
  });

} else {
 headerRow.innerHTML = `
  <th>#</th>
  <th>Team</th>
  <th>Wins</th>
  <th>Total Volume</th>
`;


// ── TEAM MONTHLY RANKINGS ──

const teamStats = {};

TEAM_ORDER.forEach(team => {
  teamStats[team] = {
    team,
    wins: 0,
    totalVolume: 0
  };
});

// Calculate wins and volume
allDaysData.forEach(day => {

  // Add team volume
  TEAM_ORDER.forEach(team => {
    teamStats[team].totalVolume += getTeamTotal(day.players, team);
  });

  // Find winner of the day
  const scores = TEAM_ORDER.map(team => ({
    team,
    score: getTeamScore(day.players, team)
  })).sort((a, b) => b.score - a.score);

  if (scores[0] && scores[0].score > 0) {
    teamStats[scores[0].team].wins++;
  }
});

// Rank by wins first, then volume
const rankedTeams = Object.values(teamStats)
  .sort((a, b) =>
    b.wins - a.wins ||
    b.totalVolume - a.totalVolume
  );

// Fill table

const teamTbody = tbody;
if (teamTbody) {
  teamTbody.innerHTML = '';

  rankedTeams.forEach((t, i) => {
    const tr = document.createElement('tr');

    if (i === 0) tr.className = 'rank-1-row';

  tr.innerHTML = `
  <td class="rank-col">${i + 1}</td>
  <td>${FLAGS[t.team] || ''} ${t.team}</td>
  <td class="pts">${t.wins}</td>
  <td>${t.totalVolume}</td>
`;
    teamTbody.appendChild(tr);
  });
}

}
}

// ── RENDER: Man of the Match ──────────────────────────────────
function renderMOTM() {
  const players = buildPlayersForDate(selectedDate);
  const dateLabel = formatDateLabel(selectedDate) || '—';

  const lbl = document.getElementById('motm-date-label');
  if (lbl) lbl.textContent = 'Top individual performer — ' + dateLabel;

  const working = [...players]
    .filter(p => p.working && p.vol > 0)
    .sort((a, b) => (b.vol || 0) - (a.vol || 0));

  const top  = working[0];
  const wrap = document.getElementById('motm-card-wrap');
  if (!wrap) return;

  if (!top) {
    wrap.innerHTML = `
      <div class="motm-empty">
        <div style="font-size:32px;margin-bottom:8px;">&#128203;</div>
        No working players with volume recorded for this date.
      </div>`;
  } else {
   console.log('MOTM:', top);
    wrap.innerHTML = `
      <div class="motm-card">
        <div style="font-size:12px;color:var(--gold);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">
          &#11088; Man of the Match
        </div>
        <img
  src="${top.photo || 'images/default-avatar.png'}"
  alt="${top.name}"
  onerror="this.src='images/default-avatar.png'"
  class="motm-avatar"
/>
        <div class="motm-name">${top.name}</div>
        <div class="motm-team">${FLAGS[top.team] || ''} ${top.team}</div>
        <div class="star-row">${'<span class="star">&#9733;</span>'.repeat(5)}</div>
        <div class="motm-vol">${top.vol}</div>
        <div class="motm-vol-label">FTD volume</div>
      </div>`;
  }

  const tbody = document.getElementById('motm-top5-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (working.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:16px;">No data for this date</td></tr>`;
    return;
  }

  working.slice(0, 5).forEach((p, i) => {
    const tr = document.createElement('tr');
    if (i === 0) tr.className = 'rank-1-row';
    tr.innerHTML = `
      <td class="rank-col">${i + 1}</td>
      <td>${p.name}</td>
      <td>${FLAGS[p.team] || ''} ${p.team}</td>
      <td class="pts">${p.vol}</td>`;
    tbody.appendChild(tr);
  });
}

// ── RENDER: Top Performers ────────────────────────────────────
function renderPerformers() {
  const allDaysData = buildAllDaysData();

  const playerMap = {};
  Object.values(allPlayers).forEach(p => {
   playerMap[p.name] = {
  name: p.name,
  team: p.team,
  photo: p.photo || '',
  days: 0,
  total: 0
};
  });

  allDaysData.forEach(day => {
    day.players.forEach(p => {
      if (!playerMap[p.name]) {
        playerMap[p.name] = { name: p.name, team: p.team,photo: p.photo || '', days: 0, total: 0 };
      }
      if (p.working) {
        playerMap[p.name].days++;
        playerMap[p.name].total += (p.vol || 0);
      }
    });
  });

  const sorted  = Object.values(playerMap)
    .filter(p => p.days > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const maxVol = sorted[0]?.total || 1;
  const grid   = document.getElementById('performers-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (sorted.length === 0) {
    grid.innerHTML = `<div class="history-empty" style="grid-column:1/-1;">No performance data available yet.</div>`;
    return;
  }

  sorted.forEach((p, i) => {
    const pct      = Math.round((p.total / maxVol) * 100);
    const avg      = p.days ? (p.total / p.days).toFixed(2) : '0.00';
    const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const div      = document.createElement('div');
    div.className  = 'card';
    div.innerHTML  = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
       <img
  src="${p.photo || 'images/default-avatar.png'}"
  alt="${p.name}"
  onerror="this.src='images/default-avatar.png'"
  style="
    width:40px;
    height:40px;
    border-radius:50%;
    object-fit:cover;
    border:2px solid var(--gold);
    flex-shrink:0;
  "
>
        <div style="min-width:0;">
          <div style="font-weight:500;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
          <div style="font-size:11px;color:var(--muted);">${FLAGS[p.team] || ''} ${p.team}</div>
        </div>
        ${i === 0 ? '<span style="margin-left:auto;font-size:18px;">&#127942;</span>' : ''}
      </div>
      <div style="font-family:var(--font-display);font-size:28px;color:var(--gold);">${p.total}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">
        Total FTD vol &nbsp;·&nbsp; ${p.days} days &nbsp;·&nbsp; avg ${avg}/day
      </div>
      <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>`;
    grid.appendChild(div);
  });
}

// ── RENDER: Match History ─────────────────────────────────────
function renderHistory() {
  const allDaysData = buildAllDaysData();
  const list = document.getElementById('history-list');
  if (!list) return;
  list.innerHTML = '';

  if (allDaysData.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <div style="font-size:32px;margin-bottom:8px;">&#128202;</div>
        No history yet. Results will appear here as daily data is recorded.
      </div>`;
    return;
  }

  allDaysData.forEach(day => {
    const entry = document.createElement('div');
    entry.className = 'history-entry';

    const scores = TEAM_ORDER.map(t => ({
      team:  t,
      score: getTeamScore(day.players || [], t),
      total: getTeamTotal(day.players || [], t)
    })).sort((a, b) => b.score - a.score);

    const winner = scores[0];

    // Find MOTM for this day
    const topPlayer = [...(day.players || [])]
      .filter(p => p.working && p.vol > 0)
      .sort((a, b) => b.vol - a.vol)[0];

    entry.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <div class="h-date">&#128197; ${formatDateLabel(day.date)}</div>
        ${topPlayer ? `<div style="font-size:11px;color:var(--muted);">&#11088; MOTM: <span style="color:var(--gold)">${topPlayer.name}</span> (${topPlayer.vol} vol)</div>` : ''}
      </div>
      <div class="h-scores" style="margin-top:10px;">
        ${scores.map((s, i) => `
          <div class="h-score-item">
            <div class="h-flag">${FLAGS[s.team] || ''} ${i === 0 ? '&#127942;' : ''}</div>
            <div class="h-val">${s.score.toFixed(2)}</div>
            <div class="h-team">${s.team}</div>
            <div style="font-size:10px;color:var(--muted);">Total: ${s.total}</div>
          </div>`).join('')}
      </div>
      ${winner && winner.score > 0 ? `
        <div style="margin-top:10px;">
          <span class="history-winner-badge">
            &#127942; Winner: ${FLAGS[winner.team] || ''} ${winner.team} (${winner.score.toFixed(2)})
          </span>
        </div>` : ''}`;
    list.appendChild(entry);
  });
}

// ── Navigation ────────────────────────────────────────────────
function nav(section, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sec = document.getElementById('sec-' + section);
  if (sec) sec.classList.add('active');
  if (el) el.classList.add('active');

  if (section === 'standings')  renderStandings();
  if (section === 'daily')      renderDaily();
  if (section === 'monthly')    renderMonthly();
  if (section === 'motm')       renderMOTM();
  if (section === 'performers') renderPerformers();
  if (section === 'history')    renderHistory();

  if (window.innerWidth < 640) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

// ── Date change handler ───────────────────────────────────────
function onDateChange(value) {
  localStorage.setItem('selectedDate', value);
  if (!value) return;
  selectedDate = value;
  // Re-render whichever section is currently active
  const active = document.querySelector('.section.active');
  if (!active) return;
  const id = active.id.replace('sec-', '');
  if (id === 'standings')  renderStandings();
  if (id === 'daily')      renderDaily();
  if (id === 'motm')       renderMOTM();
  // Monthly/performers/history span all dates — no change needed on date switch
}

// ── Sidebar toggle (mobile) ───────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── Download helpers ──────────────────────────────────────────
function downloadSnapshot() {
  const target = document.getElementById('snapshot-target');
  html2canvas(target, { backgroundColor: '#0f1f16', scale: 2 }).then(canvas => {
    const link      = document.createElement('a');
    link.download   = 'standings-' + (selectedDate || today()).replace(/\//g, '-') + '.png';
    link.href       = canvas.toDataURL('image/png');
    link.click();
    showToast('Image downloaded!');
  });
}

function downloadSection(sectionId) {
  const target = document.getElementById(sectionId);
  html2canvas(target, { backgroundColor: '#0f1f16', scale: 2 }).then(canvas => {
    const link      = document.createElement('a');
    link.download   = sectionId + '-' + today() + '.png';
    link.href       = canvas.toDataURL('image/png');
    link.click();
    showToast('Image downloaded!');
  });
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  // Update sidebar date/month display
  const now  = new Date();
  const opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  const sideDate = document.getElementById('side-date');
  if (sideDate) sideDate.textContent = now.toLocaleDateString('en-IN', opts);
  const sideMonth = document.getElementById('side-month');
  if (sideMonth) sideMonth.textContent = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  try {
    await getLiveData();
  } catch (err) {
    console.error('Failed to load sheet data:', err);
    showToast('Could not load data — check network');
  }

  // Render the default active section (standings)
  renderStandings();
  renderDaily();
  renderMonthly();
  renderMOTM();
  renderPerformers();
  renderHistory();
}

// Auto-refresh every 5 minutes
setInterval(() => location.reload(), 5 * 60 * 1000);

init();
