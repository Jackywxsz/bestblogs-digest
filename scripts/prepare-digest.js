#!/usr/bin/env node
/**
 * prepare-digest.js
 * Reads raw article JSON from stdin (output of fetch-rss.js),
 * applies deduplication, time filtering, and assembles a
 * complete LLM-ready digest blob to stdout.
 *
 * Usage: node fetch-rss.js | node prepare-digest.js
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(homedir(), '.bestblogs-digest');
const STATE_FILE = join(CONFIG_DIR, 'state.json');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const LOCAL_PROMPTS_DIR = join(__dirname, '..', 'prompts');
const USER_PROMPTS_DIR = join(CONFIG_DIR, 'prompts');

const REMOTE_PROMPTS_BASE = 'https://raw.githubusercontent.com/qujingde/bestblogs-digest/main/prompts';

// --- Load state (dedup + lastRun) ---
function loadState() {
  if (!existsSync(STATE_FILE)) return { seenGuids: {}, lastRun: null };
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { seenGuids: {}, lastRun: null };
  }
}

// --- Load config ---
function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    return { frequency: 'daily', maxArticles: 15 };
  }
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { frequency: 'daily', maxArticles: 15 };
  }
}

// --- Load a prompt file (user override > remote > local) ---
async function loadPrompt(filename) {
  // 1. User custom override
  const userPath = join(USER_PROMPTS_DIR, filename);
  if (existsSync(userPath)) {
    return readFileSync(userPath, 'utf8');
  }

  // 2. Remote (latest from GitHub)
  try {
    const res = await fetch(`${REMOTE_PROMPTS_BASE}/${filename}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return await res.text();
  } catch {
    // fall through to local
  }

  // 3. Local bundled fallback
  const localPath = join(LOCAL_PROMPTS_DIR, filename);
  if (existsSync(localPath)) {
    return readFileSync(localPath, 'utf8');
  }

  return '';
}

// --- Prune seen GUIDs older than 30 days ---
function pruneState(seenGuids) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const pruned = {};
  for (const [guid, date] of Object.entries(seenGuids)) {
    if (new Date(date) > cutoff) pruned[guid] = date;
  }
  return pruned;
}

// --- Read stdin ---
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// --- Main ---
async function main() {
  const raw = await readStdin();
  const articles = JSON.parse(raw);

  const state = loadState();
  const config = loadConfig();

  // Prune old entries
  state.seenGuids = pruneState(state.seenGuids);

  // Determine time window
  const windowHours = config.frequency === 'weekly' ? 168 : 24;
  const windowStart = state.lastRun
    ? new Date(state.lastRun)
    : new Date(Date.now() - windowHours * 60 * 60 * 1000);

  // Filter: not seen + within time window
  const newArticles = articles.filter(article => {
    if (state.seenGuids[article.guid]) return false;
    if (!article.pubDate) return true;
    return new Date(article.pubDate) >= windowStart;
  });

  // Sort by score desc, then pubDate desc
  newArticles.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.pubDate) - new Date(a.pubDate);
  });

  // Cap at maxArticles
  const maxArticles = config.maxArticles || 15;
  const selected = newArticles.slice(0, maxArticles);

  // Load prompts
  const curatePrompt = await loadPrompt('digest-curate.md');

  const now = new Date().toISOString();
  const blob = {
    meta: {
      generatedAt: now,
      articleCount: selected.length,
      frequency: config.frequency || 'daily',
      dateRange: {
        from: windowStart.toISOString().split('T')[0],
        to: now.split('T')[0],
      },
    },
    prompts: {
      curate: curatePrompt,
    },
    articles: selected,
  };

  process.stdout.write(JSON.stringify(blob, null, 2));
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
