const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ---------- CACHE ----------
const cache = { ttl: 120 * 1000 };

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
   'mexiko': 'Mexico', 'südafrika': 'South Africa', 'suedafrika': 'South Africa',
   'südkorea': 'South Korea', 'suedkorea': 'South Korea',
   'tschechien': 'Czech Republic', 'kanada': 'Canada',
   'bosnien und herzegowina': 'Bosnia and Herzegovina',
   'kroatien': 'Croatia', 'niederlande': 'Netherlands',
   'spanien': 'Spain', 'portugal': 'Portugal', 'frankreich': 'France',
   'argentinien': 'Argentina', 'deutschland': 'Germany', 'england': 'England',
   'belgien': 'Belgium', 'schweiz': 'Switzerland', 'schweden': 'Sweden',
   'ecuador': 'Ecuador', 'japan': 'Japan', 'iran': 'Iran',
   'brasilien': 'Brazil', 'marokko': 'Morocco', 'schottland': 'Scotland',
   'australien': 'Australia', 'türkei': 'Turkey', 'tuerkei': 'Turkey',
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

function isWorldCupMatch(home, away) {
  return WC_MATCH_KEYS.has(home + '|' + away);
}

function sanitizeScore(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(val);
  if (isNaN(n) || n < 0) return null;
  return n;
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

    // Verify this is actually a World Cup group match by checking against known pairings
    if (!isWorldCupMatch(home, away)) continue;

    const statusId = g.status?.id || g.status || 1;
    let matchStatus = 'UPCOMING';
    if (statusId === 3) matchStatus = 'LIVE';
    else if ([5, 6, 7].includes(statusId)) matchStatus = 'FT';

    const homeScore = g.homeCompetitor?.score ?? g.home?.score ?? null;
    const awayScore = g.awayCompetitor?.score ?? g.away?.score ?? null;

    matches.push({
      home, away,
      homeScore: sanitizeScore(homeScore),
      awayScore: sanitizeScore(awayScore),
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
    const ftResult = results.find(r => r.resultName === 'Endergebnis');

    let status = 'UPCOMING';
    if (m.matchIsFinished) status = 'FT';
    else if (m.matchDateTime && new Date(m.matchDateTime) <= new Date()) status = 'LIVE';

    return {
      home, away,
      homeScore: ftResult ? sanitizeScore(parseInt(ftResult.pointsTeam1)) : null,
      awayScore: ftResult ? sanitizeScore(parseInt(ftResult.pointsTeam2)) : null,
      status,
      date: m.matchDateTime || null,
      source: 'openligadb'
    };
  }).filter(m => CANONICAL_TEAMS.has(m.home) && CANONICAL_TEAMS.has(m.away) && isWorldCupMatch(m.home, m.away));
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

// ---------- WORLD CUP SCHEDULE ----------
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
const PAIRINGS = [[0,1],[2,3],[3,1],[0,2],[3,0],[1,2]];
const WC_MATCH_KEYS = new Set();
for (const g of GROUPS) {
  for (const [hIdx, aIdx] of PAIRINGS) {
    WC_MATCH_KEYS.add(g.teams[hIdx] + '|' + g.teams[aIdx]);
  }
}

// ---------- SOURCE ROUTER ----------
const APIFOOTBALL_KEYS = [
  process.env.APIFOOTBALL_KEY || '672aa02fe1cd2b77ec0d5fd6eb5526da3b797e4039b5396405fd27bb6308b012',
  '9a5b43f6a5b8f9f26a460689317f7ac4'
];

async function fetchAPIFootballScores() {
  for (const key of APIFOOTBALL_KEYS) {
    try {
      const url = `https://apiv3.apifootball.com/?action=get_events&from=2026-06-11&to=2026-07-20&league_id=28&APIkey=${key}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'WC2026-Scoreboard/1.0' } });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;

      return data.map(m => {
        const home = normalizeName(m.match_hometeam_name || '');
        const away = normalizeName(m.match_awayteam_name || '');
        if (!CANONICAL_TEAMS.has(home) || !CANONICAL_TEAMS.has(away)) return null;
        if (!isWorldCupMatch(home, away)) return null;
        const status = m.match_status || '';
        return {
          home, away,
          homeScore: sanitizeScore(m.match_hometeam_score),
          awayScore: sanitizeScore(m.match_awayteam_score),
          status: status === 'Finished' ? 'FT' : (status === 'Ongoing' ? 'LIVE' : 'UPCOMING'),
          date: m.match_date || null,
          source: 'apifootball'
        };
      }).filter(Boolean);
    } catch (e) { /* try next key */ }
  }
  return [];
}

const SOURCES = [
  { name: 'openligadb', fn: fetchOpenLigaDB },
  { name: 'apifootball', fn: fetchAPIFootballScores },
  { name: '365scores', fn: fetch365scores },
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

// ---------- ROUTES ----------
app.get('/api/matches', async (req, res) => {
  try {
    const result = await getMatches();
    res.json(result);
  } catch (e) {
    res.json({ matches: [], source: 'error', error: e.message });
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
    console.log(`  GET /api/status    - server status`);
    console.log(`  GET /api/odds      - Asian Handicap odds`);
  });
}

module.exports = app;
