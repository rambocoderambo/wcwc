const c = require('cloudscraper');
const cheerio = require('cheerio');
(async () => {
  await c.get({uri:'https://beta.asianbookie.com/en/world-cup',headers:{'User-Agent':'Mozilla/5.0'},simple:false});
  const html = await c.get({uri:'https://asianbookie.com/index.cfm/World-Cup/?league=4&tz=8',headers:{'User-Agent':'Mozilla/5.0','Cookie':'CLASSIC=1'}});
  const ch = cheerio.load(html);
  ch('script,style,link,meta,noscript,iframe').remove();
  const text = ch('body').text();
  const lines = text.split('\n').map(l => l.trim());
  for (let i = 0; i < lines.length; i++) {
    if (/^\d{1,2}\/[A-Z][a-z]{2}\s{2}\d{2}:\d{2}$/.test(lines[i])) {
      const date = lines[i];
      const matchLine = lines[i+2] || '';
      if (matchLine.includes(' vs ')) {
        console.log(matchLine.split('\t')[0] + ' | ' + date);
      }
    }
  }
})().catch(e => console.log(e.message));
