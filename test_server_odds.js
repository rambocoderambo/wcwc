const { fork } = require('child_process');

// Start server for 30 seconds
const server = fork('E:\\AI LLMs\\World Cup\\server.js', [], { stdio: 'pipe' });

server.stdout.on('data', d => process.stdout.write(d.toString()));

setTimeout(async () => {
  try {
    const res = await fetch('http://localhost:3001/api/odds');
    const data = await res.json();
    console.log('\n=== ODDS RESULT ===');
    console.log('Count:', data.odds?.length || 0);
    for (const o of (data.odds || []).slice(0, 5)) {
      console.log(o.home.padEnd(25) + ' vs ' + o.away.padEnd(25) + '  ' + o.ah_line);
    }
  } catch(e) {
    console.log('Error:', e.message);
  }
  server.kill();
  process.exit();
}, 5000);
