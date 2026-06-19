const c = require('cloudscraper');
const cheerio = require('cheerio');
(async () => {
  await c.get({uri:'https://beta.asianbookie.com/en/world-cup',headers:{'User-Agent':'Mozilla/5.0'},simple:false,timeout:30000});
  const html = await c.get({uri:'https://asianbookie.com/index.cfm/World-Cup/?league=4&tz=8',headers:{'User-Agent':'Mozilla/5.0','Cookie':'CLASSIC=1'},timeout:30000});
  const ch = cheerio.load(html);
  ch('script,style,link,meta,noscript,iframe').remove();
  const text = ch('body').text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  // Find date lines near Australia vs Turkey
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Australia') && lines[i].includes('Turkey')) {
      const start = Math.max(0, i - 5);
      const end = Math.min(lines.length, i + 5);
      for (let j = start; j < end; j++) {
        console.log('[' + j + '] ' + lines[j]);
      }
      console.log('---');
    }
    // Also show date lines
    if (/^(\d{1,2}\/)/.test(lines[i]) && lines[i].includes('JUN')) {
      console.log('DATE: ' + lines[i]);
    }
  }
})().catch(e => console.log('Error: ' + e.message));
