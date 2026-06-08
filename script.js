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

// ── FIFA: Confetti ─────────────────────────────────────────────
function launchConfetti(duration = 3000) {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.classList.add('active');

  const colors = ['#F5C842','#4CAF7D','#ffffff','#e05555','#8aaa95'];
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
  const [playersRes, entriesRes] = await Promise.all([
    fetch(PLAYERS_URL),
    fetch(SHEET_URL)
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
    if (!prev || new Date(timestamp) > new Date(prev)) {
      snapshot[playerName].timestamp = timestamp;
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

  } else {
    if (headerRow) headerRow.innerHTML = `
      <th>#</th><th>Team</th><th>Wins</th><th>Total Volume</th>`;

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

  if (window.innerWidth < 640) {
    document.getElementById('sidebar')?.classList.remove('open');
  }
}

// ── Date change handler ────────────────────────────────────────
function onDateChange(value) {
  localStorage.setItem('selectedDate', value);
  if (!value) return;
  selectedDate = value;
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
// sidebar margin/scroll/padding never bleeds into the output
function captureElement(el) {
  freezeAnimations(el);

  const CAPTURE_WIDTH = 900;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position:fixed; top:-9999px; left:-9999px;
    width:${CAPTURE_WIDTH}px; background:#0f1f16;
    padding:24px; box-sizing:border-box; z-index:-1;
    font-family:'DM Sans',sans-serif;
  `;

  // Inject CSS vars so clone resolves them correctly (detached from main doc styles)
  const varStyle = document.createElement('style');
  varStyle.textContent = `
    :root {
      --gold:#F5C842; --gold-dark:#C9941A; --pitch:#1a3a2a;
      --pitch-light:#2d5c3a; --surface:#0f1f16; --card:#162b1e;
      --card-border:rgba(245,200,66,0.15); --text:#f0f0e8;
      --muted:#8aaa95; --accent:#4CAF7D;
      --font-display:'Bebas Neue',sans-serif;
      --font-body:'DM Sans',sans-serif;
    }
    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .team-card { background:var(--card); border:1px solid var(--card-border); border-radius:14px; padding:20px; position:relative; overflow:hidden; }
    .team-card.rank-1 { border-color:var(--gold); }
    .rank-badge { position:absolute; top:12px; right:12px; font-size:48px; color:rgba(245,200,66,0.08); line-height:1; }
    .score-big { font-size:44px; color:var(--gold); line-height:1.1; }
    .team-name { font-size:22px; letter-spacing:1px; color:var(--text); }
    .score-label { font-size:11px; color:var(--muted); margin-top:2px; }
    .stat-pill { display:inline-flex; align-items:center; gap:6px; background:rgba(76,175,125,0.12); border:1px solid rgba(76,175,125,0.25); border-radius:20px; padding:4px 10px; font-size:12px; color:var(--accent); }
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

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  return html2canvas(wrapper, {
    backgroundColor: '#0f1f16',
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
      background:#162b1e; border:1px solid rgba(245,200,66,0.3);
      border-radius:16px; padding:28px 32px; max-width:360px; width:90%;
      text-align:center; font-family:'DM Sans',sans-serif;
    ">
      <div style="font-size:40px; margin-bottom:12px;">📲</div>
      <div style="font-family:'Bebas Neue',sans-serif; font-size:22px; color:#F5C842; margin-bottom:8px;">
        Share to WhatsApp
      </div>
      <div style="font-size:13px; color:#8aaa95; margin-bottom:20px; line-height:1.6;">
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
          background:transparent; border:1px solid rgba(245,200,66,0.3);
          color:#F5C842; padding:8px 20px; border-radius:8px;
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
    const canvas = await captureElement(target);
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
  // Sidebar date
  const now     = new Date();
  const opts    = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
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

  // Only render the default active section (standings) — others lazy-render on nav click
  renderStandings(true); // true = trigger celebration on load

  // Hide loading screen
  const loadScreen = document.getElementById('loading-screen');
  if (loadScreen) {
    setTimeout(() => loadScreen.classList.add('hidden'), 1200);
  }
}

// Auto-refresh every 5 minutes
setInterval(() => location.reload(), 5 * 60 * 1000);

init();