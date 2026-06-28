const c = require('cloudscraper');
const cheerio = require('cheerio');
(async () => {
  await c.get({uri:'https://beta.asianbookie.com/en/world-cup',headers:{'User-Agent':'Mozilla/5.0'},simple:false,timeout:20000});
  const html = await c.get({uri:'https://asianbookie.com/index.cfm/World-Cup/?league=4&tz=8',headers:{'User-Agent':'Mozilla/5.0','Cookie':'CLASSIC=1'},timeout:20000});
  const ch = cheerio.load(html);
  ch('script,style,link,meta,noscript,iframe').remove();
  const text = ch('body').text();
  const lines = text.split('\n').map(l => l.trim());
  
  // Test the date regex
  console.log('Testing date regex:');
  for (let i = 0; i < Math.min(lines.length, 500); i++) {
    if (/^\d{1,2}\/[A-Z][a-z]{2}\s{2}\d{2}:\d{2}$/.test(lines[i])) {
      console.log('MATCH: [' + i + '] "' + lines[i] + '"');
      console.log('  +1: "' + (lines[i+1]||'') + '"');
      console.log('  +2: "' + (lines[i+2]||'') + '"');
      console.log('  +3: "' + (lines[i+3]||'') + '"');
      console.log('  +4: "' + (lines[i+4]||'') + '"');
      console.log('  +5: "' + (lines[i+5]||'') + '"');
      if (++cnt > 5) break;
    }
  }
  let cnt = 0;
})().catch(e => console.log('Error:', e.message));
