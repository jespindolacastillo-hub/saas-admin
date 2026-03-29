/**
 * DistributorPortal.jsx
 * Portal completo para distribuidores aprobados.
 * Muestra funnel, clientes, comisiones, metas y genera el kit PDF.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Copy, Check, ChevronLeft, ChevronRight, FileText, Target,
  TrendingUp, Users, MousePointerClick, DollarSign, Award,
  AlertCircle, Loader, Star, Clock, CheckCircle2, XCircle,
} from 'lucide-react';

// ── Tokens ────────────────────────────────────────────────────────────────────
const T = {
  coral: '#FF5C3A', teal: '#00C9A7', purple: '#7C3AED',
  ink: '#0D0D12', muted: '#6B7280', border: '#E5E7EB',
  bg: '#F7F8FC', card: '#FFFFFF', green: '#16A34A',
  amber: '#F59E0B', red: '#EF4444', blue: '#3B82F6',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";
const TIERS = {
  bronze: { label: 'Bronce',  color: '#CD7F32', next: 'Plata',  threshold: 6  },
  silver: { label: 'Plata',   color: '#64748B', next: 'Oro',    threshold: 21 },
  gold:   { label: 'Oro',     color: '#F59E0B', next: null,     threshold: null },
};
const SEGMENTS_LABEL = {
  restaurant: 'Restaurantes', hotel: 'Hoteles', retail: 'Retail',
  health: 'Salud', auto: 'Automotriz', services: 'Servicios',
  medical: 'Clínicas', edu: 'Educación',
};
const REFERRAL_BASE = import.meta.env.VITE_LANDING_URL || 'https://retelio.com.mx';

// ── Helpers ───────────────────────────────────────────────────────────────────
function periodLabel(y, m) {
  return new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}
function fmtMXN(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-MX');
}
function pct(a, b) {
  if (!b) return '0%';
  return Math.round((a / b) * 100) + '%';
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      style={{ background: 'none', border: `1px solid ${copied ? T.teal : T.border}`, borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: copied ? T.teal : T.muted, fontFamily: font }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copiado' : label || 'Copiar'}
    </button>
  );
}

// ── Tier badge ────────────────────────────────────────────────────────────────
function TierBadge({ tier }) {
  const t = TIERS[tier] || TIERS.bronze;
  return (
    <span style={{ background: t.color + '20', color: t.color, border: `1px solid ${t.color}40`, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Star size={11} fill={t.color} /> {t.label}
    </span>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KPI({ icon, label, value, sub, color = T.teal, big }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14, fontFamily: font }}>
      <div style={{ background: color + '15', borderRadius: 10, padding: 10, color, display: 'flex', flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: big ? 28 : 24, fontWeight: 900, color: T.ink, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Funnel ────────────────────────────────────────────────────────────────────
function Funnel({ clicks, signups, active, mrr }) {
  const steps = [
    { label: 'Clics en link', value: clicks, color: T.purple, w: 100 },
    { label: 'Registros', value: signups, color: T.teal, w: 75, rate: pct(signups, clicks) },
    { label: 'Clientes activos', value: active, color: T.coral, w: 55, rate: pct(active, signups) },
    { label: 'MRR generado', value: fmtMXN(mrr), color: T.amber, w: 38, rate: null },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
      {steps.map((s, i) => (
        <div key={s.label}>
          {i > 0 && s.rate && (
            <div style={{ textAlign: 'center', fontSize: 10, color: T.muted, margin: '2px 0', fontWeight: 600 }}>
              ↓ {s.rate} conversión
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: `${s.w}%`, background: s.color + '18', border: `1.5px solid ${s.color}40`,
                borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.value ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tier progress ─────────────────────────────────────────────────────────────
function TierProgress({ tier, activeClients }) {
  const t = TIERS[tier] || TIERS.bronze;
  if (!t.next) {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <Star size={28} fill={T.amber} color={T.amber} style={{ marginBottom: 6 }} />
        <div style={{ fontSize: 13, fontWeight: 800, color: T.amber }}>Nivel máximo — Oro</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>¡Felicidades! Eres distribuidor Gold.</div>
      </div>
    );
  }
  const progress = Math.min((activeClients / t.threshold) * 100, 100);
  const remaining = Math.max(t.threshold - activeClients, 0);
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, fontWeight: 700 }}>
        <span style={{ color: t.color }}>{t.label}</span>
        <span style={{ color: T.muted }}>{t.next} →</span>
      </div>
      <div style={{ background: T.bg, borderRadius: 99, height: 10, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${t.color}, ${TIERS[tier === 'bronze' ? 'silver' : 'gold'].color})`, height: '100%', borderRadius: 99, transition: 'width 0.8s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: T.muted, textAlign: 'center' }}>
        {activeClients} clientes activos · <strong style={{ color: T.ink }}>{remaining} más para {t.next}</strong>
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    active:  { label: 'Activo',  color: T.teal,   icon: <CheckCircle2 size={11} /> },
    trial:   { label: 'Trial',   color: T.amber,  icon: <Clock size={11} /> },
    churned: { label: 'Perdido', color: T.red,    icon: <XCircle size={11} /> },
  };
  const s = map[status] || map.trial;
  return (
    <span style={{ background: s.color + '15', color: s.color, borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {s.icon}{s.label}
    </span>
  );
}

// ── Goal tracker ──────────────────────────────────────────────────────────────
function GoalTracker({ goal, actual, distributorId, period, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(goal || 0);
  const [saving, setSaving] = useState(false);

  const progress = goal ? Math.min((actual / goal) * 100, 100) : 0;
  const projection = actual; // simplificado — en producción usar curva de tiempo

  const save = async () => {
    setSaving(true);
    await supabase.from('distributor_goals').upsert(
      { distributor_id: distributorId, period, goal_clients: val },
      { onConflict: 'distributor_id,period' }
    );
    setSaving(false);
    setEditing(false);
    onUpdated();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>Meta del mes</div>
        {!editing ? (
          <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: T.coral, fontWeight: 700, fontFamily: font }}>
            {goal ? 'Editar' : 'Establecer meta'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="number" value={val} onChange={e => setVal(+e.target.value)} min={1}
              style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 13, fontFamily: font }} />
            <button onClick={save} disabled={saving} style={{ background: T.coral, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
              {saving ? '…' : 'OK'}
            </button>
            <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontFamily: font }}>✕</button>
          </div>
        )}
      </div>
      {goal ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted, marginBottom: 6 }}>
            <span>{actual} clientes activos</span><span>Meta: {goal}</span>
          </div>
          <div style={{ background: T.bg, borderRadius: 99, height: 12, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${progress}%`, background: progress >= 100 ? T.teal : `linear-gradient(90deg, ${T.coral}, ${T.amber})`, height: '100%', borderRadius: 99, transition: 'width 0.8s' }} />
          </div>
          <div style={{ fontSize: 11, color: T.muted, textAlign: 'center' }}>
            {progress >= 100
              ? <span style={{ color: T.teal, fontWeight: 800 }}>🎉 ¡Meta alcanzada!</span>
              : <span>Llevas <strong style={{ color: T.ink }}>{Math.round(progress)}%</strong> · faltan {goal - actual} clientes</span>
            }
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: T.muted, textAlign: 'center', padding: '8px 0' }}>
          Sin meta establecida para este mes
        </div>
      )}
    </div>
  );
}

// ── PDF kit generator (usa el diseño de retelio-kit-distribuidor.html) ────────
function generatePDF(dist) {
  const refUrl = `${REFERRAL_BASE}?ref=${dist.code}`;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"/>
<title>Kit de Ventas — ${dist.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--coral:#FF5C3A;--teal:#00C9A7;--ink:#0A0A0F;--ink2:#1C1C24;--muted:#6B6B7A;--border:#E8E7E4;--bg:#F5F4F1;--white:#FFFFFF;--display:'Figtree',sans-serif;--mono:'DM Mono',monospace}
body{font-family:var(--display);background:#fff;width:210mm;min-height:297mm;margin:0 auto}
.op-header{background:var(--ink);padding:22px 26px 20px}
.op-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.logo-grid{display:grid;grid-template-columns:repeat(4,6px);gap:1.5px}
.ld{width:6px;height:6px;border-radius:1px}
.op-logo-word{font-size:16px;font-weight:800;color:#fff;letter-spacing:-.03em;margin-left:9px}
.op-tag{font-family:var(--mono);font-size:9px;color:rgba(255,255,255,.35);border:1px solid rgba(255,255,255,.1);padding:3px 9px;border-radius:100px}
.op-h1{font-size:32px;font-weight:900;letter-spacing:-.04em;line-height:1.0;color:#fff;margin-bottom:10px}
.op-h1 .c{color:var(--coral)}.op-h1 .t{color:var(--teal)}
.op-sub{font-size:11.5px;color:rgba(255,255,255,.5);margin-bottom:14px;line-height:1.5}
.op-pill{font-size:10px;font-weight:700;color:var(--teal);font-family:var(--mono)}
.op-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:14px 26px}
.op-stat{background:var(--bg);border-radius:8px;padding:10px 12px}
.op-stat-num{font-size:22px;font-weight:900;letter-spacing:-.04em;line-height:1}
.op-stat-lbl{font-size:9px;color:var(--muted);margin-top:2px;line-height:1.3;font-family:var(--mono)}
.op-problem{background:var(--coral);padding:10px 26px;font-size:10.5px;font-weight:600;color:#fff;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;text-align:center;line-height:1.5}
.op-problem-sep{color:rgba(255,255,255,.3)}
.op-body{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px 26px}
.op-sec-lbl{font-family:var(--mono);font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
.op-sec-title{font-size:18px;font-weight:900;letter-spacing:-.03em;line-height:1.1;margin-bottom:12px}
.op-flow{display:flex;flex-direction:column;gap:0}
.op-step{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)}
.op-step:last-child{border-bottom:none}
.op-step-icon{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
.op-step-title{font-size:11.5px;font-weight:700;margin-bottom:2px}
.op-step-desc{font-size:10px;color:var(--muted);line-height:1.45}
.op-outcomes{display:flex;flex-direction:column;gap:8px}
.op-outcome{border-radius:9px;padding:12px 13px}
.op-outcome.green{background:#F0FAF7;border:1px solid #C2EDE3}
.op-outcome.orange{background:#FFF4F1;border:1px solid #FFD4C8}
.op-outcome.dark{background:var(--ink);border:1px solid var(--ink2)}
.op-outcome-num{font-size:24px;font-weight:900;letter-spacing:-.04em;line-height:1;margin-bottom:2px}
.op-outcome-lbl{font-size:11px;font-weight:700;margin-bottom:3px}
.op-outcome-desc{font-size:9.5px;color:var(--muted);line-height:1.4}
.op-outcome.dark .op-outcome-lbl,.op-outcome.dark .op-outcome-num{color:#fff}
.op-outcome.dark .op-outcome-desc{color:rgba(255,255,255,.4)}
.op-pricing{padding:0 26px 14px}
.op-plans{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.op-plan{border-radius:9px;padding:12px 11px;border:1px solid var(--border)}
.op-plan.featured{border:2px solid var(--coral);background:#FFF9F8}
.op-plan.dark{background:var(--ink);border-color:var(--ink2)}
.op-plan-name{font-size:8px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:4px}
.op-plan.dark .op-plan-name{color:rgba(255,255,255,.35)}
.op-plan-price{font-size:20px;font-weight:900;letter-spacing:-.04em;line-height:1;margin-bottom:1px}
.op-plan-per{font-size:8.5px;color:var(--muted);font-family:var(--mono);margin-bottom:7px}
.op-plan.dark .op-plan-per{color:rgba(255,255,255,.3)}
.op-plan-feat{font-size:9px;color:var(--muted);margin-bottom:3px;padding-left:10px;position:relative;line-height:1.35}
.op-plan-feat::before{content:'✓';position:absolute;left:0;color:var(--teal);font-size:8px}
.op-plan.dark .op-plan-feat{color:rgba(255,255,255,.5)}
.op-plan-roi{margin-top:7px;padding-top:7px;border-top:1px solid var(--border);font-size:8.5px;color:var(--coral);font-weight:700;font-style:italic;line-height:1.3}
.op-plan.dark .op-plan-roi{border-color:rgba(255,255,255,.08);color:var(--teal)}
.op-plan.dark .op-plan-price{color:#fff}
.op-pitch{background:var(--ink);margin:0 26px 14px;border-radius:10px;padding:14px 16px}
.op-pitch-title{font-size:12px;font-weight:800;color:#fff;margin-bottom:10px}
.op-pitches{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.op-pitch-num{font-size:10px;font-weight:700;color:var(--coral);margin-bottom:4px;font-family:var(--mono)}
.op-pitch-head{font-size:11px;font-weight:700;color:#fff;margin-bottom:3px}
.op-pitch-text{font-size:9.5px;color:rgba(255,255,255,.5);line-height:1.45;font-style:italic}
.op-footer{background:var(--coral);padding:16px 26px}
.op-footer-cta{font-size:18px;font-weight:900;color:#fff;letter-spacing:-.03em;margin-bottom:4px}
.op-footer-sub{font-size:10px;color:rgba(255,255,255,.7);margin-bottom:14px}
.op-footer-sep{border-top:1px solid rgba(255,255,255,.2);margin-bottom:12px}
.op-dist-block{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center}
.op-dist-label{font-family:var(--mono);font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:6px}
.op-dist-name{font-size:15px;font-weight:800;color:#fff;margin-bottom:2px}
.op-dist-company{font-size:10px;color:rgba(255,255,255,.6);margin-bottom:8px}
.op-dist-contacts{display:flex;gap:14px;flex-wrap:wrap}
.op-dist-contact{font-size:10px;color:rgba(255,255,255,.85)}
.op-dist-qr-area{text-align:center;flex-shrink:0}
.op-dist-qr-box{background:#fff;border-radius:8px;padding:6px;width:72px;height:72px;display:flex;align-items:center;justify-content:center;margin:0 auto 4px}
.op-dist-qr-lbl{font-size:8px;color:rgba(255,255,255,.6);font-family:var(--mono)}
.op-dist-ref{font-family:var(--mono);font-size:8px;color:rgba(255,255,255,.4);margin-top:2px}
@media print{body{width:210mm}@page{size:A4;margin:0}.op-header,.op-problem,.op-pitch,.op-footer,.op-stat,.op-outcome.green,.op-outcome.orange,.op-outcome.dark,.op-plan.featured,.op-plan.dark{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="op-header">
  <div class="op-nav">
    <div class="op-logo" style="display:flex;align-items:center">
      <div class="logo-grid">
        <div class="ld" style="background:#FF5C3A"></div><div class="ld" style="background:#FF5C3A"></div><div class="ld" style="background:#FF5C3A"></div><div class="ld" style="background:#FF5C3A;opacity:.22"></div>
        <div class="ld" style="background:#FF5C3A"></div><div class="ld" style="background:#00C9A7"></div><div class="ld" style="background:#FF5C3A;opacity:.15"></div><div class="ld" style="background:#FF5C3A"></div>
        <div class="ld" style="background:#FF5C3A"></div><div class="ld" style="background:#FF5C3A"></div><div class="ld" style="background:#FF5C3A"></div><div class="ld" style="background:#00C9A7;opacity:.5"></div>
        <div class="ld" style="background:#FF5C3A;opacity:.1"></div><div class="ld" style="background:#FF5C3A;opacity:.4"></div><div class="ld" style="background:#00C9A7;opacity:.3"></div><div class="ld" style="background:#FF5C3A"></div>
      </div>
      <span class="op-logo-word">retelio</span>
    </div>
    <span class="op-tag">Customer Growth Engine</span>
  </div>
  <div class="op-h1">Cada cliente que sale es <span class="c">revenue</span><br>o una <span class="t">segunda oportunidad.</span></div>
  <div class="op-sub">Un QR. Retelio decide. La acción pasa sola — más reseñas Google o cliente recuperado en &lt;60 segundos.</div>
  <div class="op-pill">Sin hardware · Sin IT · Sin contrato · Operando en 10 minutos</div>
</div>
<div class="op-stats">
  <div class="op-stat"><div class="op-stat-num" style="color:#FF5C3A">3.2×</div><div class="op-stat-lbl">más reseñas Google vs. sin herramienta</div></div>
  <div class="op-stat"><div class="op-stat-num" style="color:#00C9A7">68%</div><div class="op-stat-lbl">de clientes insatisfechos recuperados</div></div>
  <div class="op-stat"><div class="op-stat-num" style="color:#0A0A0F">$12k</div><div class="op-stat-lbl">impacto mensual promedio por local</div></div>
  <div class="op-stat"><div class="op-stat-num" style="color:#6B6B7A">10 min</div><div class="op-stat-lbl">para la primera reseña Google</div></div>
</div>
<div class="op-problem">
  <span>👻 El 90% de clientes satisfechos nunca deja reseña</span>
  <span class="op-problem-sep">|</span>
  <span>📉 1 de cada 3 insatisfechos se va sin decir nada</span>
  <span class="op-problem-sep">|</span>
  <span>⏱️ Cuando te enteras del problema, ya perdiste la venta</span>
</div>
<div class="op-body">
  <div>
    <div class="op-sec-lbl">Cómo funciona</div>
    <div class="op-sec-title">Dos resultados.<br>Un escaneo.</div>
    <div class="op-flow">
      <div class="op-step"><div class="op-step-icon" style="background:rgba(255,92,58,.1)">📱</div><div><div class="op-step-title">Cliente escanea el QR</div><div class="op-step-desc">Mesa, mostrador, recibo o gafete. Sin app. 3 segundos.</div></div></div>
      <div class="op-step"><div class="op-step-icon" style="background:rgba(0,201,167,.1)">⚡</div><div><div class="op-step-title">Retelio lee el sentimiento</div><div class="op-step-desc">≥4★ = feliz · ≤2★ = alerta. El motor actúa al instante.</div></div></div>
      <div class="op-step"><div class="op-step-icon" style="background:rgba(0,201,167,.08)">⭐</div><div><div class="op-step-title" style="color:#00C9A7">Feliz → Reseña Google + incentivo</div><div class="op-step-desc">Botón directo a tu perfil. Tu calificación sube sola.</div></div></div>
      <div class="op-step"><div class="op-step-icon" style="background:rgba(255,92,58,.08)">🔔</div><div><div class="op-step-title" style="color:#FF5C3A">Insatisfecho → Alerta en &lt;60 seg</div><div class="op-step-desc">WhatsApp al manager + oferta de recovery. Antes de la 1★.</div></div></div>
    </div>
  </div>
  <div>
    <div class="op-sec-lbl">Impacto en revenue</div>
    <div class="op-sec-title">Cada visita<br>vale dinero.</div>
    <div class="op-outcomes">
      <div class="op-outcome green"><div class="op-outcome-num" style="color:#00C9A7">+$12,400</div><div class="op-outcome-lbl">Impacto mensual promedio por local</div><div class="op-outcome-desc">Reseñas → tráfico → ventas.</div></div>
      <div class="op-outcome orange"><div class="op-outcome-num" style="color:#FF5C3A">1 reseña = 10 clientes</div><div class="op-outcome-lbl">Tu calificación es tu tráfico</div><div class="op-outcome-desc">El 94% revisa Google antes de entrar.</div></div>
      <div class="op-outcome dark"><div class="op-outcome-num" style="color:#fff">ROI 15–40×</div><div class="op-outcome-lbl">por peso invertido en Retelio</div><div class="op-outcome-desc" style="color:rgba(255,255,255,.4)">El costo del plan es menos que recuperar 1 cliente al mes.</div></div>
    </div>
  </div>
</div>
<div class="op-pricing">
  <div class="op-sec-lbl">Planes</div>
  <div class="op-sec-title" style="margin-bottom:10px">Empieza gratis. Paga cuando veas resultados.</div>
  <div class="op-plans">
    <div class="op-plan" style="background:#F6FBF9;border-color:#C2EDE3"><div class="op-plan-name" style="color:#00C9A7">Prueba Gratis</div><div class="op-plan-price" style="color:#00C9A7">$0</div><div class="op-plan-per">14 días · sin tarjeta</div><div class="op-plan-feat">Dashboard tiempo real</div><div class="op-plan-feat">QR codes ilimitados</div><div class="op-plan-feat">20 alertas WhatsApp</div><div class="op-plan-roi">Ver si funciona no cuesta nada.</div></div>
    <div class="op-plan featured"><div class="op-plan-name" style="color:#FF5C3A">Starter · Popular</div><div class="op-plan-price" style="color:#FF5C3A">$499 MXN</div><div class="op-plan-per">por suc / mes · anual $399</div><div class="op-plan-feat">Dashboard + email campañas</div><div class="op-plan-feat">50 alertas WhatsApp/mes</div><div class="op-plan-feat">2 usuarios</div><div class="op-plan-roi">1 cliente recuperado = 3 meses pagados.</div></div>
    <div class="op-plan"><div class="op-plan-name">Growth · Cadenas</div><div class="op-plan-price">$899 MXN</div><div class="op-plan-per">por suc / mes · anual $699</div><div class="op-plan-feat">Todo Starter +</div><div class="op-plan-feat">200 alertas WhatsApp/mes</div><div class="op-plan-feat">Mapa · Leaderboard</div><div class="op-plan-roi">ROI promedio: 22× en 90 días.</div></div>
    <div class="op-plan dark"><div class="op-plan-name">Premium · Enterprise</div><div class="op-plan-price">A medida</div><div class="op-plan-per">Retail · Hoteles · Automotriz</div><div class="op-plan-feat" style="color:rgba(255,255,255,.5)">White label</div><div class="op-plan-feat" style="color:rgba(255,255,255,.5)">API + CRM / DMS</div><div class="op-plan-feat" style="color:rgba(255,255,255,.5)">Account manager</div><div class="op-plan-roi">1 reseña puede ser 1 venta cerrada.</div></div>
  </div>
</div>
<div class="op-pitch">
  <div class="op-pitch-title">Cómo venderlo en 30 segundos</div>
  <div class="op-pitches">
    <div><div class="op-pitch-num">01 — Abre con el dolor</div><div class="op-pitch-head">Haz la pregunta</div><div class="op-pitch-text">"¿Sabes cuántos clientes salen hoy sin que nadie sepa cómo les fue?"</div></div>
    <div><div class="op-pitch-num">02 — Muestra el valor</div><div class="op-pitch-head">Da la solución</div><div class="op-pitch-text">"Retelio convierte esa visita en reseña Google o en cliente recuperado — solo."</div></div>
    <div><div class="op-pitch-num">03 — Cierra con urgencia</div><div class="op-pitch-head">Activa hoy</div><div class="op-pitch-text">"Empieza gratis hoy, sin tarjeta. En 10 minutos ya está operando."</div></div>
  </div>
</div>
<div class="op-footer">
  <div class="op-footer-cta">Activa gratis hoy. Primera reseña en 10 minutos.</div>
  <div class="op-footer-sub">Sin hardware · Sin IT · Sin contrato · Cancela cuando quieras · retelio.com.mx</div>
  <div class="op-footer-sep"></div>
  <div class="op-dist-block">
    <div>
      <div class="op-dist-label">Tu contacto para más información</div>
      <div class="op-dist-name">${dist.name}</div>
      <div class="op-dist-company">${dist.company || 'Distribuidor Retelio'}</div>
      <div class="op-dist-contacts">
        ${dist.whatsapp ? `<div class="op-dist-contact">💬 ${dist.whatsapp}</div>` : ''}
        ${dist.email ? `<div class="op-dist-contact">✉️ ${dist.email}</div>` : ''}
      </div>
      <div class="op-dist-ref">Código: <span style="color:rgba(255,255,255,.7)">${dist.code}</span></div>
    </div>
    <div class="op-dist-qr-area">
      <div class="op-dist-qr-box" id="qr"></div>
      <div class="op-dist-qr-lbl">Escanea para activar</div>
      <div class="op-dist-ref">${refUrl}</div>
    </div>
  </div>
</div>
<script>
new QRCode(document.getElementById('qr'),{text:'${refUrl}',width:60,height:60,colorDark:'#0A0A0F',colorLight:'#FFFFFF',correctLevel:QRCode.CorrectLevel.M});
setTimeout(()=>window.print(),600);
</script>
</body></html>`);
  win.document.close();
}

// ── Main portal ───────────────────────────────────────────────────────────────
export default function DistributorPortal({ userEmail }) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dist,  setDist]  = useState(null);
  const [clicks, setClicks] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const period = `${year}-${String(month).padStart(2, '0')}`;
  const refUrl = dist ? `${REFERRAL_BASE}?ref=${dist.code}` : '';

  const load = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true); setErr(null);
    try {
      // Distribuidor
      const { data: d, error: de } = await supabase
        .from('distributors').select('*').eq('email', userEmail).eq('portal_enabled', true).maybeSingle();
      if (de || !d) { setErr('No tienes acceso al portal de distribuidores.'); setLoading(false); return; }
      setDist(d);

      // Clics del período
      const clicksFrom = `${year}-${String(month).padStart(2, '0')}-01`;
      const clicksTo   = new Date(year, month, 1).toISOString().slice(0, 10);
      const { data: cl } = await supabase.from('distributor_ref_clicks')
        .select('id').eq('distributor_id', d.id).gte('clicked_at', clicksFrom).lt('clicked_at', clicksTo);
      setClicks(cl || []);

      // Todos los referidos
      const { data: ref } = await supabase.from('distributor_referrals')
        .select('*').eq('distributor_id', d.id).order('registered_at', { ascending: false });
      setReferrals(ref || []);

      // Comisiones (últimos 6 meses)
      const { data: com } = await supabase.from('commission_events')
        .select('*').eq('distributor_id', d.id).order('period', { ascending: false }).limit(12);
      setCommissions(com || []);

      // Meta del período
      const { data: g } = await supabase.from('distributor_goals')
        .select('*').eq('distributor_id', d.id).eq('period', period).maybeSingle();
      setGoal(g || null);

    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [userEmail, year, month, period]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    if (isCurrentMonth) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
  };

  // Métricas derivadas
  const activeClients  = referrals.filter(r => r.status === 'active').length;
  const trialClients   = referrals.filter(r => r.status === 'trial').length;
  const churnedClients = referrals.filter(r => r.status === 'churned').length;
  const totalMRR       = referrals.filter(r => r.status === 'active').reduce((s, r) => s + (r.mrr || 0), 0);
  const commPaid       = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const commPending    = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
  const periodSignups  = referrals.filter(r => r.registered_at?.startsWith(period)).length;

  // Chart data (últimos 6 meses)
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const c = commissions.find(c => c.period === p);
      months.push({ mes: d.toLocaleDateString('es-MX', { month: 'short' }), monto: c?.amount || 0, status: c?.status });
    }
    return months;
  }, [commissions, year, month]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
      <Loader size={24} style={{ animation: 'spin 1s linear infinite', color: T.teal }} />
    </div>
  );

  if (err) return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '16px 20px', color: '#DC2626', fontSize: 14, fontFamily: font }}>
      <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />{err}
    </div>
  );

  if (!dist) return null;

  const tier = TIERS[dist.tier] || TIERS.bronze;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div style={{ fontFamily: font, maxWidth: 960, margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: T.ink, borderRadius: 16, padding: '20px 24px', marginBottom: 20, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 4 }}>Portal de Distribuidor</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>
              👋 Hola, {dist.name.split(' ')[0]}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <TierBadge tier={dist.tier} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Comisión: <strong style={{ color: T.teal }}>{dist.commission_pct}% MRR</strong></span>
            </div>
          </div>

          {/* Period nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 10px' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: '2px 4px', display: 'flex' }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', minWidth: 120, textAlign: 'center', textTransform: 'capitalize' }}>
              {periodLabel(year, month)}
            </span>
            <button onClick={nextMonth} disabled={isCurrentMonth} style={{ background: 'none', border: 'none', cursor: isCurrentMonth ? 'default' : 'pointer', color: isCurrentMonth ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', padding: '2px 4px', display: 'flex' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Ref link */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{refUrl}</span>
          <CopyBtn text={refUrl} label="Copiar link" />
          <button onClick={() => generatePDF(dist)} style={{ background: T.coral, color: '#fff', border: 'none', borderRadius: 7, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: font }}>
            <FileText size={12} /> Generar kit PDF
          </button>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KPI icon={<MousePointerClick size={18} />} label={`Clics este mes`} value={clicks.length} color={T.purple} />
        <KPI icon={<Users size={18} />} label="Nuevos registros" value={periodSignups} color={T.blue} />
        <KPI icon={<CheckCircle2 size={18} />} label="Clientes activos" value={activeClients} sub={trialClients > 0 ? `+ ${trialClients} en trial` : undefined} color={T.teal} />
        <KPI icon={<TrendingUp size={18} />} label="MRR generado" value={fmtMXN(totalMRR)} color={T.coral} />
        <KPI icon={<DollarSign size={18} />} label="Comisión ganada" value={fmtMXN(commPaid)} sub={commPending > 0 ? `+ ${fmtMXN(commPending)} pendiente` : undefined} color={T.green} />
      </div>

      {/* ── Funnel + Tier ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 14 }}>Funnel de conversión</div>
          <Funnel
            clicks={clicks.length}
            signups={referrals.length}
            active={activeClients}
            mrr={totalMRR}
          />
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 14 }}>Tu nivel</div>
            <TierProgress tier={dist.tier} activeClients={activeClients} />
          </div>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
            <GoalTracker
              goal={goal?.goal_clients}
              actual={activeClients}
              distributorId={dist.id}
              period={period}
              onUpdated={load}
            />
          </div>
        </div>
      </div>

      {/* ── Comisiones (chart) ─────────────────────────────────────────────── */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>Historial de comisiones</div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: T.muted }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: T.teal, display: 'inline-block' }} />Pagada</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: T.amber, display: 'inline-block' }} />Pendiente</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} barSize={28}>
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={36} />
            <Tooltip formatter={v => fmtMXN(v)} labelStyle={{ fontWeight: 700 }} contentStyle={{ borderRadius: 8, border: `1px solid ${T.border}`, fontFamily: font, fontSize: 12 }} />
            <Bar dataKey="monto" radius={[5, 5, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.status === 'paid' ? T.teal : d.monto > 0 ? T.amber : T.border} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Tabla de comisiones */}
        {commissions.length > 0 && (
          <div style={{ marginTop: 16, borderTop: `1px solid ${T.border}`, paddingTop: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Período', 'Clientes', 'MRR base', 'Comisión', 'Estado'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: 11, textTransform: 'uppercase', padding: '4px 8px', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissions.slice(0, 6).map((c, i) => (
                  <tr key={c.id} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : 'none' }}>
                    <td style={{ padding: '9px 8px', fontWeight: 700, color: T.ink, textTransform: 'capitalize' }}>{c.period}</td>
                    <td style={{ padding: '9px 8px', color: T.muted }}>{activeClients}</td>
                    <td style={{ padding: '9px 8px' }}>{fmtMXN(c.mrr)}</td>
                    <td style={{ padding: '9px 8px', fontWeight: 800, color: T.coral }}>{fmtMXN(c.amount)}</td>
                    <td style={{ padding: '9px 8px' }}>
                      {c.status === 'paid'
                        ? <span style={{ color: T.teal, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Pagada {c.paid_at ? new Date(c.paid_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : ''}</span>
                        : <span style={{ color: T.amber, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={13} /> Pendiente</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Clientes ──────────────────────────────────────────────────────── */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, fontWeight: 800, fontSize: 14, color: T.ink }}>
          Mis clientes ({referrals.length})
        </div>
        {referrals.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <Users size={32} color={T.border} style={{ marginBottom: 12 }} />
            <div style={{ color: T.muted, fontSize: 14, marginBottom: 8 }}>Aún no tienes clientes referidos</div>
            <div style={{ fontSize: 12, color: T.muted }}>Comparte tu link único y empieza a construir tu cartera</div>
            <div style={{ marginTop: 14 }}>
              <CopyBtn text={refUrl} label="Copiar mi link" />
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 400, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {['Negocio', 'Plan', 'MRR', 'Estado', 'Desde'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {referrals.map((r, i) => (
                <tr key={r.id} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : 'none' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 700, color: T.ink }}>{r.tenant_id?.slice(0, 8) || '—'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ background: T.purple + '12', color: T.purple, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{r.plan || 'trial'}</span>
                  </td>
                  <td style={{ padding: '11px 16px', fontWeight: 700 }}>{r.mrr ? fmtMXN(r.mrr) : '—'}</td>
                  <td style={{ padding: '11px 16px' }}><StatusBadge status={r.status} /></td>
                  <td style={{ padding: '11px 16px', color: T.muted }}>{r.registered_at ? new Date(r.registered_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* ── CTA materiales ────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(135deg, ${T.ink} 0%, #1C1C2E 100%)`, borderRadius: 16, padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 4 }}>Tu kit de ventas personalizado</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>One-pager A4 con tu QR único · listo para imprimir y repartir</div>
        </div>
        <button onClick={() => generatePDF(dist)} style={{ background: T.coral, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: font }}>
          <FileText size={16} /> Generar PDF
        </button>
      </div>
    </div>
  );
}
