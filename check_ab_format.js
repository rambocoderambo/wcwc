const c = require('cloudscraper');
const cheerio = require('cheerio');
(async () => {
  await c.get({uri:'https://beta.asianbookie.com/en/world-cup',headers:{'User-Agent':'Mozilla/5.0'},simple:false,timeout:20000});
  const html = await c.get({uri:'https://asianbookie.com/index.cfm/World-Cup/?league=4&tz=8',headers:{'User-Agent':'Mozilla/5.0','Cookie':'CLASSIC=1'},timeout:20000});
  const ch = cheerio.load(html);
  ch('script,style,link,meta,noscript,iframe').remove();
  const text = ch('body').text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  // Find match data - look for date patterns and team names
  let inMatchSection = false;
  for (let i = 0; i < lines.length; i++) {
    // Show context around date patterns
    if (/^\d{1,2}\/[A-Z][a-z]{2}/.test(lines[i])) {
      console.log('DATE: ' + lines[i]);
      for (let j = i+1; j < Math.min(i+12, lines.length); j++) {
        if (lines[j]) console.log('  [' + (j-i) + '] ' + lines[j]);
      }
      console.log('---');
      i += 11;
    }
  }
})().catch(e => console.log('Error:', e.message));
