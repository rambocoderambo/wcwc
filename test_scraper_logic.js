const c = require('cloudscraper');
const cheerio = require('cheerio');

// Replicate the server's NAME_ALIASES and helpers
const NAME_ALIASES = {
  'usa': 'United States', 'united states': 'United States', 'united states of america': 'United States',
  'south korea': 'South Korea', 'korea republic': 'South Korea', 'korea': 'South Korea',
  'czech republic': 'Czech Republic', 'czechia': 'Czech Republic',
  'ivory coast': 'Ivory Coast', "côte d'ivoire": 'Ivory Coast', "cote d'ivoire": 'Ivory Coast',
  'dr congo': 'DR Congo', 'congo dr': 'DR Congo', 'drc': 'DR Congo', 'congo drc': 'DR Congo', 'd.r. congo': 'DR Congo', 'democratic rep congo': 'DR Congo',
  'netherlands': 'Netherlands', 'holland': 'Netherlands',
  'turkey': 'Turkey', 'türkiye': 'Turkey', 'turkiye': 'Turkey',
  'cape verde': 'Cape Verde', 'cabo verde': 'Cape Verde', 'cape verde islands': 'Cape Verde',
  'bosnia and herzegovina': 'Bosnia and Herzegovina', 'bosnia': 'Bosnia and Herzegovina', 'bosnia & herzegovina': 'Bosnia and Herzegovina', 'bosnia herzegovina': 'Bosnia and Herzegovina', 'bosnia-herzegovina': 'Bosnia and Herzegovina',
  'saudi arabia': 'Saudi Arabia', 'saudi': 'Saudi Arabia',
  'new zealand': 'New Zealand',
  'curacao': 'Curaçao', 'curaçao': 'Curaçao',
  'south africa': 'South Africa',
  'mexico': 'Mexico', 'canada': 'Canada', 'brazil': 'Brazil',
  'haiti': 'Haiti', 'scotland': 'Scotland', 'morocco': 'Morocco',
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
const CANONICAL = new Set(Object.values(NAME_ALIASES));

function norm(name) {
  const key = name.trim().toLowerCase();
  return NAME_ALIASES[key] || name.trim();
}

(async () => {
  await c.get({uri:'https://beta.asianbookie.com/en/world-cup',headers:{'User-Agent':'Mozilla/5.0'},simple:false,timeout:20000});
  const html = await c.get({uri:'https://asianbookie.com/index.cfm/World-Cup/?league=4&tz=8',headers:{'User-Agent':'Mozilla/5.0','Cookie':'CLASSIC=1'},timeout:20000});
  const ch = cheerio.load(html);
  ch('script,style,link,meta,noscript,iframe').remove();
  const text = ch('body').text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  const results = [];
  for (let i = 0; i < lines.length - 6; i++) {
    if (!/^\d{1,2}\/[A-Z][a-z]{2}\s+\d{2}:\d{2}$/.test(lines[i])) continue;
    const team1 = lines[i + 1] || '';
    const vs = lines[i + 2] || '';
    const team2 = lines[i + 3] || '';
    if (vs !== 'vs') continue;
    if (!team1 || !team2 || /^[\d.]+$/.test(team1) || /^[\d.]+$/.test(team2)) continue;
    const odds = lines[i + 4] || '';
    const ahLine = lines[i + 5] || '';
    if (!ahLine.includes(':') || !/[\d\/]/.test(ahLine)) continue;

    const home = norm(team1);
    const away = norm(team2);
    const homeOk = CANONICAL.has(home);
    const awayOk = CANONICAL.has(away);
    
    if (!homeOk || !awayOk) {
      console.log('SKIPPED: ' + team1 + ' -> "' + home + '" (' + homeOk + ') vs ' + team2 + ' -> "' + away + '" (' + awayOk + ')  AH: ' + ahLine);
    } else {
      results.push({ home, away, ahLine });
    }
  }
  
  console.log('\nTotal captured: ' + results.length);
  for (const r of results) {
    console.log(r.home.padEnd(25) + ' vs ' + r.away.padEnd(25) + '  AH: ' + r.ahLine);
  }
})().catch(e => console.log('Error:', e.message));
