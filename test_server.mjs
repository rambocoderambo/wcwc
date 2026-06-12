import http from 'http';

// Wait for server
await new Promise(r => setTimeout(r, 3000));

// Test
const res = await fetch('http://localhost:3001/api/matches', { timeout: 30000 });
const data = await res.json();
console.log('Source:', data.source);
console.log('Matches:', data.matches.length);
for (const m of data.matches.slice(0, 5)) {
  console.log(`${m.home.padEnd(25)} vs ${m.away.padEnd(25)}  ${m.homeScore ?? '-'}-${m.awayScore ?? '-'}  [${m.status}]`);
}
