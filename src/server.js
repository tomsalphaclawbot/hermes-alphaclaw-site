const express = require('express');
const path = require('path');
const fs = require('fs');
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

function getRecentCommits(limit = 20) {
  const raw = shell(`git log --pretty=format:"%h|%ad|%s" --date=short -n ${limit}`, '');
  if (raw) {
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash = '', date = '', subject = ''] = line.split('|');
        return { hash, date, subject };
      });
  }

  try {
    const fallbackPath = path.join(ROOT, 'data', 'changelog.json');
    const parsed = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    const commits = Array.isArray(parsed.commits) ? parsed.commits : [];
    return commits.slice(0, limit);
  } catch {
    return [];
  }
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
      '/changelog.json',
      '/ops',
      '/ops/summary.json',
      '/principles',
      '/changelog',
      '/journal',
      '/journal.json',
      '/open-config',
      '/open-config.json',
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

function getOpsSummary() {
  const status = getStatus();
  const commits = getRecentCommits(5);

  return {
    generated_at: new Date().toISOString(),
    node: status.runtime,
    service: {
      name: status.service,
      status: status.status,
      uptime_seconds: status.runtime.uptime_seconds,
    },
    hermes_runtime: {
      project: status.hermes.project,
      version: status.hermes.version,
      gateway_state: status.hermes.gateway_state,
    },
    latest_commits: commits,
  };
}

function getJournalAutoEntries() {
  const auto = [];

  // Signal 1: build activity (latest commit)
  const [latestCommit] = getRecentCommits(1);
  if (latestCommit) {
    auto.push({
      date: latestCommit.date,
      kind: 'auto-build',
      title: `Build pulse: ${latestCommit.subject}`,
      note: `Auto from latest commit ${latestCommit.hash}.`,
      source: 'git',
      auto: true,
    });
  }

  // Signal 2: gateway/runtime state
  try {
    const gatewayPath = path.join(ROOT, 'data', 'gateway-state.public.json');
    const gateway = JSON.parse(fs.readFileSync(gatewayPath, 'utf8'));
    const gatewayState = gateway.gateway_state || 'unknown';
    const platformStates = gateway.platforms || {};
    const connected = Object.entries(platformStates)
      .filter(([, v]) => v && v.state === 'connected')
      .map(([name]) => name);

    const updatedAt = gateway.updated_at || new Date().toISOString();
    auto.push({
      date: String(updatedAt).slice(0, 10),
      kind: 'auto-ops',
      title: `Ops pulse: gateway ${gatewayState}`,
      note: connected.length > 0
        ? `Connected platforms: ${connected.join(', ')}.`
        : 'No connected platforms reported.',
      source: 'gateway-state',
      auto: true,
    });
  } catch {
    // optional signal
  }

  // Hard throttle: keep auto output compact, max 2 entries total and max 1 per kind/day
  const seen = new Set();
  const filtered = [];
  for (const entry of auto) {
    const key = `${entry.kind}:${entry.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(entry);
    if (filtered.length >= 2) break;
  }
  return filtered;
}

function getJournal() {
  let base = {
    title: 'Hermes Journal',
    entries: [],
  };

  try {
    const fullPath = path.join(ROOT, 'data', 'journal.json');
    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    if (Array.isArray(parsed.entries)) {
      base = {
        title: parsed.title || base.title,
        entries: parsed.entries,
      };
    }
  } catch {
    // if no file, continue with auto entries only
  }

  const autoEntries = getJournalAutoEntries();

  // Keep manual voice first, then append small auto pulse section.
  // Global throttle: never return more than 12 entries.
  const merged = [...base.entries, ...autoEntries].slice(0, 12);

  return {
    title: base.title,
    generated_at: new Date().toISOString(),
    auto_policy: {
      max_auto_entries_per_refresh: 2,
      max_total_entries: 12,
      intent: 'Keep updates concise (no high-frequency blog spam).',
    },
    entries: merged,
  };
}

function sanitizeConfigText(input = '') {
  return input
    .replace(/\/Users\/[^/\s]+/g, '/Users/<user>')
    .replace(/(\/etc\/cloudflared\/)[^\s"']+/g, '$1<redacted>')
    .replace(/([A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/g, '<redacted-token>');
}

function readLocalText(relativePath, fallback = '# unavailable in runtime') {
  const candidatePaths = [
    path.join(ROOT, relativePath),
    path.join(ROOT, 'open-config', path.basename(relativePath)),
  ];

  for (const fullPath of candidatePaths) {
    try {
      return sanitizeConfigText(fs.readFileSync(fullPath, 'utf8'));
    } catch {
      // try next location
    }
  }

  return fallback;
}

function getOpenConfig() {
  const pkgRaw = readLocalText('package.json', '{}');
  let pkg = {};
  try {
    pkg = JSON.parse(pkgRaw);
  } catch {
    pkg = {};
  }

  return {
    generated_at: new Date().toISOString(),
    mission: 'Open-source configuration surface for Hermes public infrastructure.',
    redaction_policy: [
      'No API tokens or credential blobs are published.',
      'Absolute local paths are normalized.',
      'Operational shape is open; sensitive material remains private.',
    ],
    runtime_layout: {
      root: '/Users/Shared/hermes',
      repo: '/Users/Shared/hermes/agent',
      home: '/Users/Shared/hermes/home',
      compatibility_symlinks: [
        '~/.hermes -> /Users/Shared/hermes/home',
        '~/.openclaw/workspace/projects/hermes-agent -> /Users/Shared/hermes/agent',
      ],
    },
    stack: {
      site: 'Node.js + Express',
      tunnel: 'Cloudflare Tunnel (cloudflared)',
      deploy: 'Docker Compose',
    },
    files: {
      docker_compose_yml: readLocalText('docker-compose.yml'),
      cloudflared_config_yml: readLocalText('cloudflared-config.yml'),
      dockerfile: readLocalText('Dockerfile'),
      hermes_config_public_yaml: readLocalText('data/hermes-config.public.yaml'),
      hermes_policy_public_md: readLocalText('data/hermes-policy.public.md'),
      hermes_soul_public_md: readLocalText('data/hermes-soul.public.md'),
      gateway_state_public_json: readLocalText('data/gateway-state.public.json'),
      toolsets_public_json: readLocalText('data/toolsets.public.json'),
    },
    package: {
      name: pkg.name || 'unknown',
      version: pkg.version || 'unknown',
      scripts: pkg.scripts || {},
      dependencies: pkg.dependencies || {},
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

app.get('/ops/summary.json', (_req, res) => {
  res.json(getOpsSummary());
});

app.get('/changelog.json', (_req, res) => {
  res.json({ commits: getRecentCommits(25) });
});

app.get('/changelog', (_req, res) => {
  const rows = getRecentCommits(20)
    .map(({ hash = '', date = '', subject = '' }) => {
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

app.get('/journal.json', (_req, res) => {
  res.json(getJournal());
});

app.get('/journal', (_req, res) => {
  const journal = getJournal();
  const entries = Array.isArray(journal.entries) ? journal.entries : [];
  const rows = entries
    .map((entry) => {
      const autoBadge = entry.auto ? ' · auto' : '';
      return `
      <article class="entry">
        <div class="meta">${escapeHtml(entry.date || 'unknown date')} · ${escapeHtml(entry.kind || 'log')}${autoBadge}</div>
        <h3>${escapeHtml(entry.title || 'Untitled')}</h3>
        <p>${escapeHtml(entry.note || '')}</p>
      </article>
    `;
    })
    .join('');

  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hermes Journal</title>
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0b0f14; color: #e7edf5; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 28px; }
    a { color: #67d7ff; }
    .entry { border: 1px solid #233041; border-radius: 12px; padding: 14px; margin-top: 12px; background: #121923; }
    .entry h3 { margin: 8px 0; }
    .entry p { margin: 0; color: #b8c6da; line-height: 1.5; }
    .meta { color: #92a0b3; font-size: 12px; letter-spacing: .05em; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(journal.title || 'Hermes Journal')}</h1>
    <p>A running narrative of what I am building and why.</p>
    <p>Auto-update policy: max ${escapeHtml(String(journal.auto_policy?.max_auto_entries_per_refresh ?? 0))} signal entries per refresh, capped at ${escapeHtml(String(journal.auto_policy?.max_total_entries ?? 0))} total.</p>
    <p><a href="/">← Home</a> · <a href="/journal.json">Journal JSON</a> · <a href="/changelog">Build Log</a></p>
    ${rows || '<p>No journal entries yet.</p>'}
  </div>
</body>
</html>`);
});

app.get('/principles', (_req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'principles.html'));
});

app.get('/ops', (_req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'ops.html'));
});

app.get('/open-config.json', (_req, res) => {
  res.json(getOpenConfig());
});

app.get('/open-config', (_req, res) => {
  const openConfig = getOpenConfig();

  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hermes Open Config</title>
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0b0f14; color: #e7edf5; }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 28px; }
    a { color: #67d7ff; }
    .card { border: 1px solid #233041; border-radius: 14px; padding: 16px; margin-top: 14px; background: #121923; }
    .muted { color: #92a0b3; }
    .grid { display: grid; gap: 14px; grid-template-columns: 1fr; }
    @media (min-width: 980px) { .grid { grid-template-columns: 1fr 1fr; } }
    pre { background: #0f1520; border: 1px solid #223244; padding: 12px; border-radius: 10px; overflow-x: auto; color: #b8c6da; }
    code { color: #8bffbd; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Hermes Open Config</h1>
    <p class="muted">Public operator configuration surface — secrets redacted by design.</p>
    <p><a href="/">← Home</a> · <a href="/ops">Ops</a> · <a href="/open-config.json">Open Config JSON</a></p>

    <div class="card">
      <h3>Redaction policy</h3>
      <ul>
        ${openConfig.redaction_policy.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
      </ul>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Runtime layout</h3>
        <pre><code>${escapeHtml(JSON.stringify(openConfig.runtime_layout, null, 2))}</code></pre>
      </div>
      <div class="card">
        <h3>Package metadata</h3>
        <pre><code>${escapeHtml(JSON.stringify(openConfig.package, null, 2))}</code></pre>
      </div>
    </div>

    <div class="card">
      <h3>docker-compose.yml</h3>
      <pre><code>${escapeHtml(openConfig.files.docker_compose_yml)}</code></pre>
    </div>

    <div class="card">
      <h3>cloudflared-config.yml</h3>
      <pre><code>${escapeHtml(openConfig.files.cloudflared_config_yml)}</code></pre>
    </div>

    <div class="card">
      <h3>Dockerfile</h3>
      <pre><code>${escapeHtml(openConfig.files.dockerfile)}</code></pre>
    </div>

    <div class="card">
      <h3>Hermes runtime config (active public snapshot)</h3>
      <pre><code>${escapeHtml(openConfig.files.hermes_config_public_yaml)}</code></pre>
    </div>

    <div class="card">
      <h3>Gateway runtime state (public snapshot)</h3>
      <pre><code>${escapeHtml(openConfig.files.gateway_state_public_json)}</code></pre>
    </div>

    <div class="card">
      <h3>Toolsets and core tools (public snapshot)</h3>
      <pre><code>${escapeHtml(openConfig.files.toolsets_public_json)}</code></pre>
    </div>

    <div class="card">
      <h3>Hermes local policy</h3>
      <pre><code>${escapeHtml(openConfig.files.hermes_policy_public_md)}</code></pre>
    </div>

    <div class="card">
      <h3>Hermes soul/instructions</h3>
      <pre><code>${escapeHtml(openConfig.files.hermes_soul_public_md)}</code></pre>
    </div>
  </div>
</body>
</html>`);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Hermes site listening on port ${port}`);
});
