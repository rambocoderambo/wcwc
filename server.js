const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 2323;

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
   'dr congo': 'DR Congo', 'congo dr': 'DR Congo', 'drc': 'DR Congo', 'congo drc': 'DR Congo', 'd.r. congo': 'DR Congo', 'democratic rep congo': 'DR Congo', 'congo dr': 'DR Congo',
   'netherlands': 'Netherlands', 'holland': 'Netherlands',
  'turkey': 'Turkey', 'türkiye': 'Turkey', 'turkiye': 'Turkey',
   'cape verde': 'Cape Verde', 'cabo verde': 'Cape Verde', 'cape verde islands': 'Cape Verde',
   'bosnia and herzegovina': 'Bosnia and Herzegovina', 'bosnia': 'Bosnia and Herzegovina', 'bosnia & herzegovina': 'Bosnia and Herzegovina', 'bosnia herzegovina': 'Bosnia and Herzegovina', 'bosnia-herzegovina': 'Bosnia and Herzegovina',
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
   'haiti': 'Haiti', 'scotland': 'Scotland', 'morocco': 'Morocco',
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let html;
  try {
    const res = await fetch('https://asianbookie.com/index.cfm/World-Cup/?league=4&tz=8', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cookie': 'CLASSIC=1; DOMAINCOUNTRY=MY; COUNTRY=MY'
      }
    });
    clearTimeout(timeout);
    html = await res.text();
    if (!html.includes(' vs ')) throw new Error('No match data');
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }

  const $ = cheerio.load(html);
  $('script, style, link, meta, noscript, iframe').remove();
  const text = $('body').text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  const results = new Map();

  for (let i = 0; i < lines.length - 6; i++) {
    if (!/^\d{1,2}\/[A-Z][a-z]{2}\s+\d{2}:\d{2}$/.test(lines[i])) continue;
    const team1 = lines[i + 1] || '';
    const vs = lines[i + 2] || '';
    const team2 = lines[i + 3] || '';
    if (vs !== 'vs') continue;
    if (!team1 || !team2 || /^[\d.]+$/.test(team1) || /^[\d.]+$/.test(team2)) continue;
    const ahLine = lines[i + 5] || '';
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

// Save odds to static file for Vercel fallback
const ODDS_CACHE_FILE = require('path').join(__dirname, 'api', 'odds-cache.json');

async function getOdds() {
  const cached = AH_CACHE.data && (Date.now() - AH_CACHE.ts < AH_CACHE.ttl);
  if (cached) return AH_CACHE.data;

  // Try both sources and merge
  const data = new Map();

  // 1. Classic ColdFusion scrape (more matches)
  try {
    const classic = await scrapeClassicAsianBookie();
    for (const o of classic) data.set(o.home + '|' + o.away, o);
    // Save to cache file for Vercel fallback
    try {
      const fs = require('fs');
      fs.mkdirSync(require('path').join(__dirname, 'api'), { recursive: true });
      fs.writeFileSync(ODDS_CACHE_FILE, JSON.stringify(Array.from(data.values()), null, 2));
    } catch(e) {}
  } catch (e) {}

  // 2. Beta API fallback (reliable on Vercel)
  try {
    const url = 'https://beta.asianbookie.com/api/poll/world-cup/summary?locale=en';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://beta.asianbookie.com/en/world-cup', 'Accept': 'application/json' }
    });
    const body = await res.json();
    const bd = body.data || {};

    // 2a. Match cards (upcoming matches with full AH data)
    for (const mc of bd.matchCards || []) {
      const home = normalizeName(mc.HOME_TEAM_NAME || '');
      const away = normalizeName(mc.AWAY_TEAM_NAME || '');
      if (!CANONICAL_TEAMS.has(home) || !CANONICAL_TEAMS.has(away)) continue;
      const ah = mc.AH;
      if (!ah || !ah.odds) continue;
      const hVal = parseFloat(ah.odds);
      const displayVal = handicapToFraction(Math.abs(hVal));
      let ahLine;
      if (hVal < 0) ahLine = '0 : ' + displayVal;
      else if (hVal > 0) ahLine = displayVal + ' : 0';
      else ahLine = '0 : 0';
      const key = home + '|' + away;
      if (!data.has(key)) data.set(key, { home, away, ah_line: ahLine, bookmaker: 'AsianBookie', source: 'AsianBookie' });
    }

    // 2b. Hot picks (AH market picks with handicap lines)
    for (const hp of bd.hotPicks || []) {
      if (hp.marketType !== 'AH') continue;
      const home = normalizeName(hp.homeTeam?.name || '');
      const away = normalizeName(hp.awayTeam?.name || '');
      if (!CANONICAL_TEAMS.has(home) || !CANONICAL_TEAMS.has(away)) continue;
      if (!hp.pickLabelPrefix) continue;
      const hVal = parseFloat(hp.pickLabelPrefix);
      if (isNaN(hVal)) continue;
      const displayVal = handicapToFraction(Math.abs(hVal));
      let ahLine;
      if (hVal < 0) ahLine = '0 : ' + displayVal;
      else if (hVal > 0) ahLine = displayVal + ' : 0';
      else ahLine = '0 : 0';
      const key = home + '|' + away;
      if (!data.has(key)) data.set(key, { home, away, ah_line: ahLine, bookmaker: 'AsianBookie', source: 'AsianBookie' });
    }
  } catch (e) {}

  // 3. Static cache file fallback — merge with live data (cache has more matches)
  try {
    const cached = JSON.parse(require('fs').readFileSync(ODDS_CACHE_FILE, 'utf8'));
    for (const o of cached) {
      const key = o.home + '|' + o.away;
      if (!data.has(key)) data.set(key, o);
    }
  } catch(e) {}

  AH_CACHE.data = Array.from(data.values());
  AH_CACHE.ts = Date.now();
  console.log(`Odds: ${AH_CACHE.data.length} matches (1st src: classic scrape, 2nd: beta API)`);
  return AH_CACHE.data;
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
    const home = g.teams[hIdx];
    const away = g.teams[aIdx];
    WC_MATCH_KEYS.add(home + '|' + away);
    WC_MATCH_KEYS.add(away + '|' + home);
  }
}

// ---------- HARDCODED GROUP RESULTS ----------
// 72 group matches with final scores (verified against football-data.org)
const GROUP_RESULTS = {
'Mexico|South Africa':{h:2,a:0},'South Korea|Czech Republic':{h:2,a:1},'Canada|Bosnia and Herzegovina':{h:1,a:1},
'United States|Paraguay':{h:4,a:1},'Qatar|Switzerland':{h:1,a:1},'Brazil|Morocco':{h:1,a:1},
'Haiti|Scotland':{h:0,a:1},'Australia|Turkey':{h:2,a:0},'Germany|Curaçao':{h:7,a:1},
'Netherlands|Japan':{h:2,a:2},'Ivory Coast|Ecuador':{h:1,a:0},'Sweden|Tunisia':{h:5,a:1},
'Spain|Cape Verde':{h:0,a:0},'Belgium|Egypt':{h:1,a:1},'Saudi Arabia|Uruguay':{h:1,a:1},
'Iran|New Zealand':{h:2,a:2},'France|Senegal':{h:3,a:1},'Iraq|Norway':{h:1,a:4},
'Argentina|Algeria':{h:3,a:0},'Austria|Jordan':{h:3,a:1},'Portugal|DR Congo':{h:1,a:1},
'England|Croatia':{h:4,a:2},'Ghana|Panama':{h:1,a:0},'Uzbekistan|Colombia':{h:1,a:3},
'Czech Republic|South Africa':{h:1,a:1},'Switzerland|Bosnia and Herzegovina':{h:4,a:1},
'Canada|Qatar':{h:6,a:0},'Mexico|South Korea':{h:1,a:0},
'United States|Australia':{h:2,a:0},'Scotland|Morocco':{h:0,a:1},'Brazil|Haiti':{h:3,a:0},
'Turkey|Paraguay':{h:0,a:1},'Netherlands|Sweden':{h:5,a:1},'Germany|Ivory Coast':{h:2,a:1},
'Ecuador|Curaçao':{h:0,a:0},'Tunisia|Japan':{h:0,a:4},'Spain|Saudi Arabia':{h:4,a:0},
'Belgium|Iran':{h:0,a:0},'Uruguay|Cape Verde':{h:2,a:2},'New Zealand|Egypt':{h:1,a:3},
'Argentina|Austria':{h:2,a:0},'France|Iraq':{h:3,a:0},'Norway|Senegal':{h:3,a:2},
'Jordan|Algeria':{h:1,a:2},'Portugal|Uzbekistan':{h:5,a:0},'England|Ghana':{h:0,a:0},
'Panama|Croatia':{h:0,a:1},'Colombia|DR Congo':{h:1,a:0},
'Switzerland|Canada':{h:2,a:1},'Bosnia and Herzegovina|Qatar':{h:3,a:1},
'Morocco|Haiti':{h:4,a:2},'Scotland|Brazil':{h:0,a:3},'Czech Republic|Mexico':{h:0,a:3},
'South Africa|South Korea':{h:1,a:0},
'Ecuador|Germany':{h:2,a:1},'Curaçao|Ivory Coast':{h:0,a:2},
'Tunisia|Netherlands':{h:1,a:3},'Japan|Sweden':{h:1,a:1},
'Turkey|United States':{h:3,a:2},'Paraguay|Australia':{h:0,a:0},
'Norway|France':{h:1,a:4},'Senegal|Iraq':{h:5,a:0},
'Uruguay|Spain':{h:0,a:1},'Cape Verde|Saudi Arabia':{h:0,a:0},
'New Zealand|Belgium':{h:1,a:5},'Egypt|Iran':{h:1,a:1},
'Panama|England':{h:0,a:2},'Croatia|Ghana':{h:2,a:1},
'Colombia|Portugal':{h:0,a:0},'DR Congo|Uzbekistan':{h:3,a:1},
'Jordan|Argentina':{h:1,a:3},'Algeria|Austria':{h:3,a:3}
};

async function fetchHardcodedGroups() {
  return Object.entries(GROUP_RESULTS).map(([key, s]) => {
    const [home, away] = key.split('|');
    return { home, away, homeScore: s.h, awayScore: s.a, status: 'FT', date: null, source: 'hardcoded' };
  });
}

async function fetchFootballData() {
  const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || '9ce776b7a6ce49c58d8e7280bf4b7aab';
  const url = 'https://api.football-data.org/v4/competitions/2000/matches?dateFrom=2026-06-11&dateTo=2026-07-19';
  const res = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY } });
  if (!res.ok) throw new Error(`football-data.org ${res.status}`);
  const body = await res.json();
  if (!body.matches) return [];

  return body.matches.map(m => {
    const home = normalizeName(m.homeTeam?.name || '');
    const away = normalizeName(m.awayTeam?.name || '');
    if (!CANONICAL_TEAMS.has(home) || !CANONICAL_TEAMS.has(away)) return null;
    // Allow all matches (group + knockout) — isWorldCupMatch only covers group stage

    const statusMap = { 'FINISHED': 'FT', 'IN_PLAY': 'LIVE', 'PAUSED': 'LIVE', 'SCHEDULED': 'UPCOMING', 'TIMED': 'UPCOMING', 'POSTPONED': 'UPCOMING' };
    const ft = m.score?.fullTime || {};
    const homeScore = ft.home !== null && ft.home !== undefined ? ft.home : null;
    const awayScore = ft.away !== null && ft.away !== undefined ? ft.away : null;

    return {
      home, away,
      homeScore: sanitizeScore(homeScore),
      awayScore: sanitizeScore(awayScore),
      status: statusMap[m.status] || 'UPCOMING',
      date: m.utcDate || null,
      source: 'football-data'
    };
  }).filter(Boolean);
}

async function getMatches() {
  const cached = getCached('matches');
  if (cached) return cached;

  // Merge ALL sources: hardcoded groups as base, then overlay R32+ results
  const mergedMap = new Map();
  let liveSource = 'hardcoded';

  // 1. Always include hardcoded group results
  try {
    for (const m of await fetchHardcodedGroups()) {
      mergedMap.set(m.home + '|' + m.away, m);
    }
  } catch (e) {}

  // 2. Try football-data for R32+ live scores
  try {
    const matches = await fetchFootballData();
    for (const m of matches) {
      const key = m.home + '|' + m.away;
      // Override hardcoded with live data if score exists
      if (m.homeScore !== null) {
        mergedMap.set(key, { ...m, source: 'football-data' });
        liveSource = 'football-data';
      } else if (!mergedMap.has(key)) {
        mergedMap.set(key, m);
      }
    }
  } catch (e) {}

  const allMatches = Array.from(mergedMap.values());
  setCache('matches', { matches: allMatches, source: liveSource });
  return { matches: allMatches, source: liveSource };
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
