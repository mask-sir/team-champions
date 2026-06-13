/* ─────────────────────────────────────────────────────────────
   Team Champions World Cup — script.js
   Fixed: MOTM img bug, motm-avatar class, monthly header crash,
          dead var, init over-render. Added FIFA animations.
───────────────────────────────────────────────────────────── */

// ── Published CSV URLs ────────────────────────────────────────
const PLAYERS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSYUWCc26thkqu-YY0ZM5a7BkRPBMt1-lXupWx8QocSnjSBPqnC3Mg7k48U1VfD19MCRm8D7Pg5dm_p/pub?gid=0&single=true&output=csv";
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSYUWCc26thkqu-YY0ZM5a7BkRPBMt1-lXupWx8QocSnjSBPqnC3Mg7k48U1VfD19MCRm8D7Pg5dm_p/pub?gid=771581313&single=true&output=csv";

// ── Constants ──────────────────────────────────────────────────
const FLAGS = {
  ARGENTINA: '&#127462;&#127479;',
  PORTUGAL:  '&#127477;&#127481;',
  BRAZIL:    '&#127463;&#127479;',
  SPAIN:     '&#127466;&#127480;'
};
const TEAM_ORDER = ['ARGENTINA', 'PORTUGAL', 'BRAZIL', 'SPAIN'];
window.TEAM_ORDER_REF = TEAM_ORDER;

// ── State ──────────────────────────────────────────────────────
let selectedDate  = null;
let allEntryLines = [];
let allPlayers    = {};
let allDates      = [];

// ── Helpers ────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().split('T')[0];
}

function parseDate(str) {
  if (!str) return null;
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return new Date(+y, +m - 1, +d);
  }
  return new Date(str);
}

// Parse a form timestamp like "13/06/2026 13:28:17" (DD/MM/YYYY HH:MM:SS).
// native `new Date()` reads "13/06" as month 13 → Invalid Date, which broke
// the "keep the latest entry per player" logic. Returns ms since epoch (0 if
// unparseable, so chronological CSV order then decides the winner).
function parseTimestamp(str) {
  if (!str) return 0;
  const [datePart, timePart = ''] = str.trim().split(/\s+/);
  if (datePart.includes('/')) {
    const [d, m, y] = datePart.split('/').map(Number);
    const [h = 0, min = 0, s = 0] = timePart.split(':').map(Number);
    return new Date(y, m - 1, d, h, min, s).getTime();
  }
  const t = new Date(str).getTime();
  return isNaN(t) ? 0 : t;
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

// ── Animation toggle (performance switch, persists to localStorage) ──
// The `anim-off` class on <html> is applied pre-paint by an inline script
// in index.html. These helpers keep it, the UI, and storage in sync.
const ANIM_PREF_KEY = 'tcwc_anim';

function animationsEnabled() {
  return !document.documentElement.classList.contains('anim-off');
}

function syncAnimToggleUI() {
  const btn = document.getElementById('anim-toggle');
  if (!btn) return;
  const enabled = animationsEnabled();
  btn.setAttribute('aria-checked', String(enabled));
  const label = btn.querySelector('.anim-toggle-label');
  if (label) label.textContent = enabled ? 'Animations' : 'Animations off';
}

function toggleAnimations() {
  const turningOff = animationsEnabled();
  document.documentElement.classList.toggle('anim-off', turningOff);
  try { localStorage.setItem(ANIM_PREF_KEY, turningOff ? 'off' : 'on'); } catch (e) {}
  syncAnimToggleUI();
  showToast(turningOff ? 'Animations off — smoother performance' : 'Animations on ✨');
}

// ── FIFA: Confetti ─────────────────────────────────────────────
function launchConfetti(duration = 3000) {
  if (!animationsEnabled()) return;
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.classList.add('active');

  const colors = ['#FFD75E','#00d98b','#ffffff','#ff5470','#7c8df0'];
  const pieces = Array.from({ length: 120 }, () => ({
    x:    Math.random() * canvas.width,
    y:    Math.random() * -canvas.height,
    size: Math.random() * 8 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx:   (Math.random() - 0.5) * 4,
    vy:   Math.random() * 4 + 2,
    rot:  Math.random() * 360,
    rspd: (Math.random() - 0.5) * 6
  }));

  let start = null;
  function frame(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pieces.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.rot += p.rspd;
      if (p.y > canvas.height) { p.y = -p.size; p.x = Math.random() * canvas.width; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
      ctx.restore();
    });

    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.classList.remove('active');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(frame);
}

// ── FIFA: Goal Banner ──────────────────────────────────────────
function showGoalBanner(winnerName) {
  if (!animationsEnabled()) return;
  const banner = document.getElementById('goal-banner');
  const sub    = document.getElementById('goal-banner-sub');
  if (!banner || !sub) return;
  sub.textContent = `🏆 ${winnerName} leads today!`;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 3500);
}

// ── FIFA: Celebrate top team ───────────────────────────────────
function celebrateLeader(teams) {
  if (!teams || !teams[0] || teams[0].score <= 0) return;
  showGoalBanner(teams[0].team);
  launchConfetti(4000);
}

// ── Data loading ───────────────────────────────────────────────
async function getLiveData() {
  // Google's published CSV is cached for 5 min (Cache-Control: max-age=300).
  // A unique query param + no-store bypasses both the browser and Google's CDN
  // cache, so live edits (e.g. today's deposits) show up on each refresh.
  const bust = `&_=${Date.now()}`;
  const [playersRes, entriesRes] = await Promise.all([
    fetch(PLAYERS_URL + bust, { cache: 'no-store' }),
    fetch(SHEET_URL + bust, { cache: 'no-store' })
  ]);

  const playersCsv = await playersRes.text();
  const entriesCsv = await entriesRes.text();

  // Parse players sheet (Name, Team, Photo)
  const playersLines = playersCsv.trim().split('\n');
  playersLines.shift();
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

  // Parse entries sheet (Timestamp, Date, Player, Working, FTD Vol)
  allEntryLines = entriesCsv.trim().split('\n');
  allEntryLines.shift();

  // Collect unique dates sorted descending
  const dateSet = new Set();
  allEntryLines.forEach(row => {
    const d = row.split(',')[1]?.trim();
    if (d) dateSet.add(d);
  });

  allDates = [...dateSet].sort((a, b) => {
    const da = parseDate(a), db = parseDate(b);
    return db - da;
  });

  // Populate hidden native select (kept for compat)
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

  // Restore saved date or use latest
  const savedDate = localStorage.getItem('selectedDate');
  if (savedDate && allDates.includes(savedDate)) {
    selectedDate = savedDate;
  } else if (!selectedDate && allDates.length > 0) {
    selectedDate = allDates[0];
  }

  if (dateSelect && selectedDate) {
    dateSelect.value = selectedDate;
  }

  // Populate custom animated picker
  buildCustomDatePicker(allDates, selectedDate);

  return buildPlayersForDate(selectedDate);
}

function buildPlayersForDate(date) {
  const snapshot = {};
  Object.values(allPlayers).forEach(p => {
    snapshot[p.name] = { ...p, working: false, vol: 0, timestamp: null };
  });

  allEntryLines.forEach(row => {
    const cols        = row.split(',');
    const timestamp   = cols[0]?.trim();
    const entryDate   = cols[1]?.trim();
    const playerName  = cols[2]?.trim();
    const working     = cols[3]?.trim().toUpperCase() === 'YES';
    const vol         = Number(cols[4]) || 0;

    if (entryDate !== date) return;
    if (!snapshot[playerName]) return;

    const prev = snapshot[playerName].timestamp;
    const cur  = parseTimestamp(timestamp);
    // `>=` so that on equal/unparseable timestamps the later CSV row (the most
    // recent form submission) wins.
    if (prev == null || cur >= prev) {
      snapshot[playerName].timestamp = cur;
      snapshot[playerName].working   = working;
      snapshot[playerName].vol       = vol;
    }
  });

  return Object.values(snapshot);
}

function buildAllDaysData() {
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

// ── RENDER: Standings ──────────────────────────────────────────
function renderStandings(celebrate = false) {
  const players = buildPlayersForDate(selectedDate);

  const dateLabel = formatDateLabel(selectedDate) || '—';
  const el = document.getElementById('standings-date');
  if (el) el.textContent = 'Date: ' + dateLabel;
  const snapLabel = document.getElementById('snap-date-label');
  if (snapLabel) snapLabel.textContent = 'Date: ' + dateLabel;

  const teams = TEAM_ORDER.map(t => ({
    team:    t,
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

  if (celebrate) {
    celebrateLeader(teams);
  }

  renderCommentary();
}

// ── RENDER: Daily Scoreboard ───────────────────────────────────
function renderDaily() {
  const players   = buildPlayersForDate(selectedDate);
  const dateLabel = formatDateLabel(selectedDate) || '—';

  const lbl = document.getElementById('daily-date-label');
  if (lbl) lbl.textContent = 'Individual performance — ' + dateLabel;

  const sorted = [...players].sort((a, b) => (b.vol || 0) - (a.vol || 0));
  const tbody  = document.getElementById('daily-tbody');
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

// ── RENDER: Monthly Scoreboard ─────────────────────────────────
function renderMonthly() {
  const allDaysData  = buildAllDaysData();
  const monthlyView  = document.getElementById('monthly-view')?.value || 'players';

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

  const sorted        = Object.values(playerMap).sort((a, b) => b.total - a.total);
  const totalVol      = sorted.reduce((s, p) => s + p.total, 0);
  const topPlayer     = sorted[0] || {};
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

  // FIX: safe header + tbody access
  const table     = document.getElementById('monthly-table');
  if (!table) return;
  const headerRow = table.querySelector('thead tr');
  const tbody     = document.getElementById('monthly-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (monthlyView === 'players') {
    if (headerRow) headerRow.innerHTML = `
      <th>#</th><th>Name</th><th>Team</th>
      <th>Days Active</th><th>Total Vol</th><th>Avg/Day</th>`;

    sorted.forEach((p, i) => {
      const avg = p.days ? (p.total / p.days).toFixed(2) : '0.00';
      const tr  = document.createElement('tr');
      if (i === 0 && p.total > 0) tr.className = 'rank-1-row';
      tr.innerHTML = `
        <td class="rank-col">${i + 1}</td>
        <td>${p.name}</td>
        <td>${FLAGS[p.team] || ''} ${p.team}</td>
        <td>${p.days}</td>
        <td>${p.total}</td>
        <td class="pts">${avg}</td>`;
      tbody.appendChild(tr);
    });

  } else if (monthlyView === 'teams') {
    if (headerRow) headerRow.innerHTML = `
  <th>#</th>
  <th>Team</th>
  <th>Total Wins</th>
  <th>Total Volume</th>
`;

    const teamStats = {};
    TEAM_ORDER.forEach(team => {
      teamStats[team] = { team, wins: 0, totalVolume: 0 };
    });

    allDaysData.forEach(day => {
      TEAM_ORDER.forEach(team => {
        teamStats[team].totalVolume += getTeamTotal(day.players, team);
      });
      const scores = TEAM_ORDER.map(team => ({
        team,
        score: getTeamScore(day.players, team)
      })).sort((a, b) => b.score - a.score);
      if (scores[0] && scores[0].score > 0) {
        teamStats[scores[0].team].wins++;
      }
    });

    const rankedTeams = Object.values(teamStats)
      .sort((a, b) => b.wins - a.wins || b.totalVolume - a.totalVolume);

    rankedTeams.forEach((t, i) => {
      const tr = document.createElement('tr');
      if (i === 0) tr.className = 'rank-1-row';
      tr.innerHTML = `
        <td class="rank-col">${i + 1}</td>
        <td>${FLAGS[t.team] || ''} ${t.team}</td>
        <td class="pts">${t.wins}</td>
        <td>${t.totalVolume}</td>`;
      tbody.appendChild(tr);
    });
  } else if (monthlyView === 'team-points') {

  if (headerRow) headerRow.innerHTML = `
    <th>#</th>
    <th>Team</th>
    <th>Total Volume</th>
    <th>Points</th>
  `;

 const teamStats = {};

TEAM_ORDER.forEach(team => {
  teamStats[team] = {
    team,
    points: 0,
    totalVolume: 0
  };
});

allDaysData.forEach(day => {

  TEAM_ORDER.forEach(team => {

    // Daily point (same value shown on Team Standings)
    const dailyPoint = getTeamScore(day.players, team);

    // Add daily point to monthly total
    teamStats[team].points += dailyPoint;

    // Add volume
    teamStats[team].totalVolume +=
      getTeamTotal(day.players, team);

  });

});

const rankedTeams = Object.values(teamStats)
  .sort((a, b) =>
    b.points - a.points ||
    b.totalVolume - a.totalVolume
  );

  rankedTeams.forEach((t, i) => {
    const tr = document.createElement('tr');

    if (i === 0)
      tr.className = 'rank-1-row';

    tr.innerHTML = `
      <td class="rank-col">${i + 1}</td>
      <td>${FLAGS[t.team] || ''} ${t.team}</td>
      <td>${t.totalVolume}</td>
      <td class="pts">${t.points.toFixed(2)}</td>
    `;

    tbody.appendChild(tr);
  });
}
}

// ── RENDER: Man of the Match ───────────────────────────────────
function renderMOTM() {
  const players   = buildPlayersForDate(selectedDate);
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
    // FIX: correct img tag — no stray text, use motm-avatar-img class
    const avatarHtml = top.photo
      ? `<img
           src="${top.photo}"
           alt="${top.name}"
           class="motm-avatar-img"
           onerror="this.onerror=null;this.src='images/default-avatar.png';"
         />`
      : `<div class="motm-avatar-div">${top.name.charAt(0)}</div>`;

    wrap.innerHTML = `
      <div class="motm-card">
        <div style="font-size:12px;color:var(--gold);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">
          &#11088; Man of the Match
        </div>
        ${avatarHtml}
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

// ── RENDER: Top Performers ─────────────────────────────────────
function renderPerformers() {
  const allDaysData = buildAllDaysData();

  const playerMap = {};
  Object.values(allPlayers).forEach(p => {
    playerMap[p.name] = { name: p.name, team: p.team, photo: p.photo || '', days: 0, total: 0 };
  });

  allDaysData.forEach(day => {
    day.players.forEach(p => {
      if (!playerMap[p.name]) {
        playerMap[p.name] = { name: p.name, team: p.team, photo: p.photo || '', days: 0, total: 0 };
      }
      if (p.working) {
        playerMap[p.name].days++;
        playerMap[p.name].total += (p.vol || 0);
      }
    });
  });

  const sorted = Object.values(playerMap)
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
    const avatarHtml = p.photo
      ? `<img src="${p.photo}" crossorigin="anonymous" alt="${p.name}"
           onerror="this.onerror=null;this.src='images/default-avatar.png';"
           style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);flex-shrink:0;">`
      : `<div style="width:40px;height:40px;border-radius:50%;background:var(--pitch-light);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:16px;color:var(--gold);border:2px solid var(--gold);flex-shrink:0;">${initials}</div>`;

    const div     = document.createElement('div');
    div.className = 'card';
    div.style.animationDelay = (i * 0.08) + 's';
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        ${avatarHtml}
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

// ── RENDER: Match History ──────────────────────────────────────
function renderHistory() {
  const allDaysData = buildAllDaysData();
  const list = document.getElementById('history-list');
  if (!list) return;
  list.innerHTML = '';

  if (allDaysData.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <div style="font-size:32px;margin-bottom:8px;">&#128202;</div>
        No history yet.
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
          <span class="history-winner-badge">&#127942; Winner: ${FLAGS[winner.team] || ''} ${winner.team} (${winner.score.toFixed(2)})</span>
        </div>` : ''}`;
    list.appendChild(entry);
  });
}

// ── RENDER: Head to Head ───────────────────────────────────────
let h2hTeamA = null;
let h2hTeamB = null;

function renderH2H() {
  const allDaysData = buildAllDaysData();

  // Build team picker buttons if not already done
  ['a', 'b'].forEach(side => {
    const container = document.getElementById(`h2h-btns-${side}`);
    if (!container || container.dataset.built) return;
    container.dataset.built = '1';

    TEAM_ORDER.forEach(team => {
      const btn = document.createElement('button');
      btn.className = 'h2h-team-btn';
      btn.dataset.team = team;
      btn.dataset.side = side;
      btn.innerHTML = `${FLAGS[team] || ''} ${team}`;
      btn.onclick = () => selectH2HTeam(side, team);
      container.appendChild(btn);
    });
  });

  // Default selection if none set
  if (!h2hTeamA) selectH2HTeam('a', TEAM_ORDER[0], false);
  if (!h2hTeamB) selectH2HTeam('b', TEAM_ORDER[1], false);

  drawH2HResult(allDaysData);
}

function selectH2HTeam(side, team, redraw = true) {
  if (side === 'a') h2hTeamA = team;
  else              h2hTeamB = team;

  // Update button states
  document.querySelectorAll(`[data-side="${side}"]`).forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.team === team);
  });

  if (redraw) drawH2HResult(buildAllDaysData());
}

function drawH2HResult(allDaysData) {
  const result = document.getElementById('h2h-result');
  if (!result) return;

  const teamA = h2hTeamA;
  const teamB = h2hTeamB;

  if (!teamA || !teamB || teamA === teamB) {
    result.innerHTML = `<div class="h2h-empty">Select two different teams to compare.</div>`;
    return;
  }

  // Compute per-day scores
  const days = allDaysData.map(day => {
    const scoreA = getTeamScore(day.players, teamA);
    const scoreB = getTeamScore(day.players, teamB);
    const totalA = getTeamTotal(day.players, teamA);
    const totalB = getTeamTotal(day.players, teamB);
    return { date: day.date, scoreA, scoreB, totalA, totalB };
  }).filter(d => d.scoreA > 0 || d.scoreB > 0); // skip days neither played

  if (days.length === 0) {
    result.innerHTML = `<div class="h2h-empty">No matchup data found yet.</div>`;
    return;
  }

  // Aggregate stats
  let winsA = 0, winsB = 0, draws = 0;
  let totalVolA = 0, totalVolB = 0;
  let bestDayA = 0, bestDayB = 0;
  let currentStreakA = 0, currentStreakB = 0, streakA = 0, streakB = 0;

  days.forEach(d => {
    totalVolA += d.totalA;
    totalVolB += d.totalB;
    if (d.scoreA > bestDayA) bestDayA = d.scoreA;
    if (d.scoreB > bestDayB) bestDayB = d.scoreB;
    if (d.scoreA > d.scoreB)      { winsA++; streakA++; streakB = 0; }
    else if (d.scoreB > d.scoreA) { winsB++; streakB++; streakA = 0; }
    else                           { draws++;  streakA = 0; streakB = 0; }
    currentStreakA = streakA;
    currentStreakB = streakB;
  });

  const played  = days.length;
  const avgA    = days.reduce((s, d) => s + d.scoreA, 0) / played;
  const avgB    = days.reduce((s, d) => s + d.scoreB, 0) / played;

  // Head-to-head wins score
  const h2hScoreA = winsA;
  const h2hScoreB = winsB;

  // Helper: bar widths for a pair of values
  function barWidths(valA, valB) {
    const max = Math.max(valA, valB, 0.01);
    return { wA: Math.round((valA / max) * 100), wB: Math.round((valB / max) * 100) };
  }

  function statRow(label, valA, valB, displayA, displayB) {
    const { wA, wB } = barWidths(valA, valB);
    const aWins = valA > valB;
    const bWins = valB > valA;
    return `
      <div class="h2h-stat-row">
        <div class="h2h-val-a ${aWins ? 'winner' : ''}">${displayA}</div>
        <div>
          <div class="h2h-stat-label">${label}</div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            <div style="flex:1;">
              <div class="h2h-bar-wrap">
                <div class="h2h-bar-a" style="width:${wA}%"></div>
              </div>
            </div>
            <div style="flex:1;">
              <div class="h2h-bar-wrap">
                <div class="h2h-bar-b" style="width:${wB}%"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="h2h-val-b ${bWins ? 'winner' : ''}">${displayB}</div>
      </div>`;
  }

  // Build daily breakdown rows (newest first)
  const dayRows = [...days].reverse().map(d => {
    let winClass = 'h2h-day-draw', winLabel = '—';
    if (d.scoreA > d.scoreB) { winClass = 'h2h-day-win-a'; winLabel = teamA; }
    if (d.scoreB > d.scoreA) { winClass = 'h2h-day-win-b'; winLabel = teamB; }
    return `
      <div class="h2h-day-row">
        <div class="h2h-day-date">${formatDateLabel(d.date)}</div>
        <div class="h2h-day-score-a">${d.scoreA.toFixed(2)}</div>
        <div class="h2h-day-winner ${winClass}">${winLabel === '—' ? 'Draw' : '🏆'}</div>
        <div class="h2h-day-score-b">${d.scoreB.toFixed(2)}</div>
      </div>`;
  }).join('');

  result.innerHTML = `
    <!-- Matchup header -->
    <div class="h2h-matchup-header">
      <div class="h2h-team-side">
        <div class="h2h-team-flag">${FLAGS[teamA] || ''}</div>
        <div class="h2h-team-name">${teamA}</div>
        <div class="h2h-team-record">${winsA}W · ${draws}D · ${winsB}L</div>
      </div>
      <div class="h2h-score-center">
        <div class="h2h-score-display">${h2hScoreA} — ${h2hScoreB}</div>
        <div class="h2h-score-label">Wins over ${played} days</div>
      </div>
      <div class="h2h-team-side">
        <div class="h2h-team-flag">${FLAGS[teamB] || ''}</div>
        <div class="h2h-team-name">${teamB}</div>
        <div class="h2h-team-record">${winsB}W · ${draws}D · ${winsA}L</div>
      </div>
    </div>

    <!-- Stat bars -->
    <div class="h2h-stats-grid">
      ${statRow('Avg Score / Day', avgA, avgB, avgA.toFixed(2), avgB.toFixed(2))}
      ${statRow('Total Volume',    totalVolA, totalVolB, totalVolA, totalVolB)}
      ${statRow('Best Day Score',  bestDayA,  bestDayB,  bestDayA.toFixed(2), bestDayB.toFixed(2))}
      ${statRow('Current Win Streak', currentStreakA, currentStreakB,
                currentStreakA > 0 ? '🔥 ' + currentStreakA : currentStreakA,
                currentStreakB > 0 ? '🔥 ' + currentStreakB : currentStreakB)}
      ${statRow('Days Won', winsA, winsB, winsA, winsB)}
    </div>

    <!-- Daily breakdown -->
    <div class="h2h-days-section">
      <div class="h2h-days-header">
        <span style="flex:1;text-align:right;color:var(--gold);">${teamA}</span>
        <span style="width:80px;text-align:center;">Daily Result</span>
        <span style="flex:1;text-align:left;color:var(--accent);">${teamB}</span>
      </div>
      ${dayRows}
    </div>`;
}

// ── Player vs Player ─────────────────────────────────────────
let pvpPlayerA = null;
let pvpPlayerB = null;
let _pvpPickerOpen = { a: false, b: false };
let _pvpPickerTime = { a: 0, b: 0 };

function renderPvP() {
  buildPvPPickers();
  if (!pvpPlayerA || !pvpPlayerB) drawPvPResult();
}

function buildPvPPickers() {
  ['a','b'].forEach(side => {
    const list = document.getElementById('pvp-list-' + side);
    if (!list || list.dataset.built) return;
    list.dataset.built = '1';

    // Group by team
    const byTeam = {};
    Object.values(allPlayers).forEach(p => {
      if (!byTeam[p.team]) byTeam[p.team] = [];
      byTeam[p.team].push(p.name);
    });

    Object.keys(byTeam).sort().forEach(team => {
      // Team header
      const header = document.createElement('div');
      header.style.cssText = 'padding:6px 16px 2px;font-size:10px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;';
      header.textContent = team;
      list.appendChild(header);

      byTeam[team].sort().forEach(name => {
        const p = allPlayers[name] || {};
        const item = document.createElement('div');
        item.className = 'custom-option';
        item.dataset.value = name;
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '8px';
        if (p.photo) {
          const img = document.createElement('img');
          img.src = p.photo;
          img.style.cssText = 'width:24px;height:24px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid var(--card-border);';
          img.onerror = () => img.remove();
          item.appendChild(img);
        } else {
          const av = document.createElement('div');
          av.style.cssText = 'width:24px;height:24px;border-radius:50%;background:var(--pitch-light);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--gold);flex-shrink:0;';
          av.textContent = name.charAt(0).toUpperCase();
          item.appendChild(av);
        }
        const label = document.createElement('span');
        label.textContent = name;
        item.appendChild(label);
        item.onclick = (e) => { e.stopPropagation(); pickPvPPlayer(side, name); };
        list.appendChild(item);
      });
    });
  });
}

function togglePvPPicker(side, e) {
  if (e) e.stopPropagation();
  _pvpPickerOpen[side] ? closePvPPicker(side) : openPvPPicker(side);
}

// Named handlers so we can removeEventListener properly
const _pvpOutsideHandlers = { a: null, b: null };

function openPvPPicker(side) {
  // Always close both first — prevents overlap confusion on mobile
  closePvPPicker('a');
  closePvPPicker('b');

  const wrap = document.getElementById('pvp-picker-' + side);
  if (!wrap) return;
  _pvpPickerOpen[side] = true;
  _pvpPickerTime[side] = Date.now();
  wrap.classList.add('open');

  // Scroll wrap into view on mobile so dropdown is visible
  setTimeout(() => wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);

  const opts = wrap.querySelectorAll('.custom-option');
  opts.forEach((o, i) => {
    o.classList.remove('option-visible');
    o.style.animationDelay = (i * 0.025) + 's';
  });
  requestAnimationFrame(() => opts.forEach(o => o.classList.add('option-visible')));

  // Named handler so it can be removed
  _pvpOutsideHandlers[side] = (e) => _pvpOutside(side, e);
  document.addEventListener('click', _pvpOutsideHandlers[side]);
}

function closePvPPicker(side) {
  const wrap = document.getElementById('pvp-picker-' + side);
  if (!wrap) return;
  _pvpPickerOpen[side] = false;
  wrap.classList.remove('open');
  if (_pvpOutsideHandlers[side]) {
    document.removeEventListener('click', _pvpOutsideHandlers[side]);
    _pvpOutsideHandlers[side] = null;
  }
}

function _pvpOutside(side, e) {
  if (Date.now() - _pvpPickerTime[side] < 150) return;
  const wrap = document.getElementById('pvp-picker-' + side);
  if (!wrap || !wrap.contains(e.target)) closePvPPicker(side);
}

function pickPvPPlayer(side, name) {
  closePvPPicker(side);
  if (side === 'a') pvpPlayerA = name;
  else              pvpPlayerB = name;

  const triggerText = document.getElementById('pvp-trigger-text-' + side);
  if (triggerText) {
    triggerText.style.animation = 'none';
    void triggerText.offsetWidth;
    triggerText.style.animation = 'dateTextSlide 0.3s ease forwards';
    triggerText.textContent = name;
    setTimeout(() => { triggerText.style.animation = ''; }, 400);
  }

  // Mark selected
  document.querySelectorAll(`#pvp-list-${side} .custom-option`).forEach(o =>
    o.classList.toggle('selected', o.dataset.value === name)
  );

  drawPvPResult();
}

function drawPvPResult() {
  const result = document.getElementById('pvp-result');
  if (!result) return;

  if (!pvpPlayerA || !pvpPlayerB) {
    result.innerHTML = `<div class="h2h-empty">Select two players to compare.</div>`;
    return;
  }
  if (pvpPlayerA === pvpPlayerB) {
    result.innerHTML = `<div class="h2h-empty">Select two different players.</div>`;
    return;
  }

  const allDays = buildAllDaysData();
  const pA = allPlayers[pvpPlayerA] || {};
  const pB = allPlayers[pvpPlayerB] || {};

  let winsA = 0, winsB = 0, draws = 0;
  let totalA = 0, totalB = 0;
  let bestA = 0, bestB = 0;
  let streakA = 0, streakB = 0, curStreakA = 0, curStreakB = 0;

  const days = [];
  allDays.forEach(day => {
    const pa = day.players.find(p => p.name === pvpPlayerA);
    const pb = day.players.find(p => p.name === pvpPlayerB);
    if (!pa || !pb) return;
    if (!pa.working && !pb.working) return;

    const va = pa.working ? (pa.vol || 0) : 0;
    const vb = pb.working ? (pb.vol || 0) : 0;
    if (va === 0 && vb === 0) return;

    days.push({ date: day.date, va, vb });
    totalA += va; totalB += vb;
    if (va > bestA) bestA = va;
    if (vb > bestB) bestB = vb;

    if (va > vb)      { winsA++; streakA++; streakB = 0; }
    else if (vb > va) { winsB++; streakB++; streakA = 0; }
    else              { draws++;  streakA = 0; streakB = 0; }
    curStreakA = streakA; curStreakB = streakB;
  });

  if (days.length === 0) {
    result.innerHTML = `<div class="h2h-empty">No shared active days found between these players.</div>`;
    return;
  }

  const played = days.length;
  const avgA = (totalA / played).toFixed(2);
  const avgB = (totalB / played).toFixed(2);

  function barWidths(a, b) {
    const max = Math.max(a, b, 0.01);
    return { wA: Math.round(a/max*100), wB: Math.round(b/max*100) };
  }

  function statRow(label, rawA, rawB, dispA, dispB) {
    const { wA, wB } = barWidths(rawA, rawB);
    const aW = rawA > rawB, bW = rawB > rawA;
    return `
      <div class="pvp-stat-row">
        <div class="pvp-val-a ${aW?'winner':''}">${dispA}</div>
        <div>
          <div class="pvp-stat-label">${label}</div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            <div style="flex:1;"><div class="h2h-bar-wrap"><div class="h2h-bar-a" style="width:${wA}%"></div></div></div>
            <div style="flex:1;"><div class="h2h-bar-wrap"><div class="h2h-bar-b" style="width:${wB}%"></div></div></div>
          </div>
        </div>
        <div class="pvp-val-b ${bW?'winner':''}">${dispB}</div>
      </div>`;
  }

  const initA = pvpPlayerA.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const initB = pvpPlayerB.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

  // Photo-aware avatars
  const avatarA = pA.photo
    ? `<img src="${pA.photo}" alt="${pvpPlayerA}" class="pvp-avatar-img" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';">
       <div class="pvp-avatar" style="display:none">${initA}</div>`
    : `<div class="pvp-avatar">${initA}</div>`;

  const avatarB = pB.photo
    ? `<img src="${pB.photo}" alt="${pvpPlayerB}" class="pvp-avatar-img pvp-avatar-b" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';">
       <div class="pvp-avatar" style="display:none;border-color:var(--accent);color:var(--accent)">${initB}</div>`
    : `<div class="pvp-avatar" style="border-color:var(--accent);color:var(--accent)">${initB}</div>`;

  const dayRows = [...days].reverse().map(d => {
    let cls = 'pvp-draw', lbl = 'Draw';
    if (d.va > d.vb) { cls = 'pvp-win-a'; lbl = '🏆'; }
    if (d.vb > d.va) { cls = 'pvp-win-b'; lbl = '🏆'; }
    return `
      <div class="pvp-day-row">
        <div class="pvp-day-date">${formatDateLabel(d.date)}</div>
        <div class="pvp-day-vol-a">${d.va}</div>
        <div class="pvp-day-winner ${cls}">${lbl}</div>
        <div class="pvp-day-vol-b">${d.vb}</div>
      </div>`;
  }).join('');

  result.innerHTML = `
    <div class="pvp-matchup-header">
      <div class="pvp-player-side">
        ${avatarA}
        <div class="pvp-player-name">${pvpPlayerA}</div>
        <div class="pvp-player-team">${FLAGS[pA.team]||''} ${pA.team||''}</div>
        <div class="pvp-record">${winsA}W · ${draws}D · ${winsB}L</div>
      </div>
      <div class="pvp-score-center">
        <div class="pvp-score-display">${winsA} — ${winsB}</div>
        <div class="pvp-score-label">Days won over ${played} days</div>
      </div>
      <div class="pvp-player-side">
        ${avatarB}
        <div class="pvp-player-name">${pvpPlayerB}</div>
        <div class="pvp-player-team">${FLAGS[pB.team]||''} ${pB.team||''}</div>
        <div class="pvp-record">${winsB}W · ${draws}D · ${winsA}L</div>
      </div>
    </div>

    <div class="pvp-stats-grid">
      ${statRow('Avg Vol / Day',    +avgA,   +avgB,   avgA,  avgB)}
      ${statRow('Total Volume',     totalA,  totalB,  totalA, totalB)}
      ${statRow('Best Day',         bestA,   bestB,   bestA,  bestB)}
      ${statRow('Days Won',         winsA,   winsB,   winsA,  winsB)}
      ${statRow('Win Streak Now',   curStreakA, curStreakB,
                curStreakA > 0 ? '🔥'+curStreakA : curStreakA,
                curStreakB > 0 ? '🔥'+curStreakB : curStreakB)}
    </div>

    <div class="pvp-days-section">
      <div class="h2h-days-header">
        <span style="flex:1;text-align:right;color:var(--gold);">${pvpPlayerA}</span>
        <span style="width:80px;text-align:center;">Daily</span>
        <span style="flex:1;text-align:left;color:var(--accent);">${pvpPlayerB}</span>
      </div>
      ${dayRows}
    </div>`;
}

function nav(section, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sec = document.getElementById('sec-' + section);
  if (sec) sec.classList.add('active');
  if (el) el.classList.add('active');

  if (section === 'standings')  renderStandings(false);
  if (section === 'daily')      renderDaily();
  if (section === 'monthly')    renderMonthly();
  if (section === 'motm')       renderMOTM();
  if (section === 'performers') renderPerformers();
  if (section === 'history')    renderHistory();
  if (section === 'h2h')        renderH2H();
  if (section === 'pvp')        renderPvP();

  if (window.innerWidth < 640) {
    document.getElementById('sidebar')?.classList.remove('open');
  }
}

// ── Custom animated date picker ───────────────────────────────
let _pickerOpen = false;
let _pickerOpenTime = 0;

function buildCustomDatePicker(dates, currentDate) {
  const list = document.getElementById('date-list');
  const triggerText = document.getElementById('date-trigger-text');
  if (!list) return;
  list.innerHTML = '';
  dates.forEach(date => {
    const item = document.createElement('div');
    item.className = 'custom-option' + (date === currentDate ? ' selected' : '');
    item.dataset.value = date;
    item.textContent = formatDateLabel(date);
    item.onclick = (e) => { e.stopPropagation(); pickDate(date); };
    list.appendChild(item);
  });
  if (currentDate && triggerText) triggerText.textContent = formatDateLabel(currentDate);
}

function toggleDatePicker(e) {
  if (e) e.stopPropagation();
  _pickerOpen ? closeDatePicker() : openDatePicker();
}

function openDatePicker() {
  const wrap = document.getElementById('date-picker-wrap');
  if (!wrap) return;
  _pickerOpen = true;
  _pickerOpenTime = Date.now();
  wrap.classList.add('open');

  // Staggered slide-in for options
  const options = wrap.querySelectorAll('.custom-option');
  options.forEach((opt, i) => {
    opt.classList.remove('option-visible');
    opt.style.animationDelay = (i * 0.04) + 's';
  });
  // Trigger reflow then add class
  requestAnimationFrame(() => {
    options.forEach(opt => opt.classList.add('option-visible'));
  });

  // Scroll selected into view
  const selected = wrap.querySelector('.custom-option.selected');
  if (selected) setTimeout(() => selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 200);

  // Outside click to close — ignore if fired within 150ms of opening (same click)
  document.addEventListener('click', _outsideClick);
}

function closeDatePicker() {
  const wrap = document.getElementById('date-picker-wrap');
  if (!wrap) return;
  _pickerOpen = false;
  wrap.classList.remove('open');
  document.removeEventListener('click', _outsideClick);
}

function _outsideClick(e) {
  if (Date.now() - _pickerOpenTime < 150) return; // same click that opened it
  const wrap = document.getElementById('date-picker-wrap');
  if (!wrap || !wrap.contains(e.target)) closeDatePicker();
}

function pickDate(value) {
  closeDatePicker();

  // Animate trigger label
  const triggerText = document.getElementById('date-trigger-text');
  if (triggerText) {
    triggerText.style.animation = 'none';
    void triggerText.offsetWidth;
    triggerText.style.animation = 'dateTextSlide 0.3s ease forwards';
    triggerText.textContent = formatDateLabel(value);
    setTimeout(() => { triggerText.style.animation = ''; }, 400);
  }

  // Mark selected option
  document.querySelectorAll('.custom-option').forEach(opt =>
    opt.classList.toggle('selected', opt.dataset.value === value)
  );

  // Gold flash on trigger
  const trigger = document.getElementById('date-trigger');
  if (trigger) {
    trigger.classList.remove('date-changed');
    void trigger.offsetWidth;
    trigger.classList.add('date-changed');
    setTimeout(() => trigger.classList.remove('date-changed'), 600);
  }

  onDateChange(value);
}

// ── Monthly view picker ───────────────────────────────────────
let _monthlyPickerOpen = false;
let _monthlyPickerOpenTime = 0;

const MONTHLY_OPTIONS = [
  { value: 'players', label: '👤 Player Rankings' },
  { value: 'teams',   label: '🏆 Team Rankings'   },
  {
  value: 'team-points',
  label: 'Point-wise Team Ranking'
}
];

function initMonthlyPicker() {
  const list = document.getElementById('monthly-list');
  if (!list || list.dataset.built) return;
  list.dataset.built = '1';
  MONTHLY_OPTIONS.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'custom-option' + (opt.value === 'players' ? ' selected' : '');
    item.dataset.value = opt.value;
    item.textContent = opt.label;
    item.onclick = (e) => { e.stopPropagation(); pickMonthlyView(opt.value, opt.label); };
    list.appendChild(item);
  });
}

function toggleMonthlyPicker(e) {
  if (e) e.stopPropagation();
  _monthlyPickerOpen ? closeMonthlyPicker() : openMonthlyPicker();
}

function openMonthlyPicker() {
  initMonthlyPicker();
  const wrap = document.getElementById('monthly-picker-wrap');
  if (!wrap) return;
  _monthlyPickerOpen = true;
  _monthlyPickerOpenTime = Date.now();
  wrap.classList.add('open');
  const options = wrap.querySelectorAll('.custom-option');
  options.forEach((opt, i) => {
    opt.classList.remove('option-visible');
    opt.style.animationDelay = (i * 0.06) + 's';
  });
  requestAnimationFrame(() => options.forEach(opt => opt.classList.add('option-visible')));
  document.addEventListener('click', _monthlyOutsideClick);
}

function closeMonthlyPicker() {
  const wrap = document.getElementById('monthly-picker-wrap');
  if (!wrap) return;
  _monthlyPickerOpen = false;
  wrap.classList.remove('open');
  document.removeEventListener('click', _monthlyOutsideClick);
}

function _monthlyOutsideClick(e) {
  if (Date.now() - _monthlyPickerOpenTime < 150) return;
  const wrap = document.getElementById('monthly-picker-wrap');
  if (!wrap || !wrap.contains(e.target)) closeMonthlyPicker();
}

function pickMonthlyView(value, label) {
  closeMonthlyPicker();
  const triggerText = document.getElementById('monthly-trigger-text');
  if (triggerText) {
    triggerText.style.animation = 'none';
    void triggerText.offsetWidth;
    triggerText.style.animation = 'dateTextSlide 0.3s ease forwards';
    triggerText.textContent = label;
    setTimeout(() => { triggerText.style.animation = ''; }, 400);
  }
  document.querySelectorAll('#monthly-list .custom-option').forEach(opt =>
    opt.classList.toggle('selected', opt.dataset.value === value)
  );
  const trigger = document.getElementById('monthly-trigger');
  if (trigger) {
    trigger.classList.remove('date-changed');
    void trigger.offsetWidth;
    trigger.classList.add('date-changed');
    setTimeout(() => trigger.classList.remove('date-changed'), 600);
  }
  // Sync hidden select and re-render
  const sel = document.getElementById('monthly-view');
  if (sel) sel.value = value;
  renderMonthly();
}

// ── Date change handler ────────────────────────────────────────
function onDateChange(value) {
  localStorage.setItem('selectedDate', value);
  if (!value) return;
  selectedDate = value;

  // Flash animation on the selector wrap
  const wrap = document.querySelector('.date-selector-wrap');
  if (wrap) {
    wrap.classList.remove('date-changed');
    void wrap.offsetWidth; // force reflow to restart animation
    wrap.classList.add('date-changed');
    setTimeout(() => wrap.classList.remove('date-changed'), 600);
  }

  // Animate the date label in the header
  const labels = ['standings-date','daily-date-label','motm-date-label'];
  labels.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'dateTextSlide 0.35s ease forwards';
      setTimeout(() => el.style.animation = '', 400);
    }
  });

  // Switch the commentary feed + diff baseline to the newly selected date
  initCommentary();

  const active = document.querySelector('.section.active');
  if (!active) return;
  const id = active.id.replace('sec-', '');
  if (id === 'standings')  renderStandings(false);
  if (id === 'daily')      renderDaily();
  if (id === 'motm')       renderMOTM();
}

// ── Sidebar toggle ─────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}

// ── Snapshot helpers ───────────────────────────────────────────

// Freeze CSS animations so html2canvas captures a clean frame
function freezeAnimations(el) {
  const all = el.querySelectorAll('*');
  all.forEach(n => {
    n.style.setProperty('animation', 'none', 'important');
    n.style.setProperty('transition', 'none', 'important');
    // Force fully visible — keyframe start states (opacity:0, transform) persist
    // even after animation is cancelled
    n.style.setProperty('opacity', '1', 'important');
    n.style.setProperty('transform', 'none', 'important');
  });
}
function thawAnimations(el) {
  const all = el.querySelectorAll('*');
  all.forEach(n => {
    n.style.removeProperty('animation');
    n.style.removeProperty('transition');
    n.style.removeProperty('opacity');
    n.style.removeProperty('transform');
  });
}

// Core capture — lifts element into isolated off-screen container so
// sidebar margin/scroll/padding never bleeds into the output.
// withBrand adds the gold tournament header bar (sections that don't
// already carry their own, unlike the standings snapshot).
function captureElement(el, withBrand = false) {
  freezeAnimations(el);

  const CAPTURE_WIDTH = 900;

  const wrapper = document.createElement('div');
  // capture-mode: swaps gradient-clip text (unsupported by html2canvas)
  // for solid gold and strips tilt sheen — see style.css
  wrapper.className = 'capture-mode';
  wrapper.style.cssText = `
    position:fixed; top:-9999px; left:-9999px;
    width:${CAPTURE_WIDTH}px;
    background:linear-gradient(160deg,#141b42 0%,#070b22 55%,#05081a 100%);
    padding:28px; box-sizing:border-box; z-index:-1;
    font-family:'DM Sans',sans-serif;
  `;

  // Inject CSS vars so clone resolves them correctly (detached from main doc styles)
  const varStyle = document.createElement('style');
  varStyle.textContent = `
    :root {
      --gold:#FFD75E; --gold-dark:#C9941A; --pitch:#10173a;
      --pitch-light:#232c5c; --surface:#05081a; --card:#0d1330;
      --card-border:rgba(255,215,94,0.16); --text:#f2f4ff;
      --muted:#8b93b8; --accent:#00d98b;
      --font-display:'Bebas Neue',sans-serif;
      --font-body:'DM Sans',sans-serif;
    }
    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .team-card { background:var(--card); border:1px solid var(--card-border); border-radius:14px; padding:20px; position:relative; overflow:hidden; }
    .team-card.rank-1 { border-color:var(--gold); }
    .rank-badge { position:absolute; top:12px; right:12px; font-size:48px; color:rgba(255,215,94,0.08); line-height:1; }
    .score-big { font-size:44px; color:var(--gold); line-height:1.1; }
    .team-name { font-size:22px; letter-spacing:1px; color:var(--text); }
    .score-label { font-size:11px; color:var(--muted); margin-top:2px; }
    .stat-pill { display:inline-flex; align-items:center; gap:6px; background:rgba(0,217,139,0.12); border:1px solid rgba(0,217,139,0.25); border-radius:20px; padding:4px 10px; font-size:12px; color:var(--accent); }
    .prog-wrap { margin-top:6px; }
    .prog-bar { height:4px; background:var(--pitch-light); border-radius:4px; overflow:hidden; }
    .prog-fill { height:100%; background:linear-gradient(90deg,var(--accent),var(--gold)); border-radius:4px; }
    .prog-label { display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-top:3px; }
    .members { margin-top:14px; border-top:1px solid var(--card-border); padding-top:12px; }
    .member-row { display:flex; justify-content:space-between; align-items:center; padding:5px 6px; font-size:13px; }
    .member-row .name { color:var(--text); }
    .member-row .vol { color:var(--muted); }
    .member-row .vol span { color:var(--accent); font-weight:600; }
    .working-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--accent); margin-right:6px; }
    .snap-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
    .snap-header h2 { font-size:28px; color:var(--gold); letter-spacing:1px; }
    *, *::before, *::after { animation:none !important; transition:none !important; box-sizing:border-box; margin:0; padding:0; }
  `;
  wrapper.appendChild(varStyle);

  const clone = el.cloneNode(true);

  // Drop any live tilt state carried over by the clone
  clone.classList.remove('tilt-active');
  clone.querySelectorAll('.tilt-active').forEach(n => n.classList.remove('tilt-active'));

  // Kill animations AND force visible:
  // cardFlipIn keyframe starts at opacity:0 — animation:none alone doesn't reset it.
  // cssText would also wipe the !important overrides, so use setProperty throughout.
  clone.querySelectorAll('*').forEach(n => {
    n.style.setProperty('animation', 'none', 'important');
    n.style.setProperty('transition', 'none', 'important');
    n.style.setProperty('opacity', '1', 'important');
    n.style.setProperty('transform', 'none', 'important');
  });
  clone.style.setProperty('width', '100%');
  clone.style.setProperty('background', 'transparent');
  clone.style.setProperty('padding', '0');

  const dateLabel = formatDateLabel(selectedDate) || '';

  if (withBrand) {
    const brand = document.createElement('div');
    brand.className = 'capture-brand';
    brand.innerHTML = `
      <span class="cb-trophy">&#127942;</span>
      <span class="cb-title">Team Champions World Cup</span>
      <span class="cb-date">${dateLabel}</span>`;
    wrapper.appendChild(brand);
  }

  wrapper.appendChild(clone);

  const foot = document.createElement('div');
  foot.className = 'capture-foot';
  foot.innerHTML = `
    <span>&#9917; Team Champions <b>World Cup</b></span>
    <span>${dateLabel}</span>`;
  wrapper.appendChild(foot);

  document.body.appendChild(wrapper);

  return html2canvas(wrapper, {
    backgroundColor: '#05081a',
    scale: 2,
    useCORS: true,
    allowTaint: false,
    width:  CAPTURE_WIDTH,
    height: wrapper.scrollHeight,
    scrollX: 0,
    scrollY: 0,
    windowWidth: CAPTURE_WIDTH,
  }).finally(() => {
    document.body.removeChild(wrapper);
    thawAnimations(el);
  });
}

// Share blob as file via Web Share API (mobile) or fallback (desktop)
async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: 'image/png' });

  // Mobile: try native share sheet (shares directly to WhatsApp etc)
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: '🏆 Team Champions World Cup',
        text: 'Latest standings!'
      });
      showToast('Shared!');
      return;
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('Share failed:', e);
      // Fall through to desktop path
    }
  }

  // Desktop fallback: download image + open WhatsApp Web
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  // Small delay then show WhatsApp modal
  setTimeout(() => showWAModal(), 800);
}

// WhatsApp desktop modal — user manually attaches the downloaded image
function showWAModal() {
  const existing = document.getElementById('wa-modal');
  if (existing) { existing.remove(); }

  const modal = document.createElement('div');
  modal.id = 'wa-modal';
  modal.style.cssText = `
    position:fixed; inset:0; z-index:99999;
    background:rgba(0,0,0,0.7);
    display:flex; align-items:center; justify-content:center;
    backdrop-filter:blur(4px);
    animation:fadeInUp 0.25s ease;
  `;
  modal.innerHTML = `
    <div style="
      background:#0d1330; border:1px solid rgba(255,215,94,0.3);
      border-radius:16px; padding:28px 32px; max-width:360px; width:90%;
      text-align:center; font-family:'DM Sans',sans-serif;
    ">
      <div style="font-size:40px; margin-bottom:12px;">📲</div>
      <div style="font-family:'Bebas Neue',sans-serif; font-size:22px; color:#FFD75E; margin-bottom:8px;">
        Share to WhatsApp
      </div>
      <div style="font-size:13px; color:#8b93b8; margin-bottom:20px; line-height:1.6;">
        Image downloaded! On desktop, WhatsApp can't receive files via link.<br>
        Open WhatsApp Web and attach the downloaded image manually.
      </div>
      <a href="https://web.whatsapp.com/" target="_blank" style="
        display:inline-flex; align-items:center; gap:8px;
        background:#25D366; color:#fff;
        font-weight:600; font-size:14px;
        padding:10px 22px; border-radius:10px;
        text-decoration:none; margin-bottom:12px;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.51 5.84L0 24l6.335-1.483A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.806 9.806 0 01-5.031-1.386l-.361-.214-3.741.876.939-3.634-.235-.373A9.79 9.79 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
        </svg>
        Open WhatsApp Web
      </a>
      <div>
        <button onclick="document.getElementById('wa-modal').remove()" style="
          background:transparent; border:1px solid rgba(255,215,94,0.3);
          color:#FFD75E; padding:8px 20px; border-radius:8px;
          font-size:13px; cursor:pointer; font-family:'DM Sans',sans-serif;
        ">Close</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ── Public download functions ──────────────────────────────────

async function downloadSnapshot() {
  showToast('Capturing…');
  const target = document.getElementById('snapshot-target');
  try {
    const canvas = await captureElement(target);
    canvas.toBlob(blob => {
      if (!blob) { showToast('Capture failed'); return; }
      const fname = 'standings-' + (selectedDate || today()).replace(/\//g, '-') + '.png';
      shareOrDownload(blob, fname);
    }, 'image/png');
  } catch (err) {
    console.error(err);
    showToast('Capture failed — check console');
  }
}

async function downloadSection(sectionId) {
  showToast('Capturing…');
  const target = document.getElementById(sectionId);
  try {
    const canvas = await captureElement(target, true);
    canvas.toBlob(blob => {
      if (!blob) { showToast('Capture failed'); return; }
      const fname = sectionId + '-' + today() + '.png';
      shareOrDownload(blob, fname);
    }, 'image/png');
  } catch (err) {
    console.error(err);
    showToast('Capture failed — check console');
  }
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  syncAnimToggleUI(); // reflect saved animation preference on the toggle
  syncAlertsUI();     // reflect current notification-permission state on the button
  const now      = new Date();
  const opts     = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  const sideDate = document.getElementById('side-date');
  if (sideDate) sideDate.textContent = now.toLocaleDateString('en-IN', opts);
  const sideMonth = document.getElementById('side-month');
  if (sideMonth) sideMonth.textContent = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Detect file:// protocol — Google Sheets CSV fetch will always fail due to CORS
  if (location.protocol === 'file:') {
    showFetchError('file-protocol');
    const loadScreen = document.getElementById('loading-screen');
    if (loadScreen) loadScreen.classList.add('hidden');
    return;
  }

  try {
    await getLiveData();
    initCommentary();      // seed baseline + load this date's saved feed
    renderStandings(true);
  } catch (err) {
    console.error('Failed to load sheet data:', err);
    const isOffline = !navigator.onLine || err.message?.includes('fetch');
    showFetchError(isOffline ? 'offline' : 'unknown');
  }

  const loadScreen = document.getElementById('loading-screen');
  if (loadScreen) {
    // 2.4s gives cinematic intro enough time to play fully
    setTimeout(() => loadScreen.classList.add('hidden'), 2400);
  }
}

function showFetchError(type) {
  const msgs = {
    'file-protocol': {
      icon: '🗂️',
      title: 'Open via a local server',
      body: `You're running from <code>file://</code> — browsers block Google Sheets fetch on file:// due to CORS.<br><br>
             <b>Fix:</b> Run a local server in this folder:<br>
             <code style="display:block;margin-top:8px;padding:8px;background:#070b22;border-radius:6px;">
               python -m http.server 8080
             </code>
             Then open <code>http://localhost:8080</code> in your browser.`
    },
    'offline': {
      icon: '📡',
      title: 'No internet connection',
      body: `Can't reach Google Sheets. Check your connection and <a href="javascript:location.reload()" style="color:var(--gold)">reload</a>.`
    },
    'unknown': {
      icon: '⚠️',
      title: 'Could not load data',
      body: `Google Sheets fetch failed. Make sure your CSV URLs are published publicly.<br><br>
             <a href="javascript:location.reload()" style="color:var(--gold)">Try reloading</a>`
    }
  };

  const m = msgs[type] || msgs['unknown'];
  const grid = document.getElementById('team-cards-grid');
  if (grid) {
    grid.style.gridColumn = '1 / -1';
    grid.innerHTML = `
      <div style="
        background:var(--card); border:1px solid rgba(255,84,112,0.3);
        border-radius:14px; padding:32px; text-align:center;
        grid-column:1/-1;
      ">
        <div style="font-size:40px;margin-bottom:12px;">${m.icon}</div>
        <div style="font-family:var(--font-display);font-size:22px;color:#ff5470;margin-bottom:12px;">${m.title}</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;max-width:480px;margin:0 auto;">${m.body}</div>
      </div>`;
  }

  const loadScreen = document.getElementById('loading-screen');
  if (loadScreen) loadScreen.classList.add('hidden');
}

// ── LIVE AUTO-REFRESH ────────────────────────────────────────
let _lastScoreHash = '';
let _lastTopPlayer = '';
let _lastLeader = '';
let _notifGranted = false;

function scoreHash(players) {
  const ranked = (players || [])
    .filter(p => p.working)
    .map(p => p.name + ':' + p.vol)
    .sort().join('|');
  return ranked;
}

function teamLeader(players) {
  return [...(window.TEAM_ORDER_REF || ['ARGENTINA','PORTUGAL','BRAZIL','SPAIN'])]
    .map(t => ({ t, s: getTeamScore(players, t) }))
    .sort((a, b) => b.s - a.s)[0]?.t || '';
}

function topPlayer(players) {
  return [...players].filter(p => p.working && p.vol > 0)
    .sort((a, b) => b.vol - a.vol)[0] || null;
}

// App-level alerts on/off preference. The browser permission can't be revoked
// by a page, so we keep our own mute switch: alerts fire only when permission
// is granted AND the user hasn't muted them here.
const ALERTS_PREF_KEY = 'tcwc_alerts';
let _alertsEnabled = false;

function alertsActive() {
  return _notifGranted && _alertsEnabled;
}

// Reflect permission + saved preference on the button WITHOUT prompting
// (safe to call on load and after any change).
function syncAlertsUI() {
  const supported = 'Notification' in window;
  const perm = supported ? Notification.permission : 'unsupported';
  _notifGranted = supported && perm === 'granted';
  if (perm === 'granted') {
    const saved = localStorage.getItem(ALERTS_PREF_KEY);
    _alertsEnabled = saved === null ? true : saved === 'on'; // default ON once allowed
  } else {
    _alertsEnabled = false;
  }

  const btn = document.getElementById('alerts-btn');
  if (!btn) return;
  const on = alertsActive();
  btn.classList.toggle('is-on', on);
  btn.classList.toggle('is-blocked', perm === 'denied' || perm === 'unsupported');
  btn.setAttribute('aria-pressed', String(on));
  const ic = btn.querySelector('.alerts-ic');
  if (ic) ic.textContent = on ? '🔔' : '🔕';
  const label = btn.querySelector('.alerts-label');
  if (label) {
    label.textContent =
      perm === 'denied'      ? 'Alerts blocked' :
      perm === 'unsupported' ? 'No alerts'      :
      perm === 'default'     ? 'Enable alerts'  :
      on                     ? 'Alerts on'      :
                               'Alerts off';
  }
}

// Click handler: requests permission the first time, then toggles on/off.
// Only ever called from a user click (browsers suppress auto-prompts).
async function toggleAlerts() {
  if (!('Notification' in window)) {
    showToast('Notifications aren’t supported on this device');
    syncAlertsUI();
    return;
  }
  if (Notification.permission === 'denied') {
    showToast('Alerts are blocked — turn them on in your browser settings');
    syncAlertsUI();
    return;
  }
  if (Notification.permission === 'default') {
    const p = await Notification.requestPermission();
    if (p === 'granted') {
      localStorage.setItem(ALERTS_PREF_KEY, 'on');
      showToast('Alerts on 🔔');
    } else {
      showToast('Alerts not enabled');
    }
    syncAlertsUI();
    return;
  }
  // Permission already granted → flip our app-level mute switch
  const turnOn = !_alertsEnabled;
  localStorage.setItem(ALERTS_PREF_KEY, turnOn ? 'on' : 'off');
  syncAlertsUI();
  showToast(turnOn ? 'Alerts on 🔔' : 'Alerts off 🔕');
}

function pushNotif(title, body, icon = '🏆') {
  // Always show in-app toast
  showToast(title);
  if (!alertsActive() || document.visibilityState === 'visible') return;
  try {
    new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>' + icon + '</text></svg>' });
  } catch(e) {}
}

// ── LIVE COMMENTARY ENGINE ───────────────────────────────────
// Diffs each refresh against the last seen state and turns the changes into
// broadcast-style commentary lines. The feed persists per date in localStorage
// so it survives reloads. Big moments also fire toasts / browser notifications.
const COMMENTARY_CAP = 60;
let commentaryLog = [];      // [{ icon, text, kind, ts }] newest first, for selectedDate
let _prevPlayers  = null;    // baseline snapshot map for diffing

const GOAL_LINES = [
  'GOAL! {name} nets +{delta} for {team} — {vol} FTD on the board!',
  'What a finish from {name}! +{delta} ({vol} total) for {team}.',
  '{name} buries it! {team} up by +{delta}, now on {vol}.',
  'Clinical from {name} — +{delta} FTD, tally climbs to {vol}.',
  '{name} strikes again for {team}! +{delta} → {vol} FTD.'
];
const SUBON_LINES = [
  '{name} steps onto the pitch for {team}.',
  '{team} send on {name} — ready to make an impact.',
  '{name} is in the game for {team}.'
];
const SUBOFF_LINES = [
  '{name} heads off the pitch.',
  '{name} is subbed off for {team}.'
];
const LEADER_LINES = [
  '{team} STORM to the top of the table!',
  'New leaders! {team} hit the summit.',
  '{team} seize first place — what a turnaround!'
];
const TOP_LINES = [
  '{name} is ON FIRE — leads the Golden Boot race with {vol}!',
  '{name} surges clear at the top of the scorers — {vol} FTD!',
  '{name} grabs the Golden Boot lead with {vol}!'
];

function pickLine(pool, vars) {
  const t = pool[Math.floor(Math.random() * pool.length)];
  return t.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
}

function snapshotMap(players) {
  const m = {};
  players.forEach(p => { m[p.name] = { vol: p.vol, working: p.working, team: p.team }; });
  return m;
}

function commentaryKey(date) { return 'tcwc_commentary_' + date; }
function loadCommentaryLog(date) {
  try { return JSON.parse(localStorage.getItem(commentaryKey(date)) || '[]'); }
  catch (e) { return []; }
}
function saveCommentaryLog(date) {
  try { localStorage.setItem(commentaryKey(date), JSON.stringify(commentaryLog.slice(0, COMMENTARY_CAP))); }
  catch (e) {}
}

function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function renderCommentary() {
  const feed = document.getElementById('commentary-feed');
  if (!feed) return;
  if (!commentaryLog.length) {
    feed.innerHTML = '<div class="commentary-empty">Waiting for the next big moment… new deposits show up here live.</div>';
    return;
  }
  feed.innerHTML = commentaryLog.map((e, i) => `
    <div class="commentary-line kind-${e.kind}${i === 0 ? ' is-new' : ''}">
      <span class="commentary-ic">${e.icon}</span>
      <span class="commentary-tx">${e.text}</span>
      <span class="commentary-ts">${fmtClock(e.ts)}</span>
    </div>`).join('');
}

function addCommentary(events) {
  if (!events || !events.length) return;
  const now = Date.now();
  events.forEach(e => commentaryLog.unshift({ ...e, ts: now }));
  commentaryLog = commentaryLog.slice(0, COMMENTARY_CAP);
  saveCommentaryLog(selectedDate);
  renderCommentary();
}

function hasLeaderboardActivity(players) {
  return players.some(p => p.working && p.vol > 0);
}

function buildCommentaryEvents(prev, curr) {
  const events = [];
  curr.forEach(p => {
    const before = prev[p.name];
    if (!before) return; // unknown baseline — skip to avoid a flood of fake goals
    if (p.vol > before.vol) {
      events.push({ kind: 'goal', icon: '⚽',
        text: pickLine(GOAL_LINES, { name: p.name, team: p.team, delta: p.vol - before.vol, vol: p.vol }) });
    }
    if (p.working && !before.working) {
      events.push({ kind: 'sub', icon: '🟢', text: pickLine(SUBON_LINES, { name: p.name, team: p.team }) });
    } else if (!p.working && before.working) {
      events.push({ kind: 'suboff', icon: '⚪', text: pickLine(SUBOFF_LINES, { name: p.name, team: p.team }) });
    }
  });
  return events;
}

// Seed/reset the baseline + feed for the currently selected date (no events).
function initCommentary() {
  commentaryLog = loadCommentaryLog(selectedDate);
  const players  = buildPlayersForDate(selectedDate);
  _prevPlayers   = snapshotMap(players);
  _lastLeader    = teamLeader(players);
  _lastTopPlayer = topPlayer(players)?.name || '';
  renderCommentary();
}

// Compare the latest data to the baseline and emit commentary + side effects.
function commentaryTick() {
  const players = buildPlayersForDate(selectedDate);
  if (!_prevPlayers) { initCommentary(); return; } // first run = baseline only

  const events = buildCommentaryEvents(_prevPlayers, players);

  const leader = teamLeader(players);
  if (leader && leader !== _lastLeader && hasLeaderboardActivity(players)) {
    events.push({ kind: 'leader', icon: '🏆', text: pickLine(LEADER_LINES, { team: leader }) });
  }
  const top = topPlayer(players);
  if (top && top.name !== _lastTopPlayer) {
    events.push({ kind: 'top', icon: '🔥', text: pickLine(TOP_LINES, { name: top.name, vol: top.vol, team: top.team }) });
  }

  if (events.length) {
    addCommentary(events);

    // Fire ONE side effect per tick (most important wins) to avoid toast spam.
    const leaderEv = events.find(e => e.kind === 'leader');
    const goalEv   = events.find(e => e.kind === 'goal');
    const topEv    = events.find(e => e.kind === 'top');
    if (leaderEv) {
      showGoalBanner(leader);
      launchConfetti(3000);
      pushNotif(`🏆 ${leader} takes the lead!`, leaderEv.text, '🏆');
    } else if (goalEv) {
      pushNotif('⚽ ' + goalEv.text, goalEv.text, '⚽');
    } else if (topEv) {
      pushNotif('🔥 ' + topEv.text, topEv.text, '🔥');
    }
  }

  _prevPlayers   = snapshotMap(players);
  _lastLeader    = leader;
  _lastTopPlayer = top?.name || '';
}

async function silentRefresh() {
  if (location.protocol === 'file:') return;
  try {
    await getLiveData();

    // Generate live commentary from what changed
    commentaryTick();

    // Re-render whatever section is visible so the board reflects fresh data
    const active = document.querySelector('.section.active');
    if (active) {
      const id = active.id.replace('sec-', '');
      if (id === 'standings')  renderStandings(false);
      if (id === 'daily')      renderDaily();
      if (id === 'motm')       renderMOTM();
      if (id === 'monthly')    renderMonthly();
      if (id === 'performers') renderPerformers();
      if (id === 'history')    renderHistory();
    }

    // Update live indicator with last refresh time
    const liveLabel = document.getElementById('standings-date');
    if (liveLabel) {
      const t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      liveLabel.textContent = 'Last updated: ' + t;
    }
  } catch (e) {
    console.warn('Silent refresh failed:', e);
  }
}

// Kick off
// Notification permission is now requested on user click (see enableAlerts),
// not automatically on load.
setInterval(silentRefresh, 30 * 1000); // every 30s, no page reload — keeps commentary live

init();