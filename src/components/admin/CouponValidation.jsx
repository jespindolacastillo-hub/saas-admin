import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { Search, CheckCircle2, XCircle, Loader, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const T = {
  coral:'#FF5C3A', teal:'#00C9A7', ink:'#0D0D12',
  muted:'#6B7280', border:'#E5E7EB', bg:'#F7F8FC', card:'#FFFFFF',
  green:'#16A34A', amber:'#F59E0B', red:'#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

export default function CouponValidation({ userEmail }) {
  const { tenant } = useTenant();
  const [code, setCode]         = useState('');
  const [result, setResult]     = useState(null); // feedback row
  const [status, setStatus]     = useState(null); // 'found'|'not_found'|'already'|'redeemed'
  const [searching, setSearching] = useState(false);
  const [saving, setSaving]     = useState(false);

  const search = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || !tenant?.id) return;
    setSearching(true);
    setResult(null);
    setStatus(null);

    const { data: fb, error: fbError } = await supabase
      .from('feedbacks')
      .select('id, score, comment, followup_answer, contact_phone, created_at, coupon_code, coupon_redeemed, coupon_redeemed_at, coupon_redeemed_by, coupon_not_returned, location_id, recovery_status, coupon_config_id')
      .eq('tenant_id', tenant.id)
      .eq('coupon_code', trimmed)
      .maybeSingle();

    if (fbError || !fb) { 
      setSearching(false);
      setStatus('not_found'); 
      return; 
    }

    // Attempt to fetch specific config if exists
    let cfg = null;
    if (fb.coupon_config_id) {
      const { data: c } = await supabase.from('coupon_configs').select('name, offer_description, validity_days').eq('id', fb.coupon_config_id).maybeSingle();
      cfg = c;
    } else if (fb.recovery_sent) {
      // Fallback: fetch global recovery config
      const { data: r } = await supabase.from('recovery_config').select('offer_description, validity_days').eq('tenant_id', tenant.id).maybeSingle();
      if (r) cfg = { name: 'Recuperación', ...r };
    } else if (fb.coupon_code && fb.coupon_code.startsWith('LOYAL')) {
      // Fallback: fetch global loyalty config from recovery_config table (which holds both)
      const { data: r } = await supabase.from('recovery_config').select('loyalty_offer_description, loyalty_validity_days').eq('tenant_id', tenant.id).maybeSingle();
      if (r) cfg = { name: 'Lealtad', offer_description: r.loyalty_offer_description, validity_days: r.loyalty_validity_days };
    }

    setSearching(false);
    setResult({ ...fb, coupon_configs: cfg });
    if (fb.coupon_redeemed) setStatus('already');
    else setStatus('found');
  };

  const redeem = async () => {
    if (!result || !tenant?.id) return;
    setSaving(true);
    const now = new Date().toISOString();
    const email = userEmail || (await supabase.auth.getUser()).data?.user?.email || '';
    const update = {
      coupon_redeemed: true,
      coupon_redeemed_at: now,
      coupon_redeemed_by: email,
      recovery_status: 'resolved',
      recovery_resolved_at: now,
    };
    await supabase.from('feedbacks').update(update).eq('id', result.id).eq('tenant_id', tenant.id);
    setResult(prev => ({ ...prev, ...update }));
    setStatus('redeemed');
    setSaving(false);
  };

  const markNotReturned = async () => {
    if (!result || !tenant?.id) return;
    setSaving(true);
    await supabase.from('feedbacks').update({ coupon_not_returned: true }).eq('id', result.id).eq('tenant_id', tenant.id);
    setResult(prev => ({ ...prev, coupon_not_returned: true }));
    setStatus('not_found');
    setResult(null);
    setCode('');
    setSaving(false);
  };

  const reset = () => { setCode(''); setResult(null); setStatus(null); };

  const scoreColor = result?.score <= 1 ? T.red : result?.score <= 2 ? T.coral : T.teal;

  return (
    <div style={{ fontFamily: font, padding: '28px 32px', maxWidth: 560, margin: '0 auto' }}>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink, marginBottom: 4 }}>Validar Cupón</h2>
        <p style={{ fontSize: '0.82rem', color: T.muted }}>Ingresa el código que presenta el cliente en caja</p>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          type="text"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setStatus(null); setResult(null); }}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="RECOVERY-X3K9A"
          autoFocus
          style={{
            flex: 1, padding: '14px 16px', borderRadius: 12,
            border: `2px solid ${status === 'not_found' ? T.red : status === 'found' ? T.teal : T.border}`,
            fontFamily: font, fontSize: '1.1rem', fontWeight: 700,
            letterSpacing: '0.06em', color: T.ink, outline: 'none',
            textTransform: 'uppercase', transition: 'border-color .15s',
          }}
        />
        <button
          onClick={search}
          disabled={!code.trim() || searching}
          style={{
            padding: '14px 20px', borderRadius: 12, border: 'none',
            background: T.coral, color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: font, fontWeight: 700, fontSize: '0.9rem',
          }}
        >
          {searching
            ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
            : <Search size={16} />}
          Buscar
        </button>
      </div>

      {/* Not found */}
      {status === 'not_found' && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 16, padding: '20px 24px', textAlign: 'center' }}>
          <XCircle size={32} color={T.red} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 800, color: T.red, marginBottom: 4 }}>Cupón no encontrado</div>
          <div style={{ fontSize: '0.82rem', color: '#B91C1C' }}>Verifica el código e intenta de nuevo.</div>
        </div>
      )}

      {/* Found or already redeemed */}
      {result && (status === 'found' || status === 'already' || status === 'redeemed') && (
        <div style={{ background: T.card, border: `2px solid ${status === 'found' ? T.teal : status === 'redeemed' ? T.green : T.amber}`, borderRadius: 16, overflow: 'hidden' }}>

          {/* Coupon header */}
          <div style={{
            background: '#0D0D12', padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tag size={16} color={T.teal} />
              <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.2rem', color: '#fff', letterSpacing: '0.08em' }}>
                {result.coupon_code}
              </span>
            </div>
            {status === 'already' && <span style={{ fontSize: '0.72rem', fontWeight: 800, color: T.amber, background: T.amber + '20', borderRadius: 999, padding: '3px 10px' }}>Ya canjeado</span>}
            {status === 'redeemed' && <span style={{ fontSize: '0.72rem', fontWeight: 800, color: T.green, background: T.green + '20', borderRadius: 999, padding: '3px 10px' }}>✓ Canjeado ahora</span>}
          </div>

          {/* Details */}
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: scoreColor + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: scoreColor, flexShrink: 0 }}>
                {result.score}★
              </div>
              <div style={{ flex: 1 }}>
                {result.followup_answer && (
                  <div style={{ fontWeight: 700, color: T.coral, fontSize: '0.88rem', marginBottom: 2 }}>{result.followup_answer}</div>
                )}
                {result.comment && (
                  <div style={{ fontSize: '0.82rem', color: T.ink, fontStyle: 'italic', lineHeight: 1.5 }}>"{result.comment}"</div>
                )}
                <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 4 }}>
                  {formatDistanceToNow(new Date(result.created_at), { locale: es, addSuffix: true })}
                  {result.contact_phone && <span> · 📱 {result.contact_phone}</span>}
                </div>
              </div>
            </div>

            {/* Offer description — what the customer gets */}
            {result.coupon_configs?.offer_description && (
              <div style={{ background: T.teal + '10', border: `1px solid ${T.teal}30`, borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: T.teal, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>🎁 Beneficio a aplicar</div>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: '1rem' }}>{result.coupon_configs.offer_description}</div>
                {result.coupon_configs.validity_days && (
                  <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 2 }}>Válido {result.coupon_configs.validity_days} días desde emisión</div>
                )}
              </div>
            )}

            {status === 'already' && result.coupon_redeemed_at && (
              <div style={{ background: T.amber + '10', border: `1px solid ${T.amber}30`, borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem', color: '#92400E' }}>
                Canjeado {formatDistanceToNow(new Date(result.coupon_redeemed_at), { locale: es, addSuffix: true })}
                {result.coupon_redeemed_by && ` por ${result.coupon_redeemed_by}`}
              </div>
            )}

            {/* Actions */}
            {status === 'found' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={redeem}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                    background: T.green, color: '#fff', fontFamily: font,
                    fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {saving
                    ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    : <CheckCircle2 size={18} />}
                  Canjear cupón ✓
                </button>
                <button
                  onClick={markNotReturned}
                  disabled={saving}
                  style={{
                    padding: '14px 16px', borderRadius: 12,
                    border: `1.5px solid ${T.border}`, background: 'none',
                    color: T.muted, fontFamily: font, fontWeight: 600,
                    fontSize: '0.82rem', cursor: 'pointer',
                  }}
                >
                  No regresó
                </button>
              </div>
            )}

            {status === 'redeemed' && (
              <button onClick={reset} style={{
                padding: '12px', borderRadius: 12, border: 'none',
                background: T.bg, color: T.muted, fontFamily: font,
                fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
              }}>
                Validar otro cupón
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
