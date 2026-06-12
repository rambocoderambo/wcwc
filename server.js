const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ---------- CACHE ----------
const cache = { ttl: 30 * 1000 };
function getCached(key) {
  const c = cache[key];
  if (c && Date.now() - c.ts < cache.ttl) return c.data;
  return null;
}
function setCache(key, data) { cache[key] = { data, ts: Date.now() }; }

// ---------- TEAM NAME MAPPING ----------
// Maps from various API/spelling to our canonical names
const NAME_ALIASES = {
  'usa': 'United States', 'united states': 'United States', 'united states of america': 'United States',
  'south korea': 'South Korea', 'korea republic': 'South Korea', 'korea': 'South Korea',
  'czech republic': 'Czech Republic', 'czechia': 'Czech Republic',
  'ivory coast': 'Ivory Coast', "côte d'ivoire": 'Ivory Coast', 'cote d\'ivoire': 'Ivory Coast',
   'dr congo': 'DR Congo', 'congo dr': 'DR Congo', 'drc': 'DR Congo', 'congo drc': 'DR Congo', 'd.r. congo': 'DR Congo', 'democratic rep congo': 'DR Congo',
  'netherlands': 'Netherlands', 'holland': 'Netherlands',
  'turkey': 'Turkey', 'türkiye': 'Turkey', 'turkiye': 'Turkey',
  'cape verde': 'Cape Verde', 'cabo verde': 'Cape Verde',
   'bosnia and herzegovina': 'Bosnia and Herzegovina', 'bosnia': 'Bosnia and Herzegovina', 'bosnia & herzegovina': 'Bosnia and Herzegovina', 'bosnia herzegovina': 'Bosnia and Herzegovina',
  'saudi arabia': 'Saudi Arabia', 'saudi': 'Saudi Arabia',
  'new zealand': 'New Zealand',
  'curacao': 'Curaçao', 'curaçao': 'Curaçao',
   'south africa': 'South Africa',
   'mexico': 'Mexico', 'canada': 'Canada', 'brazil': 'Brazil',
  'morocco': 'Morocco', 'haiti': 'Haiti', 'scotland': 'Scotland',
  'paraguay': 'Paraguay', 'australia': 'Australia',
  'germany': 'Germany', 'ecuador': 'Ecuador',
  'japan': 'Japan', 'sweden': 'Sweden', 'tunisia': 'Tunisia',
  'belgium': 'Belgium', 'egypt': 'Egypt', 'iran': 'Iran',
  'spain': 'Spain', 'uruguay': 'Uruguay',
  'france': 'France', 'senegal': 'Senegal', 'iraq': 'Iraq', 'norway': 'Norway',
  'argentina': 'Argentina', 'algeria': 'Algeria', 'austria': 'Austria', 'jordan': 'Jordan',
  'portugal': 'Portugal', 'uzbekistan': 'Uzbekistan', 'colombia': 'Colombia',
  'england': 'England', 'croatia': 'Croatia', 'ghana': 'Ghana', 'panama': 'Panama',
  'qatar': 'Qatar', 'switzerland': 'Switzerland',
};

const CANONICAL_TEAMS = new Set(Object.values(NAME_ALIASES));

function normalizeName(raw) {
  const key = raw.trim().toLowerCase();
  return NAME_ALIASES[key] || raw.trim();
}

// ---------- 365SCORES API ----------
async function fetch365scores() {
  const url = 'https://webws.365scores.com/web/games/?langId=1&timezoneName=UTC&userCountryId=21&appType=2&days=0&showOdds=false&showLive=true';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!res.ok) throw new Error(`365scores ${res.status}`);
  const raw = await res.json();
  if (!raw) return [];

  // 365scores can have games in different places: sports[].games, groups[], or top-level games[]
  const games = raw.games || [];
  // Also check sports[*].games
  if (raw.sports) {
    for (const sport of raw.sports) {
      if (sport.name !== 'Football') continue;
      if (sport.games) games.push(...sport.games);
      if (sport.groups) {
        for (const group of sport.groups) {
          if (group.games) games.push(...group.games);
        }
      }
    }
  }

  const matches = [];
  for (const g of games) {
    const homeName = g.homeCompetitor?.name || g.home?.name;
    const awayName = g.awayCompetitor?.name || g.away?.name;
    if (!homeName || !awayName) continue;
    const home = normalizeName(homeName);
    const away = normalizeName(awayName);
    if (!CANONICAL_TEAMS.has(home) || !CANONICAL_TEAMS.has(away)) continue;

    const statusId = g.status?.id || g.status || 1;
    let matchStatus = 'UPCOMING';
    if (statusId === 3) matchStatus = 'LIVE';
    else if ([5, 6, 7].includes(statusId)) matchStatus = 'FT';

    const homeScore = g.homeCompetitor?.score ?? g.home?.score ?? null;
    const awayScore = g.awayCompetitor?.score ?? g.away?.score ?? null;

    matches.push({
      home, away,
      homeScore: homeScore !== null ? parseInt(homeScore) : null,
      awayScore: awayScore !== null ? parseInt(awayScore) : null,
      status: matchStatus,
      date: g.startTime || g.startDate || null,
      source: '365scores'
    });
  }
  return matches;
}

// ---------- OPENGOLIDB API ----------
async function fetchOpenLigaDB() {
  const url = 'https://api.openligadb.de/getmatchdata/wm26/2026';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WC2026-Scoreboard/1.0' }
  });
  if (!res.ok) throw new Error(`OpenLigaDB ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map(m => {
    const home = normalizeName(m.team1?.teamName || '');
    const away = normalizeName(m.team2?.teamName || '');
    const results = m.matchResults || [];
    const ftResult = results.find(r => r.resultTypeId === 2);
    const homeScore = ftResult ? parseInt(ftResult.pointsTeam1) : null;
    const awayScore = ftResult ? parseInt(ftResult.pointsTeam2) : null;

    let status = 'UPCOMING';
    if (m.matchIsFinished) status = 'FT';
    else if (m.matchDateTime && new Date(m.matchDateTime) <= new Date()) status = 'LIVE';

    return {
      home, away, homeScore, awayScore, status,
      date: m.matchDateTime || null,
      source: 'openligadb'
    };
  }).filter(m => CANONICAL_TEAMS.has(m.home) && CANONICAL_TEAMS.has(m.away));
}

// ---------- BBC SPORT SCRAPE ----------
async function fetchBBC() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const urls = [
    `https://www.bbc.com/sport/football/world-cup/scores-fixtures/${dateStr}`,
    `https://www.bbc.com/sport/football/scores-fixtures/${dateStr}`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      const matches = [];

      $('[data-score], [data-result]').each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        const scoreMatch = text.match(/(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+(.+)/);
        if (scoreMatch) {
          const home = normalizeName(scoreMatch[1].trim());
          const away = normalizeName(scoreMatch[4].trim());
          if (CANONICAL_TEAMS.has(home) && CANONICAL_TEAMS.has(away)) {
            matches.push({
              home, away,
              homeScore: parseInt(scoreMatch[2]),
              awayScore: parseInt(scoreMatch[3]),
              status: 'FT',
              date: null, source: 'bbc'
            });
          }
        }
      });

      $('.sp-c-fixture').each((_, el) => {
        const $el = $(el);
        const teams = [];
        const scores = [];
        $el.find('.sp-c-fixture__team').each((_, t) => teams.push($(t).text().trim()));
        $el.find('.sp-c-fixture__number').each((_, s) => scores.push($(t).text().trim()));
        if (teams.length === 2 && scores.length === 2) {
          const home = normalizeName(teams[0]);
          const away = normalizeName(teams[1]);
          if (CANONICAL_TEAMS.has(home) && CANONICAL_TEAMS.has(away)) {
            matches.push({
              home, away,
              homeScore: parseInt(scores[0]),
              awayScore: parseInt(scores[1]),
              status: 'FT',
              date: null, source: 'bbc'
            });
          }
        }
      });

      if (matches.length > 0) return matches;
    } catch (e) { /* continue to next url */ }
  }
  return [];
}

// ---------- SIMULATION ----------
const TEAM_STRENGTH = {
  'Argentina': 92, 'France': 91, 'Brazil': 90, 'England': 88, 'Belgium': 87,
  'Netherlands': 86, 'Portugal': 85, 'Spain': 84, 'Germany': 83, 'Croatia': 82,
  'Mexico': 78, 'United States': 76, 'Japan': 75, 'Morocco': 74, 'Senegal': 73,
  'Switzerland': 72, 'Uruguay': 72, 'Colombia': 71, 'Ecuador': 70,
  'Canada': 68, 'Australia': 67, 'Sweden': 66, 'Iran': 65, 'South Korea': 65,
  'Saudi Arabia': 64, 'Turkey': 63, 'Norway': 62,
  'Czech Republic': 69, 'Ivory Coast': 69, 'Egypt': 68, 'Ghana': 68,
  'Scotland': 67, 'Paraguay': 66, 'Tunisia': 66, 'Bosnia and Herzegovina': 65,
  'South Africa': 64, 'Qatar': 63, 'Curaçao': 62, 'Cape Verde': 61,
  'Iraq': 60, 'Algeria': 59, 'Austria': 59, 'Jordan': 58,
  'Haiti': 55, 'New Zealand': 54, 'Panama': 53, 'DR Congo': 52,
  'Uzbekistan': 51,
};

function simulateScore(homeStr, awayStr) {
  const hStr = TEAM_STRENGTH[homeStr] || 65;
  const aStr = TEAM_STRENGTH[awayStr] || 65;

  // Expected goals based on relative strength + home advantage
  const hPower = Math.pow(hStr + 5, 2);
  const aPower = Math.pow(aStr, 2);
  const homeShare = hPower / (hPower + aPower);

  // Random total goals (2.0-4.5 range, weighted toward lower end)
  const totalGoals = 1.8 + Math.random() * 2.7;

  const homeExpected = Math.max(0.2, totalGoals * homeShare);
  const awayExpected = Math.max(0.2, totalGoals * (1 - homeShare));

  // Poisson distribution for realistic football scores
  function poisson(lambda) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return Math.min(k - 1, 10);
  }

  return { home: poisson(homeExpected), away: poisson(awayExpected) };
}

// Hardcoded group matchups from the HTML
const GROUPS = [
  {name:'A',teams:['Mexico','South Africa','South Korea','Czech Republic']},
  {name:'B',teams:['Canada','Bosnia and Herzegovina','Qatar','Switzerland']},
  {name:'C',teams:['Brazil','Morocco','Haiti','Scotland']},
  {name:'D',teams:['United States','Paraguay','Australia','Turkey']},
  {name:'E',teams:['Germany','Curaçao','Ivory Coast','Ecuador']},
  {name:'F',teams:['Netherlands','Japan','Sweden','Tunisia']},
  {name:'G',teams:['Belgium','Egypt','Iran','New Zealand']},
  {name:'H',teams:['Spain','Cape Verde','Saudi Arabia','Uruguay']},
  {name:'I',teams:['France','Senegal','Iraq','Norway']},
  {name:'J',teams:['Argentina','Algeria','Austria','Jordan']},
  {name:'K',teams:['Portugal','DR Congo','Uzbekistan','Colombia']},
  {name:'L',teams:['England','Croatia','Ghana','Panama']}
];
const PAIRINGS = [[0,1],[2,3],[1,3],[0,2],[3,0],[2,1]];
const MATCH_TIMES = [
  ['Jun 12 03:00','Jun 12 10:00','Jun 19 00:00','Jun 19 09:00','Jun 25 09:00','Jun 25 09:00'],
  ['Jun 13 03:00','Jun 14 03:00','Jun 19 03:00','Jun 19 06:00','Jun 25 03:00','Jun 25 03:00'],
  ['Jun 14 06:00','Jun 14 09:00','Jun 20 06:00','Jun 20 08:30','Jun 25 06:00','Jun 25 06:00'],
  ['Jun 13 09:00','Jun 14 12:00','Jun 20 03:00','Jun 20 11:00','Jun 26 10:00','Jun 26 10:00'],
  ['Jun 15 01:00','Jun 15 07:00','Jun 21 04:00','Jun 21 08:00','Jun 26 04:00','Jun 26 04:00'],
  ['Jun 15 04:00','Jun 15 10:00','Jun 21 01:00','Jun 21 12:00','Jun 26 07:00','Jun 26 07:00'],
  ['Jun 16 03:00','Jun 16 09:00','Jun 22 03:00','Jun 22 09:00','Jun 27 11:00','Jun 27 11:00'],
  ['Jun 16 00:00','Jun 16 06:00','Jun 22 00:00','Jun 22 06:00','Jun 27 08:00','Jun 27 08:00'],
  ['Jun 17 03:00','Jun 17 06:00','Jun 23 05:00','Jun 23 08:00','Jun 27 03:00','Jun 27 03:00'],
  ['Jun 17 09:00','Jun 17 12:00','Jun 23 01:00','Jun 23 11:00','Jun 28 10:00','Jun 28 10:00'],
  ['Jun 18 01:00','Jun 18 10:00','Jun 24 01:00','Jun 24 10:00','Jun 28 07:30','Jun 28 07:30'],
  ['Jun 18 04:00','Jun 18 07:00','Jun 24 04:00','Jun 24 07:00','Jun 28 05:00','Jun 28 05:00'],
];

function parseMatchTime(str) {
  const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const parts = str.split(' ');
  const month = months[parts[0]];
  const day = parseInt(parts[1]);
  const [h, m] = parts[2].split(':').map(Number);
  return new Date(2026, month, day, h, m).getTime();
}

function getSimulatedMatches() {
  const now = Date.now();
  const matches = [];

  GROUPS.forEach((g, gi) => {
    for (let m = 0; m < 6; m++) {
      const home = g.teams[PAIRINGS[m][0]];
      const away = g.teams[PAIRINGS[m][1]];
      const matchStart = parseMatchTime(MATCH_TIMES[gi][m]);
      const matchEnd = matchStart + 110 * 60 * 1000;
      const key = g.name + '_' + m;

      let status = 'UPCOMING';
      let homeScore = null, awayScore = null;

      if (now >= matchStart && now < matchEnd) {
        status = 'LIVE';
        const s = simulateScore(home, away);
        const progress = Math.min((now - matchStart) / (110 * 60 * 1000), 1);
        homeScore = Math.round(s.home * progress);
        awayScore = Math.round(s.away * progress);
      } else if (now >= matchEnd) {
        status = 'FT';
        const s = simulateScore(home, away);
        homeScore = s.home;
        awayScore = s.away;
      }

      matches.push({home, away, homeScore, awayScore, status, date: new Date(matchStart).toISOString(), source: 'simulation'});
    }
  });

  return matches;
}

// ---------- ASIAN HANDICAP ODDS ----------
const AH_CACHE = { ttl: 120 * 1000, data: null, ts: 0 };

function handicapToFraction(h) {
  if (h === 0) return '0';
  const whole = Math.floor(h);
  const frac = Math.round((h - whole) * 100);
  if (frac === 0) return String(whole);
  if (whole === 0) {
    if (frac === 25) return '1/4';
    if (frac === 50) return '1/2';
    if (frac === 75) return '3/4';
  }
  if (frac === 25) return `${whole} 1/4`;
  if (frac === 50) return `${whole} 1/2`;
  if (frac === 75) return `${whole} 3/4`;
  return String(h);
}

async function scrapeClassicAsianBookie() {
  const cloudscraper = require('cloudscraper');

  await cloudscraper.get({
    uri: 'https://beta.asianbookie.com/en/world-cup',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    simple: false
  });

  const html = await cloudscraper.get({
    uri: 'https://asianbookie.com/index.cfm/World-Cup/?league=4&tz=8',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Cookie': 'CLASSIC=1'
    }
  });

  const $ = cheerio.load(html);
  $('script, style, link, meta, noscript, iframe').remove();
  const text = $('body').text();
  const lines = text.split('\n').map(l => l.trim());

  const results = new Map();
  for (let i = 0; i < lines.length - 9; i++) {
    if (lines[i] !== 'vs') continue;
    const team1 = lines[i - 1] || '';
    const team2 = lines[i + 2] || '';
    if (!team1 || !team2 || /^[\d.]+$/.test(team1) || /^[\d.]+$/.test(team2)) continue;
    const ahLine = lines[i + 9] || '';
    if (!ahLine.includes(':') || !/[\d\/]/.test(ahLine)) continue;

    const home = normalizeName(team1);
    const away = normalizeName(team2);
    if (!CANONICAL_TEAMS.has(home) || !CANONICAL_TEAMS.has(away)) continue;
    const key = home + '|' + away;
    if (results.has(key)) continue;

    results.set(key, { home, away, ah_line: ahLine, bookmaker: 'AsianBookie', source: 'AsianBookie' });
  }
  return Array.from(results.values());
}

async function getOdds() {
  const cached = AH_CACHE.data && (Date.now() - AH_CACHE.ts < AH_CACHE.ttl);
  if (cached) return AH_CACHE.data;

  const data = await scrapeClassicAsianBookie();
  AH_CACHE.data = data;
  AH_CACHE.ts = Date.now();
  return data;
}

// ---------- SOURCE ROUTER ----------
const SOURCES = [
  { name: '365scores', fn: fetch365scores },
  { name: 'openligadb', fn: fetchOpenLigaDB },
  { name: 'bbc', fn: fetchBBC },
];

async function getMatches() {
  const cached = getCached('matches');
  if (cached) return cached;

  for (const source of SOURCES) {
    try {
      const matches = await source.fn();
      if (matches && matches.length > 0) {
        setCache('matches', { matches, source: source.name });
        return { matches, source: source.name };
      }
    } catch (e) {
      console.log(`Source ${source.name} failed: ${e.message}`);
    }
  }

  return { matches: [], source: 'none' };
}

function getSimulated() {
  return { matches: getSimulatedMatches(), source: 'simulation' };
}

// ---------- ROUTES ----------
app.get('/api/matches', async (req, res) => {
  try {
    const result = await getMatches();
    res.json(result);
  } catch (e) {
    const fallback = getSimulated();
    res.json(fallback);
  }
});

app.get('/api/simulate', (req, res) => {
  try {
    res.json(getSimulated());
  } catch (e) {
    res.json({ matches: [], source: 'simulation-error', error: e.message });
  }
});

app.get('/api/status', async (req, res) => {
  const result = await getMatches();
  res.json({
    mode: result.source,
    matchCount: result.matches.length,
    liveCount: result.matches.filter(m => m.status === 'LIVE').length,
    ts: Date.now()
  });
});

app.get('/api/odds', async (req, res) => {
  try {
    const odds = await getOdds();
    res.json({ odds, count: odds.length, ts: Date.now() });
  } catch (e) {
    res.status(502).json({ error: e.message, odds: [], count: 0, ts: Date.now() });
  }
});

if (require.main === module) {
  // Serve static frontend when running directly
  app.use(express.static(__dirname));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const html = require('path').join(__dirname, 'index.html');
    if (require('fs').existsSync(html)) {
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.sendFile(html);
    } else next();
  });

  app.listen(PORT, () => {
    console.log(`WC 2026 Live Score Server running on http://localhost:${PORT}`);
    console.log(`Endpoints:`);
    console.log(`  GET /api/matches   - all matches with live scores`);
    console.log(`  GET /api/simulate  - simulated matches`);
    console.log(`  GET /api/status    - server status`);
    console.log(`  GET /api/odds      - Asian Handicap odds`);
  });
}

module.exports = app;
