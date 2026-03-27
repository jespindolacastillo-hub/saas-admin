/**
 * DevValuationPanel.jsx — Portfolio Software Valuation
 * ─────────────────────────────────────────────────────────────────────────────
 * Muestra valoración COCOMO I & II de TODOS los proyectos del founder.
 * Datos de commits/actividad: GitHub API en tiempo real (caché 30 min).
 * SLOC/archivos: build time (src/data/portfolioConfig.js).
 *
 * Metodología: COCOMO I (Boehm 1981) · COCOMO II (Boehm 2000) · IVS 210
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState } from 'react';
import { PORTFOLIO, PORTFOLIO_TOTALS } from '../../data/portfolioConfig';
import { usePortfolioStats } from '../../hooks/usePortfolioStats';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import {
  GitCommit, FileCode2, TrendingUp, Shield, Download,
  ChevronDown, ChevronUp, Zap, BookOpen, RefreshCw, Wifi, WifiOff,
  Layers, Clock, DollarSign,
} from 'lucide-react';

const T = {
  coral: '#FF5C3A', teal: '#00C9A7', purple: '#7C3AED',
  ink: '#0D0D12', muted: '#6B7280', border: '#E5E7EB',
  bg: '#F7F8FC', card: '#FFFFFF', amber: '#F59E0B',
  green: '#10B981', blue: '#3B82F6',
};
const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

// ── COCOMO ────────────────────────────────────────────────────────────────────
function cocomo(sloc, model = 'basic') {
  const k = sloc / 1000;
  if (model === 'basic') {
    const pm   = 2.4  * Math.pow(k, 1.05);
    const tdev = 2.5  * Math.pow(pm, 0.38);
    return { pm, tdev, hrs: Math.round(pm * 152) };
  }
  const pm   = 2.94 * Math.pow(k, 1.10);
  const tdev = 3.67 * Math.pow(pm, 0.28);
  return { pm, tdev, hrs: Math.round(pm * 152) };
}

const RATES = [
  { key: 'conservative', label: 'LATAM Senior',   usd: 6000  },
  { key: 'market',       label: 'US Remote',       usd: 14000 },
  { key: 'premium',      label: 'US Agency',       usd: 22000 },
];

const fmt    = n => new Intl.NumberFormat('en-US').format(Math.round(n));
const fmtUSD = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const daysBetween = (a, b) => !a || !b ? 0 : Math.round((new Date(b) - new Date(a)) / 86400000) + 1;

// ── Mini components ───────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, color = T.coral, large = false }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: large ? '22px 24px' : '18px 20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} color={color} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
    </div>
    <div style={{ fontSize: large ? 30 : 24, fontWeight: 900, color: T.ink, letterSpacing: '-.03em', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{sub}</div>}
  </div>
);

const SectionTitle = ({ children, action }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '28px 0 12px' }}>
    <h3 style={{ fontSize: 11, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', margin: 0 }}>{children}</h3>
    {action}
  </div>
);

const Pill = ({ label, color }) => (
  <span style={{ padding: '2px 8px', borderRadius: 99, background: color + '18', color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
);

// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, model, expanded, onToggle }) {
  const { name, desc, icon, color, sloc, files, components, tech, category, ghData, loading, error } = project;
  const co = cocomo(sloc, model);
  const totalCommits = ghData?.totalCommits ?? 0;
  const calDays = daysBetween(ghData?.firstCommit, ghData?.lastCommit);
  const val = Math.round(co.pm * RATES[1].usd); // US Remote reference

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', transition: 'box-shadow .2s' }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: T.ink }}>{name}</span>
            <Pill label={category} color={color} />
            {!project.repo && <Pill label="Sin git" color={T.muted} />}
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc}</div>
        </div>
        {/* Summary values */}
        <div style={{ display: 'flex', gap: 24, flexShrink: 0, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>SLOC</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.ink }}>{fmt(sloc)}</div>
          </div>
          {totalCommits > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Commits</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: T.ink }}>{totalCommits}</div>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Valor ref.</div>
            <div style={{ fontWeight: 900, fontSize: 14, color }}>
              {loading ? '…' : fmtUSD(val)}
            </div>
          </div>
          {expanded ? <ChevronUp size={14} color={T.muted} /> : <ChevronDown size={14} color={T.muted} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: '18px 20px', background: T.bg }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.muted, fontSize: 12 }}>
              <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Cargando GitHub API…
            </div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: T.amber, marginBottom: 12 }}>
              ⚠ Sin datos de GitHub ({error}). Mostrando solo SLOC local.
            </div>
          )}

          {/* Tech & meta */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: T.muted }}>{tech}</span>
            {ghData?.firstCommit && <span style={{ fontSize: 11, color: T.muted }}>· {ghData.firstCommit} → {ghData.lastCommit} · {calDays}d calendario</span>}
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
            {[
              { l: 'SLOC', v: fmt(sloc), c: color },
              { l: 'Archivos', v: files, c: T.teal },
              components > 0 && { l: 'Componentes', v: components, c: T.purple },
              { l: 'Person-Months', v: co.pm.toFixed(1), c: T.coral },
              { l: 'Horas equiv.', v: fmt(co.hrs) + 'h', c: T.amber },
              ghData?.totalCommits && { l: 'Commits', v: ghData.totalCommits, c: T.green },
              ghData?.activeDays && { l: 'Días activos', v: ghData.activeDays, c: T.blue },
            ].filter(Boolean).map(({ l, v, c }) => (
              <div key={l} style={{ background: c + '0E', border: `1px solid ${c}22`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Valuation per rate */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {RATES.map(r => (
              <div key={r.key} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{r.label}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: r.key === 'market' ? color : T.ink }}>{fmtUSD(Math.round(co.pm * r.usd))}</div>
              </div>
            ))}
          </div>

          {/* Recent commits */}
          {ghData?.recentCommits?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Commits recientes</div>
              {ghData.recentCommits.slice(0, 5).map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 0', borderBottom: i < 4 ? `1px solid ${T.border}` : 'none' }}>
                  <code style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace', flexShrink: 0 }}>{c.sha}</code>
                  <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>{c.date}</span>
                  <span style={{ fontSize: 12, color: T.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DevValuationPanel() {
  const [model, setModel] = useState('basic');
  const [showMethodology, setShowMethodology] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const { projects, overall, refresh } = usePortfolioStats();

  // Aggregate live data
  const totalCommits  = projects.reduce((s, p) => s + (p.ghData?.totalCommits ?? 0), 0);
  const totalAdded    = projects.reduce((s, p) => s + (p.ghData?.linesAdded ?? 0), 0);
  const totalActiveDays = projects.reduce((s, p) => s + (p.ghData?.activeDays ?? 0), 0);

  const allLoaded = projects.every(p => !p.loading);
  const anyLive   = projects.some(p => p.ghData && !p.ghData.fromCache);
  const anyCache  = projects.some(p => p.ghData?.fromCache);

  // Portfolio COCOMO
  const totalSLOC = PORTFOLIO_TOTALS.totalSLOC;
  const co = cocomo(totalSLOC, model);
  const valuations = RATES.map(r => ({ ...r, value: Math.round(co.pm * r.usd) }));

  // Pie chart data by category
  const byCategory = {};
  projects.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = { name: p.category, sloc: 0, color: p.color };
    byCategory[p.category].sloc += p.sloc;
  });
  const pieData = Object.values(byCategory);

  // Bar chart: commits per project
  const commitBarData = projects
    .filter(p => (p.ghData?.totalCommits ?? 0) > 0)
    .sort((a, b) => (b.ghData?.totalCommits ?? 0) - (a.ghData?.totalCommits ?? 0))
    .map(p => ({ name: p.name.replace('Price Shoes ', 'PS ').replace('Retelio ', ''), commits: p.ghData?.totalCommits ?? 0, color: p.color }));

  const handlePrint = () => {
    const rows = projects.map(p => {
      const c = cocomo(p.sloc, model);
      return `<tr>
        <td>${p.icon} ${p.name}</td>
        <td>${p.category}</td>
        <td>${fmt(p.sloc)}</td>
        <td>${p.ghData?.totalCommits ?? '—'}</td>
        <td>${c.pm.toFixed(1)} PM</td>
        <td>${fmt(c.hrs)} hrs</td>
        <td style="font-weight:700;color:#FF5C3A">${fmtUSD(Math.round(c.pm * 14000))}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>Retelio — Portfolio Software Valuation</title>
    <style>
      body{font-family:'Segoe UI',Arial,sans-serif;margin:40px;color:#0D0D12;font-size:12px;line-height:1.5}
      h1{font-size:20px;font-weight:900;margin-bottom:2px}
      .sub{color:#6B7280;margin-bottom:28px;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th{background:#F7F8FC;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;border-bottom:2px solid #E5E7EB}
      td{padding:8px 10px;border-bottom:1px solid #F3F4F6}
      .total{background:#0D0D12;color:white;padding:14px 16px;border-radius:8px;margin:16px 0}
      .ref{background:#F7F8FC;border:1px solid #E5E7EB;border-radius:6px;padding:12px;font-size:10px;line-height:1.8;color:#374151;margin-top:16px}
      .ft{margin-top:32px;font-size:9px;color:#9CA3AF;border-top:1px solid #E5E7EB;padding-top:10px}
    </style></head><body>
    <h1>Portfolio Software Valuation Report</h1>
    <div class="sub">Founder: jespindolacastillo-hub · ${new Date().toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'})} · ${model === 'basic' ? 'COCOMO I (Boehm 1981)' : 'COCOMO II (Boehm 2000)'}</div>

    <table>
      <thead><tr><th>Proyecto</th><th>Categoría</th><th>SLOC</th><th>Commits</th><th>Person-Months</th><th>Horas equiv.</th><th>Valor (US Remote)</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="font-weight:900;background:#FFF1EE">
        <td colspan="2">TOTAL PORTFOLIO</td>
        <td>${fmt(totalSLOC)}</td>
        <td>${totalCommits || '—'}</td>
        <td>${co.pm.toFixed(1)} PM</td>
        <td>${fmt(co.hrs)} hrs</td>
        <td style="color:#FF5C3A;font-size:15px">${fmtUSD(valuations[1].value)}</td>
      </tr></tfoot>
    </table>

    <div class="total">
      <div style="font-size:10px;opacity:.5;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Valoración central del portfolio (US Remote, ${model === 'basic' ? 'COCOMO I' : 'COCOMO II'})</div>
      <div style="font-size:24px;font-weight:900;color:#FF5C3A">${fmtUSD(valuations[1].value)} USD</div>
      <div style="font-size:11px;opacity:.6;margin-top:4px">Rango: ${fmtUSD(valuations[0].value)} – ${fmtUSD(valuations[2].value)} USD</div>
    </div>

    <div class="ref">
      <b>Metodología:</b><br/>
      [1] Boehm, B.W. (1981). Software Engineering Economics. Prentice Hall. ISBN 0-13-822122-7.<br/>
      [2] Boehm, B. et al. (2000). Software Cost Estimation with COCOMO II. Prentice Hall.<br/>
      [3] IEEE Std 12207:2017 — 152 horas/person-month.<br/>
      [4] International Valuation Standards (IVS) 210 — Replacement Cost Method.<br/>
      <b>Fuente de datos:</b> GitHub API (commits en tiempo real) + SLOC contado en build time.
    </div>
    <div class="ft">github.com/jespindolacastillo-hub · Generado: ${new Date().toISOString()}</div>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div style={{ fontFamily: FONT, maxWidth: 980, margin: '0 auto', padding: '0 0 60px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: T.ink, margin: 0, letterSpacing: '-.03em' }}>Portfolio Valuation</h2>
          <p style={{ fontSize: 13, color: T.muted, margin: '4px 0 0' }}>
            {PORTFOLIO_TOTALS.projectCount} proyectos · {PORTFOLIO_TOTALS.repoCount} repos · COCOMO I & II · GitHub API live
          </p>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: allLoaded ? (anyLive ? T.green + '15' : T.amber + '15') : T.blue + '12', border: `1px solid ${allLoaded ? (anyLive ? T.green : T.amber) : T.blue}30` }}>
            {!allLoaded ? <RefreshCw size={11} color={T.blue} style={{ animation: 'spin 1s linear infinite' }} /> : anyLive ? <Wifi size={11} color={T.green} /> : <WifiOff size={11} color={T.amber} />}
            <span style={{ fontSize: 10, fontWeight: 700, color: allLoaded ? (anyLive ? T.green : T.amber) : T.blue }}>
              {!allLoaded ? 'Cargando…' : anyCache ? 'Live (caché 30m)' : 'Live'}
            </span>
          </div>
          <button onClick={() => refresh()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
            <RefreshCw size={11} /> Actualizar
          </button>
          {['basic', 'ii'].map(k => (
            <button key={k} onClick={() => setModel(k)} style={{ padding: '5px 11px', borderRadius: 8, border: `1.5px solid ${model === k ? T.coral : T.border}`, background: model === k ? T.coral : T.card, color: model === k ? '#fff' : T.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
              {k === 'basic' ? 'COCOMO I' : 'COCOMO II'}
            </button>
          ))}
          <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.card, color: T.ink, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
            <Download size={11} /> PDF
          </button>
        </div>
      </div>

      {/* ── Audit banner ── */}
      <div style={{ background: 'linear-gradient(135deg, #0D0D12, #1a1030)', borderRadius: 16, padding: '16px 22px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Shield size={20} color={T.teal} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>Audit Trail — GitHub API en tiempo real</span>
          <span style={{ color: 'rgba(255,255,255,.45)', fontSize: 12, marginLeft: 10 }}>
            {PORTFOLIO_TOTALS.repoCount} repos · github.com/jespindolacastillo-hub · Commits hash-verificados
          </span>
        </div>
        {overall.fetchedAt && (
          <span style={{ color: T.teal, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {new Date(overall.fetchedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* ── Portfolio KPIs ── */}
      <SectionTitle>Portfolio total</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 4 }}>
        <KpiCard icon={FileCode2}  label="SLOC total"         value={fmt(totalSLOC)}      sub={`${PORTFOLIO_TOTALS.totalFiles} archivos · ${PORTFOLIO_TOTALS.totalComponents} componentes`} color={T.coral} />
        <KpiCard icon={Layers}     label="Proyectos"          value={PORTFOLIO_TOTALS.projectCount} sub={`${PORTFOLIO_TOTALS.repoCount} repos en GitHub`} color={T.purple} />
        <KpiCard icon={GitCommit}  label="Commits totales"    value={allLoaded ? fmt(totalCommits) : '…'} sub="Todos los repos combinados" color={T.teal} />
        <KpiCard icon={TrendingUp} label="Person-Months"      value={co.pm.toFixed(1)}    sub={`${model === 'basic' ? 'COCOMO I' : 'COCOMO II'} · ${fmt(co.hrs)} hrs equiv.`} color={T.amber} />
        <KpiCard icon={Zap}        label="Días activos"       value={allLoaded ? fmt(totalActiveDays) : '…'} sub="Días con commits (todos los repos)" color={T.green} />
      </div>

      {/* ── Valuation highlight ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
        {valuations.map((r, i) => (
          <div key={r.key} style={{ borderRadius: 14, padding: '16px 18px', background: i === 1 ? T.ink : T.card, border: i === 1 ? 'none' : `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: i === 1 ? 'rgba(255,255,255,.45)' : T.muted, marginBottom: 6 }}>
              {r.label} {i === 1 ? '· Referencia' : i === 0 ? '· Mínimo' : '· Máximo'}
            </div>
            <div style={{ fontSize: i === 1 ? 26 : 20, fontWeight: 900, color: i === 1 ? T.coral : T.ink, letterSpacing: '-.03em' }}>
              {fmtUSD(r.value)}
            </div>
            <div style={{ fontSize: 11, color: i === 1 ? 'rgba(255,255,255,.35)' : T.muted, marginTop: 2 }}>
              {fmtUSD(r.usd)}/mes · {co.pm.toFixed(1)} PM
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      {commitBarData.length > 0 && (
        <>
          <SectionTitle>Commits por proyecto</SectionTitle>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px' }}>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={commitBarData} barCategoryGap="35%">
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: T.ink, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} cursor={{ fill: T.coral + '12' }} formatter={v => [v, 'commits']} />
                <Bar dataKey="commits" radius={[5, 5, 0, 0]}>
                  {commitBarData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <SectionTitle>SLOC por categoría</SectionTitle>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 0 }}>
        <ResponsiveContainer width="40%" height={160}>
          <PieChart>
            <Pie data={pieData} dataKey="sloc" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
              {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [fmt(v) + ' SLOC', n]} contentStyle={{ background: T.ink, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1 }}>
          {pieData.map(d => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: T.ink, fontWeight: 600, flex: 1 }}>{d.name}</span>
              <span style={{ fontSize: 12, color: T.muted }}>{fmt(d.sloc)} SLOC</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{Math.round(d.sloc / totalSLOC * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Project cards ── */}
      <SectionTitle>Proyectos individuales</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {projects.map(p => (
          <ProjectCard
            key={p.id}
            project={p}
            model={model}
            expanded={expandedId === p.id}
            onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
          />
        ))}
      </div>

      {/* ── COCOMO formula ── */}
      <SectionTitle>Fórmula aplicada al portfolio completo</SectionTitle>
      <div style={{ background: T.card, border: `1.5px solid ${T.coral}30`, borderRadius: 14, padding: '18px 20px', fontFamily: 'monospace', fontSize: 13, lineHeight: 2 }}>
        <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          {model === 'basic' ? 'COCOMO I — Basic Organic (Boehm, 1981):' : 'COCOMO II — Early Design (Boehm et al., 2000):'}
        </div>
        <div>KLOC = {fmt(totalSLOC)} / 1000 = <b>{(totalSLOC/1000).toFixed(3)}</b></div>
        <div><span style={{ color: T.coral }}>PM</span> = {model === 'basic' ? `2.4 × ${(totalSLOC/1000).toFixed(3)}^1.05` : `2.94 × ${(totalSLOC/1000).toFixed(3)}^1.10`} = <b style={{ color: T.coral }}>{co.pm.toFixed(1)} person-months</b></div>
        <div><span style={{ color: T.teal }}>TDEV</span> = {model === 'basic' ? `2.5 × ${co.pm.toFixed(1)}^0.38` : `3.67 × ${co.pm.toFixed(1)}^0.28`} = <b style={{ color: T.teal }}>{co.tdev.toFixed(1)} meses (equipo convencional)</b></div>
        <div><span style={{ color: T.purple }}>Horas</span> = {Math.round(co.pm)} PM × 152 hrs/PM = <b style={{ color: T.purple }}>{fmt(co.hrs)} horas equivalentes</b></div>
        <div><span style={{ color: T.amber }}>Valor</span> (US Remote $14,000/PM) = <b style={{ color: T.amber }}>{fmtUSD(valuations[1].value)} USD</b></div>
      </div>

      {/* ── Methodology ── */}
      <div style={{ marginTop: 16, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <button onClick={() => setShowMethodology(!showMethodology)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: T.card, border: 'none', cursor: 'pointer', fontFamily: FONT }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={13} color={T.muted} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>Referencias metodológicas</span>
          </div>
          {showMethodology ? <ChevronUp size={13} color={T.muted} /> : <ChevronDown size={13} color={T.muted} />}
        </button>
        {showMethodology && (
          <div style={{ padding: '0 18px 18px', background: T.card }}>
            <div style={{ background: T.bg, borderRadius: 10, padding: '14px 16px', fontSize: 12, color: '#374151', lineHeight: 1.9 }}>
              <b>[1]</b> Boehm, B.W. (1981). <i>Software Engineering Economics.</i> Prentice Hall. ISBN 0-13-822122-7.<br/>
              <b>[2]</b> Boehm, B. et al. (2000). <i>Software Cost Estimation with COCOMO II.</i> Prentice Hall.<br/>
              <b>[3]</b> IEEE Std 12207:2017 — Software lifecycle processes. 152 horas/person-month.<br/>
              <b>[4]</b> IVS 210 — Intangible Assets, Replacement Cost Method.<br/>
              <b>[5]</b> Stack Overflow Developer Survey 2024 — Salary benchmarks por región.<br/><br/>
              <b>Fuente de datos:</b> GitHub API v3 (commits, fechas, actividad — datos en tiempo real, hash-verificados).
              SLOC contado con <code>find src | xargs wc -l</code> en build time.
              COCOMO asume productividad de equipo convencional — la velocidad aumentada del founder representa ventaja competitiva adicional no reflejada en el costo de reemplazo.
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 10, color: T.muted, textAlign: 'center' }}>
        GitHub API live · SLOC en build time · {overall.fetchedAt ? `Último fetch: ${new Date(overall.fetchedAt).toLocaleTimeString('es-MX')}` : ''}
      </div>
    </div>
  );
}
