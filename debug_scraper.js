const c = require('cloudscraper');
const cheerio = require('cheerio');
(async () => {
  await c.get({uri:'https://beta.asianbookie.com/en/world-cup',headers:{'User-Agent':'Mozilla/5.0'},simple:false,timeout:20000});
  const html = await c.get({uri:'https://asianbookie.com/index.cfm/World-Cup/?league=4&tz=8',headers:{'User-Agent':'Mozilla/5.0','Cookie':'CLASSIC=1'},timeout:20000});
  const ch = cheerio.load(html);
  ch('script,style,link,meta,noscript,iframe').remove();
  const text = ch('body').text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  console.log('Total lines:', lines.length);
  
  // Find ALL date lines and show context
  let found = 0;
  for (let i = 0; i < lines.length - 6; i++) {
    if (/^\d{1,2}\/[A-Z][a-z]{2}\s+\d{2}:\d{2}$/.test(lines[i])) {
      found++;
      if (found > 12) break;
      console.log('\n--- Match ' + found + ' at line ' + i + ' ---');
      console.log('DATE: "' + lines[i] + '"');
      for (let j = 1; j <= 8; j++) {
        const l = lines[i+j] || '(empty)';
        console.log('  +' + j + ': "' + l + '"');
      }
    }
  }
  console.log('\nDate lines found:', found);
})().catch(e => console.log('Error:', e.message));
