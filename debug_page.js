const c = require('cloudscraper');
const cheerio = require('cheerio');
(async () => {
  await c.get({uri:'https://beta.asianbookie.com/en/world-cup',headers:{'User-Agent':'Mozilla/5.0'},simple:false,timeout:20000});
  const html = await c.get({uri:'https://asianbookie.com/index.cfm/World-Cup/?league=4&tz=8',headers:{'User-Agent':'Mozilla/5.0','Cookie':'CLASSIC=1'},timeout:20000});
  const ch = cheerio.load(html);
  ch('script,style,link,meta,noscript,iframe').remove();
  const text = ch('body').text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Show ALL lines containing "JUN" or "JUL" or "vs" 
  console.log('Date-like lines:');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\d/.test(l) && (l.includes('JUN') || l.includes('JUL') || l.includes('/'))) {
      console.log('[' + i + '] "' + l + '"');
      // Show surrounding context
      for (let j = i+1; j < Math.min(i+8, lines.length); j++) {
        if (lines[j]) console.log('  +' + (j-i) + ' "' + lines[j] + '"');
      }
      console.log('---');
      if (++cnt > 3) break;
    }
  }
  let cnt = 0;
  console.log('\nSample of first 30 lines:');
  for (let i = 0; i < 30 && i < lines.length; i++) {
    console.log('[' + i + '] "' + lines[i].substring(0, 80) + '"');
  }
})().catch(e => console.log('Error:', e.message));
