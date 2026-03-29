import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { AffiliateService } from '../../services/affiliateService';
import {
  Share2, Plus, Edit2, Copy, Check, ChevronRight, ChevronDown,
  Users, DollarSign, TrendingUp, ToggleLeft, ToggleRight,
  X, Save, AlertCircle, Loader, ExternalLink, CheckSquare, Square,
} from 'lucide-react';

const T = {
  coral:  '#FF5C3A',
  teal:   '#00C9A7',
  purple: '#7C3AED',
  amber:  '#F59E0B',
  green:  '#16A34A',
  muted:  '#6B7280',
  border: '#E5E7EB',
  bg:     '#F7F8FC',
  card:   '#FFFFFF',
  ink:    '#0D0D12',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";
const s = (obj) => obj; // passthrough for inline style objects

const REFERRAL_BASE = import.meta.env.VITE_LANDING_URL || 'https://retelio.com.mx';

const EMPTY_FORM = {
  id: null, name: '', email: '', phone: '',
  ref_code: '', pct_l1: 20, pct_l2: 10,
  upline_id: null, active: true, notes: '',
};

function StatCard({ icon, label, value, sub, color = T.teal }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ background: color + '18', borderRadius: 10, padding: 10, color, display: 'flex' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.ink, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={handle} title="Copiar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? T.teal : T.muted, padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function Badge({ color = T.teal, children }) {
  return (
    <span style={{ background: color + '18', color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
      {children}
    </span>
  );
}

// ── Modal: crear / editar afiliado ──────────────────────────────────────────
function AffiliateForm({ affiliate, affiliates, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...affiliate });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErr('El nombre es requerido.');
    setSaving(true); setErr(null);
    try {
      await AffiliateService.save(form);
      onSave();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const uplineOptions = affiliates.filter(a => a.id !== form.id && a.active);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: T.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, fontFamily: font, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.ink }}>{form.id ? 'Editar distribuidor' : 'Nuevo distribuidor'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}><X size={18} /></button>
        </div>

        {err && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{err}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, display: 'block' }}>
              Nombre *
              <input value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} placeholder="Nombre del distribuidor" required />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, display: 'block' }}>
                Email
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle} placeholder="email@ejemplo.com" />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, display: 'block' }}>
                Teléfono
                <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inputStyle} placeholder="+52 55 …" />
              </label>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, display: 'block' }}>
              Código de referido
              <input value={form.ref_code} onChange={e => set('ref_code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} style={inputStyle} placeholder="AUTO si vacío" maxLength={12} />
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 400 }}>Se autogenera si se deja vacío · Solo letras y números</span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, display: 'block' }}>
                Comisión L1 (%)
                <input type="number" min={0} max={50} value={form.pct_l1} onChange={e => set('pct_l1', +e.target.value)} style={inputStyle} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, display: 'block' }}>
                Comisión L2 upline (%)
                <input type="number" min={0} max={50} value={form.pct_l2} onChange={e => set('pct_l2', +e.target.value)} style={inputStyle} />
              </label>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, display: 'block' }}>
              Upline (superior que recibe L2)
              <select value={form.upline_id || ''} onChange={e => set('upline_id', e.target.value || null)} style={inputStyle}>
                <option value="">— Sin upline —</option>
                {uplineOptions.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.ref_code})</option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, display: 'block' }}>
              Notas internas
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...inputStyle, height: 70, resize: 'vertical' }} placeholder="Notas para uso interno…" />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} style={btnGhost}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Panel de detalle de afiliado ─────────────────────────────────────────────
function AffiliateDetail({ affiliate, onBack }) {
  const [tenants, setTenants]   = useState([]);
  const [ledger,  setLedger]    = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [paying, setPaying]     = useState(false);
  const [msg, setMsg]           = useState(null);

  useEffect(() => {
    load();
  }, [affiliate.id]);

  const load = async () => {
    setLoading(true);
    try {
      const [t, l] = await Promise.all([
        AffiliateService.getReferredTenants(affiliate.id),
        AffiliateService.getLedger(affiliate.id),
      ]);
      setTenants(t);
      setLedger(l);
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  };

  const pendingLedger = ledger.filter(r => r.status === 'pending');
  const totalPending  = pendingLedger.reduce((s, r) => s + r.amount, 0);
  const totalPaid     = ledger.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
  const mrr           = tenants.reduce((s, t) => s + (t.mrr || 0), 0);

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleMarkPaid = async () => {
    if (!selected.size) return;
    setPaying(true);
    try {
      await AffiliateService.markPaid([...selected]);
      setMsg({ type: 'ok', text: `${selected.size} comisión(es) marcadas como pagadas.` });
      setSelected(new Set());
      await load();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setPaying(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader size={22} style={{ animation: 'spin 1s linear infinite', color: T.teal }} />
    </div>
  );

  return (
    <div style={{ fontFamily: font }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: 0 }}>
        ← Volver a distribuidores
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.purple + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Share2 size={20} color={T.purple} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.ink }}>{affiliate.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: '1px 8px', color: T.purple }}>{affiliate.ref_code}</span>
            <CopyButton text={`${REFERRAL_BASE}?ref=${affiliate.ref_code}`} />
            <span style={{ fontSize: 11, color: T.muted }}>Comisión: {affiliate.pct_l1}% L1 · {affiliate.pct_l2}% L2</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard icon={<Users size={18} />} label="Clientes activos" value={tenants.length} color={T.teal} />
        <StatCard icon={<TrendingUp size={18} />} label="MRR referido" value={`$${mrr.toLocaleString()}`} color={T.coral} />
        <StatCard icon={<DollarSign size={18} />} label="Comisión pendiente" value={`$${totalPending.toLocaleString()}`} sub={`Pagado total: $${totalPaid.toLocaleString()}`} color={T.amber} />
      </div>

      {msg && (
        <div style={{ background: msg.type === 'ok' ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msg.type === 'ok' ? '#86EFAC' : '#FCA5A5'}`, borderRadius: 8, padding: '10px 14px', color: msg.type === 'ok' ? '#15803D' : '#DC2626', fontSize: 13, marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {/* Clients table */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, fontWeight: 800, fontSize: 14, color: T.ink }}>
          Clientes referidos ({tenants.length})
        </div>
        {tenants.length === 0 ? (
          <div style={{ padding: '28px 18px', color: T.muted, fontSize: 13, textAlign: 'center' }}>Sin clientes referidos aún</div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {['Empresa', 'Plan', 'Estado', 'MRR', 'Desde'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, i) => (
                <tr key={t.id} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : 'none' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: T.ink }}>{t.name || t.id.slice(0, 8)}</td>
                  <td style={{ padding: '10px 16px' }}><Badge color={T.purple}>{t.plan || 'trial'}</Badge></td>
                  <td style={{ padding: '10px 16px' }}><Badge color={t.plan_status === 'active' ? T.teal : T.amber}>{t.plan_status || '—'}</Badge></td>
                  <td style={{ padding: '10px 16px', fontWeight: 700 }}>{t.mrr ? `$${t.mrr.toLocaleString()}` : '—'}</td>
                  <td style={{ padding: '10px 16px', color: T.muted }}>{t.created_at ? new Date(t.created_at).toLocaleDateString('es-MX') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Ledger */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: T.ink }}>Comisiones ({ledger.length})</span>
          {selected.size > 0 && (
            <button onClick={handleMarkPaid} disabled={paying} style={{ ...btnPrimary, fontSize: 12, padding: '6px 14px' }}>
              {paying ? <Loader size={12} /> : <Check size={12} />}
              Marcar {selected.size} como pagadas
            </button>
          )}
        </div>
        {ledger.length === 0 ? (
          <div style={{ padding: '28px 18px', color: T.muted, fontSize: 13, textAlign: 'center' }}>Sin registros de comisiones</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                <th style={thStyle}></th>
                {['Período', 'Cliente', 'MRR', 'Nivel', '%', 'Monto', 'Estado'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.map((row, i) => (
                <tr key={row.id} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : 'none', background: selected.has(row.id) ? T.teal + '08' : 'transparent' }}>
                  <td style={{ padding: '10px 8px 10px 16px' }}>
                    {row.status === 'pending' && (
                      <button onClick={() => toggleSelect(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: selected.has(row.id) ? T.teal : T.border, padding: 0, display: 'flex' }}>
                        {selected.has(row.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                      </button>
                    )}
                  </td>
                  <td style={tdStyle}>{row.period}</td>
                  <td style={tdStyle}>{row.tenant?.name || '—'}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>${(row.mrr || 0).toLocaleString()}</td>
                  <td style={tdStyle}><Badge color={row.level === 1 ? T.teal : T.purple}>L{row.level}</Badge></td>
                  <td style={tdStyle}>{row.pct}%</td>
                  <td style={{ ...tdStyle, fontWeight: 800, color: T.coral }}>${(row.amount || 0).toLocaleString()}</td>
                  <td style={tdStyle}><Badge color={row.status === 'paid' ? T.green : T.amber}>{row.status === 'paid' ? 'Pagada' : 'Pendiente'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AffiliatesManager() {
  const [affiliates, setAffiliates] = useState([]);
  const [stats,      setStats]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [msg,        setMsg]        = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aff, st] = await Promise.all([
        AffiliateService.list(),
        AffiliateService.getStats(),
      ]);
      setAffiliates(aff);
      setStats(st);
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = () => {
    setShowForm(false);
    setEditing(null);
    setMsg({ type: 'ok', text: 'Distribuidor guardado correctamente.' });
    load();
  };

  const handleToggle = async (aff) => {
    try {
      await AffiliateService.toggleActive(aff.id, !aff.active);
      load();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    }
  };

  // Per-affiliate stats
  const pendingByAffiliate = stats
    .filter(r => r.status === 'pending')
    .reduce((m, r) => { m[r.affiliate_id] = (m[r.affiliate_id] || 0) + r.amount; return m; }, {});

  const totalMRR = affiliates.reduce((s) => s, 0); // will be filled from ledger
  const totalPending = stats.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
  const activeCount = affiliates.filter(a => a.active).length;

  if (detail) {
    const aff = affiliates.find(a => a.id === detail);
    if (aff) return <AffiliateDetail affiliate={aff} onBack={() => setDetail(null)} />;
  }

  return (
    <div style={{ fontFamily: font }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.ink }}>Distribuidores</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>Gestiona tu red de distribuidores y comisiones</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={btnPrimary}>
          <Plus size={15} /> Nuevo distribuidor
        </button>
      </div>

      {msg && (
        <div style={{ background: msg.type === 'ok' ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msg.type === 'ok' ? '#86EFAC' : '#FCA5A5'}`, borderRadius: 8, padding: '10px 14px', color: msg.type === 'ok' ? '#15803D' : '#DC2626', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {msg.text}
          <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><X size={14} /></button>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard icon={<Share2 size={18} />} label="Distribuidores activos" value={activeCount} color={T.purple} />
        <StatCard icon={<Users size={18} />} label="Total distribuidores" value={affiliates.length} color={T.teal} />
        <StatCard icon={<DollarSign size={18} />} label="Comisiones pendientes" value={`$${totalPending.toLocaleString()}`} color={T.amber} />
      </div>

      {/* Table */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader size={22} style={{ animation: 'spin 1s linear infinite', color: T.teal }} />
          </div>
        ) : affiliates.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Share2 size={32} color={T.muted} style={{ marginBottom: 12 }} />
            <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>No hay distribuidores todavía.</p>
            <button onClick={() => setShowForm(true)} style={{ ...btnPrimary, marginTop: 14 }}>
              <Plus size={14} /> Agregar el primero
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {['Distribuidor', 'Código', 'Link de referido', 'L1 %', 'Upline', 'Pend. comisión', 'Estado', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {affiliates.map((aff, i) => {
                const refUrl = `${REFERRAL_BASE}?ref=${aff.ref_code}`;
                const pending = pendingByAffiliate[aff.id] || 0;
                return (
                  <tr key={aff.id} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : 'none', cursor: 'pointer' }}
                    onClick={() => setDetail(aff.id)}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: T.ink }}>
                      <div>{aff.name}</div>
                      {aff.email && <div style={{ fontSize: 11, color: T.muted, fontWeight: 400 }}>{aff.email}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, background: T.purple + '12', color: T.purple, borderRadius: 6, padding: '2px 8px' }}>{aff.ref_code}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 12, color: T.muted, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refUrl}</span>
                        <CopyButton text={refUrl} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{aff.pct_l1}%</td>
                    <td style={{ padding: '12px 16px', color: T.muted, fontSize: 12 }}>
                      {aff.upline ? aff.upline.name : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: pending > 0 ? T.amber : T.muted }}>
                      {pending > 0 ? `$${pending.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge color={aff.active ? T.teal : T.muted}>{aff.active ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                    <td style={{ padding: '12px 10px 12px 0', whiteSpace: 'nowrap' }}>
                      <button onClick={e => { e.stopPropagation(); setEditing(aff); setShowForm(true); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: '4px 6px' }} title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleToggle(aff); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: aff.active ? T.teal : T.muted, padding: '4px 6px' }} title={aff.active ? 'Desactivar' : 'Activar'}>
                        {aff.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      <ChevronRight size={14} color={T.muted} style={{ verticalAlign: 'middle' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* SQL hint card */}
      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginTop: 20, fontSize: 12, color: '#92400E' }}>
        <strong>Configuración requerida:</strong> Asegúrate de haber ejecutado la migración SQL para las tablas{' '}
        <code style={{ background: '#FEF3C7', padding: '1px 5px', borderRadius: 4 }}>affiliates</code> y{' '}
        <code style={{ background: '#FEF3C7', padding: '1px 5px', borderRadius: 4 }}>commission_ledger</code>.
        El archivo está en <code style={{ background: '#FEF3C7', padding: '1px 5px', borderRadius: 4 }}>supabase/migrations/affiliates.sql</code>.
      </div>

      {showForm && (
        <AffiliateForm
          affiliate={editing || EMPTY_FORM}
          affiliates={affiliates}
          onSave={handleSaved}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────────────────────
const inputStyle = {
  display: 'block', width: '100%', marginTop: 5,
  padding: '8px 11px', borderRadius: 8,
  border: '1px solid #E5E7EB', fontSize: 13,
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  outline: 'none', boxSizing: 'border-box', background: '#F9FAFB',
};
const btnPrimary = {
  background: '#FF5C3A', color: '#fff', border: 'none',
  borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
};
const btnGhost = {
  background: 'transparent', color: '#6B7280',
  border: '1px solid #E5E7EB', borderRadius: 9,
  padding: '9px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
};
const thStyle = {
  padding: '8px 16px', textAlign: 'left',
  fontWeight: 700, color: '#6B7280',
  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
};
const tdStyle = { padding: '10px 16px', color: '#0D0D12' };
