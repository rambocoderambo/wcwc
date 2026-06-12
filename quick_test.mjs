import { fork } from 'child_process';

const server = fork('E:\\AI LLMs\\World Cup\\server.js', [], { stdio: 'pipe' });
server.stdout.on('data', d => process.stdout.write(d));

await new Promise(r => setTimeout(r, 4000));

try {
  const res = await fetch('http://localhost:3001/api/matches');
  const data = await res.json();
  console.log('\nSource:', data.source);
  console.log('Matches:', data.matches.length);
  for (const m of data.matches.slice(0, 3)) {
    console.log(`${m.home.padEnd(25)} vs ${m.away.padEnd(25)}  ${m.homeScore ?? '-'}-${m.awayScore ?? '-'}  [${m.status}]`);
  }
} catch(e) {
  console.log('Fetch error:', e.message);
}

server.kill();
