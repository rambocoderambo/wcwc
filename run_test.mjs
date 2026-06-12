import http from 'http';
import { spawn } from 'child_process';

// Start server
const server = spawn('node', ['E:\\AI LLMs\\World Cup\\server.js'], {
  stdio: 'pipe',
  detached: true
});

server.stdout.on('data', d => process.stdout.write(d));
server.stderr.on('data', d => process.stderr.write(d));

// Wait for server to start
await new Promise(r => setTimeout(r, 5000));

// Test
try {
  const res = await fetch('http://localhost:3001/api/matches', { signal: AbortSignal.timeout(30000) });
  const data = await res.json();
  console.log('\n=== RESULTS ===');
  console.log('Source:', data.source);
  console.log('Matches:', data.matches.length);
  for (const m of data.matches.slice(0, 5)) {
    const hs = m.homeScore ?? '-';
    const as2 = m.awayScore ?? '-';
    console.log(`${m.home.padEnd(25)} vs ${m.away.padEnd(25)}  ${hs}-${as2}  [${m.status}]`);
  }
} catch(e) {
  console.log('Error:', e.message);
}

server.kill();
