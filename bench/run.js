const autocannon = require('autocannon');
const { execSync, spawn } = require('child_process');
const path = require('path');

const DURATION = 10;   // seconds per scenario
const CONNECTIONS = 100;
const PIPELINING = 1;

const SERVERS = [
  { name: 'Express 4',       port: 3001, file: 'server-express.js' },
  { name: 'Fastify 5',       port: 3002, file: 'server-fastify.js' },
  { name: 'mimijs v2 (current)', port: 3003, file: 'server-mimijs.js' },
];

const SCENARIOS = [
  { label: 'simple GET /',       path: '/' },
  { label: 'GET /user/:id',      path: '/user/42' },
  { label: '50-route app /r25',  path: '/r25' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function bench(url) {
  return new Promise((resolve) => {
    const instance = autocannon({ url, duration: DURATION, connections: CONNECTIONS, pipelining: PIPELINING }, (err, result) => {
      resolve(result);
    });
    autocannon.track(instance, { renderProgressBar: false });
  });
}

function memMB(pid) {
  try {
    const out = execSync(`ps -o rss= -p ${pid} 2>/dev/null`).toString().trim();
    return Math.round(parseInt(out, 10) / 1024);
  } catch { return null; }
}

async function runAll() {
  const results = [];

  for (const srv of SERVERS) {
    const srvPath = path.join(__dirname, srv.file);
    console.log(`\n▶ Starting ${srv.name} on :${srv.port}...`);
    const proc = spawn('node', [srvPath], { stdio: 'ignore', detached: false });
    await sleep(1200);

    const srvResults = { name: srv.name, scenarios: [] };

    for (const sc of SCENARIOS) {
      const url = `http://localhost:${srv.port}${sc.path}`;
      console.log(`  ⏱  ${sc.label} → ${url}`);
      const r = await bench(url);
      const mem = memMB(proc.pid);
      srvResults.scenarios.push({
        label: sc.label,
        reqPerSec: Math.round(r.requests.average),
        latP50: r.latency.p50,
        latP99: r.latency.p99,
        throughputMBps: ((r.throughput.average || 0) / 1024 / 1024).toFixed(2),
        memMB: mem,
      });
    }

    results.push(srvResults);
    proc.kill();
    await sleep(500);
  }

  printTable(results);
}

function printTable(results) {
  console.log('\n\n════════════════════════════════════════════════════════════════════');
  console.log('  BENCHMARK RESULTS');
  console.log('════════════════════════════════════════════════════════════════════');

  for (const sc of SCENARIOS) {
    console.log(`\n  Scenario: ${sc.label}`);
    console.log(`  ${'Framework'.padEnd(26)} ${'req/s'.padStart(8)} ${'p50 ms'.padStart(8)} ${'p99 ms'.padStart(8)} ${'MB/s'.padStart(8)} ${'RSS MB'.padStart(8)}`);
    console.log(`  ${'-'.repeat(70)}`);
    for (const srv of results) {
      const row = srv.scenarios.find(s => s.label === sc.label);
      if (!row) continue;
      console.log(
        `  ${srv.name.padEnd(26)}` +
        `${String(row.reqPerSec).padStart(8)}` +
        `${String(row.latP50).padStart(8)}` +
        `${String(row.latP99).padStart(8)}` +
        `${String(row.throughputMBps).padStart(8)}` +
        `${String(row.memMB ?? '?').padStart(8)}`
      );
    }
  }

  // Emit JSON for the doc
  console.log('\n\n--- JSON ---');
  console.log(JSON.stringify(results, null, 2));
}

runAll().catch(console.error);
