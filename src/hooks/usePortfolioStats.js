/**
 * usePortfolioStats.js
 * Fetches live GitHub API stats for ALL repos in the founder's portfolio.
 * Caches per-repo in localStorage (30 min TTL).
 *
 * SLOC values are computed at build time (scripts/update-portfolio-stats.sh)
 * and injected via src/data/portfolioConfig.js
 */
import { useState, useEffect } from 'react';
import { PORTFOLIO } from '../data/portfolioConfig';

const OWNER   = 'jespindolacastillo-hub';
const TTL     = 30 * 60 * 1000; // 30 min
const CACHE_PREFIX = 'gh_repo_';

function getHeaders() {
  const token = import.meta.env.VITE_GITHUB_TOKEN;
  const h = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch(path) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${path}`, { headers: getHeaders() });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

async function fetchAllCommits(repo) {
  let page = 1, all = [];
  while (true) {
    const batch = await ghFetch(`${repo}/commits?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

async function fetchRepoStats(repo) {
  const cacheKey = CACHE_PREFIX + repo;
  // Check cache
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const c = JSON.parse(raw);
      if (Date.now() - new Date(c.fetchedAt).getTime() < TTL) return { ...c.data, fromCache: true };
    }
  } catch (_) {}

  // Fetch live
  const [commits, codeFreq] = await Promise.all([
    fetchAllCommits(repo),
    ghFetch(`${repo}/stats/code_frequency`).catch(() => []),
  ]);

  const dates = commits.map(c => c.commit.author.date.slice(0, 10));
  let linesAdded = 0, linesDeleted = 0;
  if (Array.isArray(codeFreq) && codeFreq.length && Array.isArray(codeFreq[0])) {
    codeFreq.forEach(([, a, d]) => { linesAdded += a; linesDeleted += Math.abs(d); });
  }

  const dayMap = {};
  dates.forEach(d => { dayMap[d] = (dayMap[d] || 0) + 1; });

  const data = {
    repo,
    totalCommits: commits.length,
    firstCommit:  dates[dates.length - 1] || null,
    lastCommit:   dates[0] || null,
    activeDays:   new Set(dates).size,
    linesAdded,
    linesDeleted,
    topDays: Object.entries(dayMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([date,count])=>({date,count})),
    recentCommits: commits.slice(0, 8).map(c => ({
      date: c.commit.author.date.slice(0, 10),
      msg:  c.commit.message.split('\n')[0].trim(),
      sha:  c.sha.slice(0, 7),
    })),
    fetchedAt: new Date().toISOString(),
    fromCache: false,
  };

  try { localStorage.setItem(CACHE_PREFIX + repo, JSON.stringify({ fetchedAt: data.fetchedAt, data })); } catch (_) {}
  return data;
}

export function usePortfolioStats() {
  const [projects, setProjects] = useState(
    PORTFOLIO.map(p => ({ ...p, loading: !!p.repo, error: null, ghData: null }))
  );
  const [overall, setOverall] = useState({ loading: true, fetchedAt: null });

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled(
        PORTFOLIO.map(p => p.repo ? fetchRepoStats(p.repo) : Promise.resolve(null))
      );

      setProjects(PORTFOLIO.map((p, i) => {
        const r = results[i];
        return {
          ...p,
          loading: false,
          error:   r.status === 'rejected' ? r.reason?.message : null,
          ghData:  r.status === 'fulfilled' ? r.value : null,
        };
      }));

      setOverall({ loading: false, fetchedAt: new Date().toISOString() });
    }
    load();
  }, []);

  const refresh = (repo) => {
    if (repo) localStorage.removeItem(CACHE_PREFIX + repo);
    else PORTFOLIO.forEach(p => p.repo && localStorage.removeItem(CACHE_PREFIX + p.repo));
    window.location.reload();
  };

  return { projects, overall, refresh };
}
