import { launch } from 'cloakbrowser';
const browser = await launch({ headless: true, humanize: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });

await page.goto('https://beta.asianbookie.com/en/world-cup', { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, 3000));

// Get cookies BEFORE switching
const beforeCookies = await page.evaluate(() => document.cookie);
console.log('Before switch:', beforeCookies);

// Click Switch to Classic
await page.evaluate(() => {
  const btns = document.querySelectorAll('button');
  for (const btn of btns) {
    if (btn.textContent.includes('Switch to Classic')) { btn.click(); return; }
  }
});
await new Promise(r => setTimeout(r, 5000));

// Get cookies AFTER switching
const afterCookies = await page.evaluate(() => document.cookie);
console.log('After switch:', afterCookies);

// Get all cookies from the browser
const cookies = await page.context().cookies();
console.log('\nAll cookies:');
for (const c of cookies) {
  console.log(`  ${c.name}=${c.value} (domain: ${c.domain}, path: ${c.path})`);
}

// Now try the classic URL with these cookies
await page.goto('https://asianbookie.com/index.cfm/World-Cup/?league=4&tz=8', { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, 3000));

const url = await page.url();
const text = await page.evaluate(() => document.body.innerText);

console.log('\nFinal URL:', url);
console.log('Body size:', text.length, 'bytes');
console.log('Has match data:', text.includes('Mexico vs South Africa'));

await browser.close();
