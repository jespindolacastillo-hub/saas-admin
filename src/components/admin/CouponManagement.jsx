import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { CheckCircle2, Loader, Plus, Edit2, Trash2, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

const T = {
  coral:'#FF5C3A', teal:'#00C9A7', purple:'#7C3AED', ink:'#0D0D12',
  muted:'#6B7280', border:'#E5E7EB', bg:'#F7F8FC', card:'#FFFFFF',
  green:'#16A34A', amber:'#F59E0B', red:'#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const genPreview = (prefix) => `${prefix || 'CODE'}-X3K9A`;

const DEFAULT_AUTO = {
  enabled: true, trigger_score: 2,
  offer_description: '20% de descuento en tu próxima visita',
  coupon_prefix: 'RECOVERY', validity_days: 30,
  terms: '', message_template: 'Hola, lamentamos tu experiencia. Como muestra de aprecio: {{oferta}}. Código: {{codigo}} · válido {{dias}} días. — {{negocio}}',
  loyalty_enabled: false,
  loyalty_offer_description: '10% de descuento en tu próxima visita',
  loyalty_coupon_prefix: 'LOYAL', loyalty_validity_days: 30,
};

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
      background: on ? T.teal : T.border, position: 'relative', transition: 'background .2s', flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
    </button>
  );
}

const labelSt = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 };
const inputSt = { width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: '0.88rem', color: T.ink, outline: 'none', boxSizing: 'border-box' };

// ─── Auto card (recovery or loyalty) ─────────────────────────────────────────
function AutoCard({ title, emoji, subtitle, accentColor, fields, cfg, onChange }) {
  const [adv, setAdv] = useState(false);
  const enabled = cfg[fields.enabled];
  return (
    <div style={{ background: T.card, borderRadius: 20, border: `1.5px solid ${enabled ? accentColor + '40' : T.border}`, overflow: 'hidden', opacity: enabled ? 1 : 0.75 }}>
      <div style={{ padding: '16px 20px', background: enabled ? accentColor + '08' : T.bg, borderBottom: `1px solid ${enabled ? accentColor + '20' : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.4rem' }}>{emoji}</span>
          <div>
            <div style={{ fontWeight: 800, color: T.ink, fontSize: '0.9rem' }}>{title}</div>
            <div style={{ fontSize: '0.7rem', color: T.muted, marginTop: 1 }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: enabled ? accentColor : T.muted }}>{enabled ? 'Activo' : 'Inactivo'}</span>
          <Toggle on={enabled} onChange={v => onChange(fields.enabled, v)} />
        </div>
      </div>
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelSt}>Descripción de la oferta</label>
          <input type="text" value={cfg[fields.offer_description]} onChange={e => onChange(fields.offer_description, e.target.value)} placeholder="ej. 20% de descuento en tu próxima visita" style={inputSt} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12 }}>
          <div>
            <label style={labelSt}>Prefijo del código</label>
            <input type="text" value={cfg[fields.coupon_prefix]} onChange={e => onChange(fields.coupon_prefix, e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} style={{ ...inputSt, fontWeight: 700, letterSpacing: '0.05em' }} />
          </div>
          <div>
            <label style={labelSt}>Validez (días)</label>
            <input type="number" min={1} value={cfg[fields.validity_days]} onChange={e => onChange(fields.validity_days, parseInt(e.target.value) || 1)} style={inputSt} />
          </div>
        </div>
        <div style={{ background: '#0D0D12', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#fff', letterSpacing: '0.08em' }}>{genPreview(cfg[fields.coupon_prefix])}</span>
          <span style={{ fontSize: '0.72rem', color: accentColor, fontWeight: 700 }}>{cfg[fields.offer_description]?.slice(0, 24) || '—'}{cfg[fields.offer_description]?.length > 24 ? '…' : ''}</span>
        </div>
        {fields.trigger_score && (
          <div>
            <label style={labelSt}>Activar cuando calificación ≤</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1,2,3].map(s => (
                <button key={s} onClick={() => onChange(fields.trigger_score, s)} style={{ padding: '6px 16px', borderRadius: 10, fontFamily: font, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', border: `2px solid ${cfg[fields.trigger_score] === s ? accentColor : T.border}`, background: cfg[fields.trigger_score] === s ? accentColor + '10' : '#fff', color: cfg[fields.trigger_score] === s ? accentColor : T.muted }}>
                  {'★'.repeat(s)} {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => setAdv(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: font, fontSize: '0.72rem', color: T.muted, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
          {adv ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Configuración avanzada
        </button>
        {adv && fields.message_template && (
          <div>
            <label style={labelSt}>Plantilla WhatsApp</label>
            <div style={{ fontSize: '0.68rem', color: T.muted, marginBottom: 6 }}>
              {['{{oferta}}','{{codigo}}','{{dias}}','{{negocio}}'].map(v => (
                <code key={v} style={{ background: T.purple+'12', color: T.purple, borderRadius: 4, padding: '1px 5px', marginRight: 4, fontFamily: 'monospace', fontSize: '0.72rem' }}>{v}</code>
              ))}
            </div>
            <textarea value={cfg[fields.message_template]} onChange={e => onChange(fields.message_template, e.target.value)} rows={3} style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Catalog row ──────────────────────────────────────────────────────────────
function CatalogRow({ coupon, onEdit, onDelete, onToggle }) {
  const typeLabel = { recovery: '😔 Recovery', loyalty: '🌟 Lealtad', manual: '🎟 Manual' };
  const typeColor = { recovery: T.coral, loyalty: T.teal, manual: T.purple };
  const tc = typeColor[coupon.trigger_type] || T.muted;
  return (
    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
      <td style={tdSt}>
        <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.88rem' }}>{coupon.name}</div>
        <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 2 }}>{coupon.offer_description}</div>
      </td>
      <td style={tdSt}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: tc, background: tc+'15', borderRadius: 999, padding: '3px 10px' }}>
          {typeLabel[coupon.trigger_type] || coupon.trigger_type}
        </span>
      </td>
      <td style={tdSt}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: T.ink }}>{genPreview(coupon.coupon_prefix)}</span>
        <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 1 }}>válido {coupon.validity_days}d</div>
      </td>
      <td style={tdSt}><Toggle on={coupon.enabled} onChange={() => onToggle(coupon)} /></td>
      <td style={{ ...tdSt, textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button onClick={() => onEdit(coupon)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'none', cursor: 'pointer', color: T.muted }}><Edit2 size={13} /></button>
          <button onClick={() => onDelete(coupon)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'none', cursor: 'pointer', color: T.red }}><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  );
}
const tdSt = { padding: '12px 14px', verticalAlign: 'middle' };

// ─── Coupon form modal ────────────────────────────────────────────────────────
function CouponFormModal({ initial, onSave, onClose }) {
  const EMPTY = { name: '', offer_description: '', coupon_prefix: '', validity_days: 30, trigger_type: 'manual', enabled: true };
  const [form, setForm] = useState(initial || EMPTY);
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.name.trim() && form.offer_description.trim() && form.coupon_prefix.trim();

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const TYPES = [
    { value: 'recovery', label: '😔 Recovery', desc: 'Para clientes insatisfechos' },
    { value: 'loyalty',  label: '🌟 Lealtad',  desc: 'Para clientes felices' },
    { value: 'manual',   label: '🎟 Manual',   desc: 'Asignación manual desde Recuperación' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ background: T.card, borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontWeight: 800, color: T.ink, fontSize: '1.05rem', margin: 0 }}>{initial ? 'Editar cupón' : 'Nuevo cupón'}</h3>

        <div>
          <label style={labelSt}>Nombre interno</label>
          <input type="text" value={form.name} onChange={e => upd('name', e.target.value)} placeholder="ej. Recovery Cocina" style={inputSt} autoFocus />
        </div>

        <div>
          <label style={labelSt}>Tipo</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TYPES.map(t => (
              <button key={t.value} onClick={() => upd('trigger_type', t.value)} style={{ padding: '10px 14px', borderRadius: 12, border: `2px solid ${form.trigger_type === t.value ? T.coral : T.border}`, background: form.trigger_type === t.value ? T.coral+'08' : '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: font, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: form.trigger_type === t.value ? T.coral : T.ink }}>{t.label}</div>
                  <div style={{ fontSize: '0.7rem', color: T.muted }}>{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelSt}>Descripción de la oferta</label>
          <input type="text" value={form.offer_description} onChange={e => upd('offer_description', e.target.value)} placeholder="ej. 20% de descuento en tu próxima visita" style={inputSt} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 12 }}>
          <div>
            <label style={labelSt}>Prefijo</label>
            <input type="text" value={form.coupon_prefix} onChange={e => upd('coupon_prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="CUPON" style={{ ...inputSt, fontWeight: 700, letterSpacing: '0.05em' }} />
            <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 4 }}>{genPreview(form.coupon_prefix)}</div>
          </div>
          <div>
            <label style={labelSt}>Validez (días)</label>
            <input type="number" min={1} value={form.validity_days} onChange={e => upd('validity_days', parseInt(e.target.value)||1)} style={inputSt} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1.5px solid ${T.border}`, background: 'none', fontFamily: font, fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', color: T.muted }}>Cancelar</button>
          <button onClick={handleSave} disabled={!valid || saving} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: T.coral, color: '#fff', fontFamily: font, fontWeight: 700, fontSize: '0.88rem', cursor: valid ? 'pointer' : 'not-allowed', opacity: valid ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stats strip ──────────────────────────────────────────────────────────────
function Stats({ tenantId }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    if (!tenantId) return;
    const since = new Date(); since.setDate(since.getDate()-30);
    supabase.from('feedbacks').select('recovery_sent,coupon_redeemed,score,google_click_at')
      .eq('tenant_id', tenantId).gte('created_at', since.toISOString())
      .then(({ data }) => {
        if (!data) return;
        const sent     = data.filter(f => f.recovery_sent).length;
        const redeemed = data.filter(f => f.coupon_redeemed).length;
        const happy    = data.filter(f => f.score >= 4).length;
        const gClicks  = data.filter(f => f.google_click_at).length;
        const ampRate  = happy > 0 ? Math.round(gClicks/happy*100) : 0;
        setS({ sent, redeemed, happy, gClicks, ampRate });
      });
  }, [tenantId]);
  if (!s) return null;
  const items = [
    { label: 'Cupones enviados (30d)', value: s.sent,     color: T.coral },
    { label: 'Cupones canjeados',      value: s.redeemed, color: T.green },
    { label: 'Clientes felices',       value: s.happy,    color: T.teal  },
    { label: 'Amplification rate',     value: `${s.ampRate}%`, color: s.ampRate >= 30 ? T.teal : T.amber },
  ];
  return (
    <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, padding: '18px 22px', marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <TrendingUp size={14} color={T.coral} />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: T.ink }}>Estadísticas (últimos 30 días)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: 10 }}>
        {items.map(({ label, value, color }) => (
          <div key={label} style={{ background: color+'08', borderRadius: 12, padding: '12px 14px', border: `1px solid ${color}20` }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color, marginBottom: 3 }}>{value}</div>
            <div style={{ fontSize: '0.68rem', color: T.muted, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CouponManagement() {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [tab, setTab]         = useState('auto');
  const [autoCfg, setAutoCfg] = useState(DEFAULT_AUTO);
  const [coupons, setCoupons] = useState([]);
  const [areas,   setAreas]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [savedArea, setSavedArea] = useState(null); // areaId that just saved
  const [modal, setModal]     = useState(null); // null | 'new' | coupon object

  useEffect(() => { if (tenant?.id) loadAll(); }, [tenant?.id]);

  const loadAll = async () => {
    setLoading(true);
    const [autoRes, catRes, areaRes] = await Promise.all([
      supabase.from('recovery_config').select('*').eq('tenant_id', tenant.id).maybeSingle(),
      supabase.from('coupon_configs').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('Areas_Catalogo').select('id,nombre,coupon_config_id').eq('tenant_id', tenant.id).order('orden'),
    ]);
    if (autoRes.data) setAutoCfg({ ...DEFAULT_AUTO, ...autoRes.data });
    setCoupons(catRes.data || []);
    setAreas(areaRes.data || []);
    setLoading(false);
  };

  const saveAreaCoupon = async (areaId, couponConfigId) => {
    await supabase.from('Areas_Catalogo')
      .update({ coupon_config_id: couponConfigId || null })
      .eq('id', areaId);
    setAreas(prev => prev.map(a => a.id === areaId ? { ...a, coupon_config_id: couponConfigId || null } : a));
    setSavedArea(areaId);
    setTimeout(() => setSavedArea(null), 2000);
  };

  const updAuto = (k, v) => setAutoCfg(p => ({ ...p, [k]: v }));

  const saveAuto = async () => {
    setSaving(true);
    await supabase.from('recovery_config').upsert({ ...autoCfg, tenant_id: tenant.id, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    setSaving(false);
  };

  const saveCoupon = async (form) => {
    let error;
    if (form.id) {
      ({ error } = await supabase.from('coupon_configs').update({ ...form, updated_at: new Date().toISOString() }).eq('id', form.id));
    } else {
      const { name, offer_description, coupon_prefix, validity_days, trigger_type, enabled } = form;
      ({ error } = await supabase.from('coupon_configs').insert({ name, offer_description, coupon_prefix, validity_days, trigger_type, enabled, tenant_id: tenant.id }));
    }
    if (error) { alert('Error al guardar: ' + error.message); return; }
    setModal(null);
    loadAll();
  };

  const deleteCoupon = async (c) => {
    if (!window.confirm(`¿Eliminar "${c.name}"?`)) return;
    await supabase.from('coupon_configs').delete().eq('id', c.id);
    setCoupons(p => p.filter(x => x.id !== c.id));
  };

  const toggleCoupon = async (c) => {
    const upd = { enabled: !c.enabled };
    await supabase.from('coupon_configs').update(upd).eq('id', c.id);
    setCoupons(p => p.map(x => x.id === c.id ? { ...x, ...upd } : x));
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 10, color: T.muted, fontFamily: font }}><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

  const recoveryFields = { enabled:'enabled', trigger_score:'trigger_score', offer_description:'offer_description', coupon_prefix:'coupon_prefix', validity_days:'validity_days', message_template:'message_template' };
  const loyaltyFields  = { enabled:'loyalty_enabled', trigger_score:null, offer_description:'loyalty_offer_description', coupon_prefix:'loyalty_coupon_prefix', validity_days:'loyalty_validity_days', message_template:null };

  return (
    <div style={{ fontFamily: font, padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink, marginBottom: 4 }}>Cupones</h2>
          <p style={{ fontSize: '0.82rem', color: T.muted }}>Automáticos por calificación y catálogo de cupones manuales</p>
        </div>
        {tab === 'auto' && (
          <button onClick={saveAuto} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: saved ? T.green : T.coral, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontFamily: font, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', transition: 'background .2s' }}>
            {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <CheckCircle2 size={14} /> : null}
            {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar cambios'}
          </button>
        )}
        {tab === 'catalog' && (
          <button onClick={() => setModal('new')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.coral, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontFamily: font, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
            <Plus size={14} /> Nuevo cupón
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: T.bg, borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[{ key:'auto', label:'⚡ Automáticos' }, { key:'catalog', label:`🗂 Catálogo (${coupons.length})` }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', background: tab === t.key ? T.card : 'transparent', color: tab === t.key ? T.ink : T.muted, fontFamily: font, fontSize: '0.82rem', fontWeight: tab === t.key ? 700 : 500, boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Auto tab */}
      {tab === 'auto' && (
        <>
          {/* Flow explainer */}
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>💡</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: T.ink, marginBottom: 6 }}>¿Cómo funcionan los cupones?</div>
              <div style={{ fontSize: '0.8rem', color: T.muted, lineHeight: 1.6 }}>
                <span style={{ fontWeight: 700, color: T.ink }}>Automáticos</span> — se generan solos al recibir feedback.{' '}
                <span style={{ fontWeight: 700, color: T.ink }}>Recovery</span> para clientes insatisfechos,{' '}
                <span style={{ fontWeight: 700, color: T.ink }}>Lealtad</span> para clientes felices. Aplican a toda la cuenta.<br />
                Para asignar cupones distintos por área o por QR específico, crea cupones en{' '}
                <button onClick={() => setTab('catalog')} style={{ background: 'none', border: 'none', color: T.coral, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: font, fontSize: '0.8rem', textDecoration: 'underline' }}>el Catálogo</button>{' '}
                y luego asígnalos desde{' '}
                <button onClick={() => navigate('/qr')} style={{ background: 'none', border: 'none', color: T.coral, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: font, fontSize: '0.8rem', textDecoration: 'underline' }}>QR Studio → Áreas</button>.
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 18 }}>
            <AutoCard title="Recovery" emoji="😔" subtitle="Se activa con mala calificación" accentColor={T.coral} fields={recoveryFields} cfg={autoCfg} onChange={updAuto} />
            <AutoCard title="Lealtad"  emoji="🌟" subtitle="Se activa con buena calificación" accentColor={T.teal}  fields={loyaltyFields}  cfg={autoCfg} onChange={updAuto} />
          </div>
          <Stats tenantId={tenant?.id} />
        </>
      )}

      {/* Areas tab */}
      {tab === 'areas' && (
        areas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', background: T.card, borderRadius: 16, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📍</div>
            <div style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>Sin áreas configuradas</div>
            <div style={{ fontSize: '0.82rem', color: T.muted }}>Crea áreas en Configuración → Estructura para asignar cupones por área</div>
          </div>
        ) : (
          <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: T.purple+'06', borderBottom: `1px solid ${T.border}`, fontSize: '0.78rem', color: T.purple, fontWeight: 600 }}>
              💡 El cupón del área aplica a todos sus QRs automáticamente. Un QR puede sobreescribirlo desde QR Studio.
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.bg }}>
                  {['Área', 'Cupón predeterminado', 'Herencia'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {areas.map(area => {
                  const assigned = coupons.find(c => c.id === area.coupon_config_id);
                  return (
                    <tr key={area.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={tdSt}>
                        <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.88rem' }}>📍 {area.nombre}</div>
                      </td>
                      <td style={tdSt}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <select
                            value={area.coupon_config_id || ''}
                            onChange={e => saveAreaCoupon(area.id, e.target.value)}
                            style={{ ...inputSt, maxWidth: 300, padding: '7px 10px' }}
                          >
                            <option value="">Sin cupón (usa global)</option>
                            {coupons.map(c => (
                              <option key={c.id} value={c.id}>{c.name} — {c.offer_description}</option>
                            ))}
                          </select>
                          {savedArea === area.id && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: T.green, whiteSpace: 'nowrap' }}>✓ Guardado</span>
                          )}
                        </div>
                      </td>
                      <td style={tdSt}>
                        {assigned
                          ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.purple, background: T.purple+'15', borderRadius: 999, padding: '3px 10px' }}>
                              🎟 {assigned.name}
                            </span>
                          : <span style={{ fontSize: '0.72rem', color: T.muted }}>↑ Global</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Catalog tab */}
      {tab === 'catalog' && (
        coupons.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', background: T.card, borderRadius: 16, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎟</div>
            <div style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>Sin cupones en el catálogo</div>
            <div style={{ fontSize: '0.82rem', color: T.muted, marginBottom: 20 }}>Crea cupones manuales que el equipo puede asignar desde Recuperación</div>
            <button onClick={() => setModal('new')} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: T.coral, color: '#fff', fontFamily: font, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Crear primer cupón
            </button>
          </div>
        ) : (
          <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.bg }}>
                  {['Cupón', 'Tipo', 'Código', 'Estado', ''].map((h,i) => (
                    <th key={i} style={{ padding: '9px 14px', textAlign: i===4?'right':'left', fontSize: '0.65rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => <CatalogRow key={c.id} coupon={c} onEdit={setModal} onDelete={deleteCoupon} onToggle={toggleCoupon} />)}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal */}
      {modal && <CouponFormModal initial={modal === 'new' ? null : modal} onSave={saveCoupon} onClose={() => setModal(null)} />}
    </div>
  );
}
