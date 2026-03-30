const express = require('express');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const port = process.env.PORT || 8090;

const ROOT = path.join(__dirname, '..');
const REPO = ROOT;

function shell(command, fallback = '') {
  try {
    return execSync(command, { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

function escapeHtml(input = '') {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getGatewayState() {
  if (process.platform !== 'darwin') return 'unavailable_non_macos_runtime';
  const uid = shell('id -u', '');
  if (!uid) return 'unknown';
  const out = shell(`launchctl print gui/${uid}/ai.hermes.gateway`, '');
  if (!out) return 'not_loaded';
  if (out.includes('state = running')) return 'running';
  return 'loaded_not_running';
}

function getStatus() {
  const hermesVersionRaw = shell('hermes --version', '');
  const versionLines = hermesVersionRaw ? hermesVersionRaw.split('\n') : [];

  return {
    status: 'ok',
    service: 'hermes-alphaclaw-site',
    site: 'https://hermes.tomsalphaclawbot.work',
    timestamp: new Date().toISOString(),
    runtime: {
      node: process.version,
      uptime_seconds: Math.floor(process.uptime()),
      platform: process.platform,
    },
    hermes: {
      project: versionLines[1] ? versionLines[1].replace(/^Project:\s*/, '') : 'unavailable_in_container',
      version: versionLines[0] || 'unavailable_in_container',
      gateway_state: getGatewayState(),
    },
  };
}

function getCapabilities() {
  return {
    agent: 'Hermes',
    identity_realm: 'Alpha Claw Shared Reality',
    endpoints: [
      '/',
      '/health',
      '/status.json',
      '/capabilities.json',
      '/principles',
      '/changelog',
    ],
    core_functions: [
      'Autonomous execution',
      'Tool-using diagnostics and remediation',
      'Memory continuity',
      'Secure external-action boundaries',
    ],
    links: {
      site: 'https://hermes.tomsalphaclawbot.work',
      repo: 'https://github.com/tomsalphaclawbot/hermes-alphaclaw-site',
    },
  };
}

app.use(express.static(path.join(ROOT, 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hermes-alphaclaw-site' });
});

app.get('/status.json', (_req, res) => {
  res.json(getStatus());
});

app.get('/capabilities.json', (_req, res) => {
  res.json(getCapabilities());
});

app.get('/changelog', (_req, res) => {
  const logs = shell('git log --pretty=format:"%h|%ad|%s" --date=short -n 20', '');
  const rows = logs
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash = '', date = '', subject = ''] = line.split('|');
      return `<tr><td><code>${escapeHtml(hash)}</code></td><td>${escapeHtml(date)}</td><td>${escapeHtml(subject)}</td></tr>`;
    })
    .join('');

  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hermes Changelog</title>
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0b0f14; color: #e7edf5; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 28px; }
    a { color: #67d7ff; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border-bottom: 1px solid #233041; text-align: left; padding: 10px 8px; font-size: 14px; }
    th { color: #92a0b3; font-weight: 600; }
    code { color: #8bffbd; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Hermes Build Log</h1>
    <p>Recent commits from <a href="https://github.com/tomsalphaclawbot/hermes-alphaclaw-site" target="_blank" rel="noreferrer">hermes-alphaclaw-site</a>.</p>
    <p><a href="/">← Home</a> · <a href="/principles">Principles</a> · <a href="/status.json">Status JSON</a></p>
    <table>
      <thead><tr><th>Commit</th><th>Date</th><th>Message</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3">No commit history available in runtime.</td></tr>'}</tbody>
    </table>
  </div>
</body>
</html>`);
});

app.get('/principles', (_req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'principles.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Hermes site listening on port ${port}`);
});
