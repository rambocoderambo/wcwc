const c = require('cloudscraper');
const cheerio = require('cheerio');
(async () => {
  await c.get({uri:'https://beta.asianbookie.com/en/world-cup',headers:{'User-Agent':'Mozilla/5.0'},simple:false,timeout:20000});
  const html = await c.get({uri:'https://asianbookie.com/index.cfm/World-Cup/?league=4&tz=8',headers:{'User-Agent':'Mozilla/5.0','Cookie':'CLASSIC=1'},timeout:20000});
  const ch = cheerio.load(html);
  ch('script,style,link,meta,noscript,iframe').remove();
  const text = ch('body').text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  // Find all "vs" occurrences and show what's around them
  let matchCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l === 'vs' || l === 'vs ') {
      const team1 = lines[i-1] || '';
      const team2 = lines[i+2] || '';
      const ahLine = lines[i+9] || '';
      if (team1 && team2 && ahLine && ahLine.includes(':')) {
        matchCount++;
        console.log(matchCount + '. ' + team1.padEnd(25) + ' vs ' + team2.padEnd(25) + '  AH: ' + ahLine);
      }
    }
  }
  console.log('---');
  console.log('Total matches with AH odds: ' + matchCount);
  // Also print ALL vs lines (even without AH) to see what's on the page
  console.log('\nALL vs lines:');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'vs') {
      console.log(lines[i-1] + ' vs ' + lines[i+2]);
    }
  }
})().catch(e => console.log('Error:', e.message));
