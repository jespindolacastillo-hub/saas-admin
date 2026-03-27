/**
 * useGitHubStats.js
 * Fetches live repository metrics from GitHub API.
 * Caches results 30 min in localStorage to avoid rate limits.
 *
 * Requires: VITE_GITHUB_TOKEN (fine-grained PAT, read-only, this repo)
 * Repo: jespindolacastillo-hub/saas-admin
 */
import { useState, useEffect } from 'react';

const OWNER = 'jespindolacastillo-hub';
const REPO  = 'saas-admin';
const CACHE_KEY = 'gh_stats_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getHeaders() {
  const token = import.meta.env.VITE_GITHUB_TOKEN;
  const h = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch(path) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, { headers: getHeaders() });
  if (!r.ok) throw new Error(`GitHub API ${path}: ${r.status}`);
  return r.json();
}

/** Paginate all commits (GitHub max 100/page) */
async function fetchAllCommits() {
  let page = 1;
  const all = [];
  while (true) {
    const batch = await ghFetch(`/commits?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

async function fetchLiveStats() {
  // Run in parallel what we can
  const [commits, codeFreq, commitActivity] = await Promise.all([
    fetchAllCommits(),
    // code_frequency: [timestamp, additions, deletions] per week — returns 202 first time (GitHub computing)
    ghFetch('/stats/code_frequency').catch(() => []),
    ghFetch('/stats/commit_activity').catch(() => []),
  ]);

  // ── Commit analysis ───────────────────────────────────────────────────────
  const totalCommits = commits.length;
  const dates = commits.map(c => c.commit.author.date.slice(0, 10));
  const firstCommit = dates[dates.length - 1];
  const lastCommit  = dates[0];
  const activeDays  = new Set(dates).size;

  // Activity per day (commits count)
  const dayMap = {};
  dates.forEach(d => { dayMap[d] = (dayMap[d] || 0) + 1; });
  const topDays = Object.entries(dayMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([date, count]) => ({ date, commits: count }));

  // Recent commits for log
  const recentCommits = commits.slice(0, 15).map(c => ({
    date: c.commit.author.date.slice(0, 10),
    msg:  c.commit.message.split('\n')[0].trim(),
    sha:  c.sha.slice(0, 7),
  }));

  // ── Code frequency ────────────────────────────────────────────────────────
  let linesAdded = 0;
  let linesDeleted = 0;
  if (Array.isArray(codeFreq) && codeFreq.length && typeof codeFreq[0] === 'object' && !codeFreq.status) {
    codeFreq.forEach(([, add, del]) => {
      linesAdded   += add;
      linesDeleted += Math.abs(del);
    });
  }

  // ── Commit activity (last 52 weeks) ───────────────────────────────────────
  const weeklyActivity = Array.isArray(commitActivity) ? commitActivity.map(w => ({
    week: new Date(w.week * 1000).toISOString().slice(0, 10),
    total: w.total,
  })).filter(w => w.total > 0) : [];

  return {
    generatedAt: new Date().toISOString(),
    live: true,
    repo: { firstCommit, lastCommit, totalCommits, activeDays },
    code: { linesAdded, linesDeleted },
    activity: { topDays, recentCommits, weeklyActivity },
  };
}

export function useGitHubStats(slocFallback) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    async function load() {
      // 1. Try cache
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL) {
            setData({ ...cached.data, code: { ...cached.data.code, sloc: slocFallback } });
            setFromCache(true);
            setLoading(false);
            return;
          }
        }
      } catch (_) {}

      // 2. Fetch live
      try {
        const live = await fetchLiveStats();
        const full = { ...live, code: { ...live.code, sloc: slocFallback } };
        localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: new Date().toISOString(), data: live }));
        setData(full);
      } catch (e) {
        setError(e.message);
        // 3. Fall back to static devStats.js data
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slocFallback]);

  const refresh = () => {
    localStorage.removeItem(CACHE_KEY);
    setLoading(true);
    setFromCache(false);
    setData(null);
    setError(null);
    // re-trigger via key change handled by parent, or just reload
    window.location.reload();
  };

  return { data, loading, error, fromCache, refresh };
}
