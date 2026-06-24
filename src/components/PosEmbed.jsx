import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Star, MessageSquare, Tag, TrendingUp, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const T = {
  coral: '#FF5C3A', teal: '#00C9A7', ink: '#0D0D12',
  muted: '#6B7280', border: '#E5E7EB', bg: '#F7F8FC', card: '#FFFFFF',
  green: '#16A34A', amber: '#F59E0B', red: '#DC2626',
};

// Embedded Customer Experience micro-site.
// Mounted at /embed?token=EMBED_TOKEN — lives inside an iframe in the POS.
// No sidebar, no header, no Supabase session required — auth via embed_token only.
export default function PosEmbed() {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [tab, setTab]         = useState('feed');   // 'feed' | 'coupon'
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [redeeming, setRedeeming] = useState(false);

  const token = new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
    if (!token) { setError('Token requerido'); return; }
    load();
  }, [token]);

  async function load() {
    // Resolve tenant by embed_token (no RLS bypass needed — embed_token is unique)
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('id, name, primary_color')
      .eq('embed_token', token)
      .single();

    if (tErr || !tenant) { setError('Token inválido'); return; }

    const tenantId = tenant.id;
    const color    = tenant.primary_color || T.coral;

    // Last 20 feedbacks
    const { data: feedbacks } = await supabase
      .from('Feedback')
      .select('id, score, comentario, created_at, coupon_code, coupon_redeemed')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Today's stats
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayFb = (feedbacks ?? []).filter(f => new Date(f.created_at) >= today);
    const avg = todayFb.length
      ? (todayFb.reduce((s, f) => s + (f.score || 0), 0) / todayFb.length).toFixed(1)
      : null;
    const activeCoupons = (feedbacks ?? []).filter(f => f.coupon_code && !f.coupon_redeemed).length;

    setData({ tenant, tenantId, color, feedbacks: feedbacks ?? [], todayCount: todayFb.length, avg, activeCoupons });
  }

  async function validateCoupon() {
    if (!couponCode.trim()) return;
    setCouponResult(null);
    const code = couponCode.trim().toUpperCase();

    const { data: fb } = await supabase
      .from('Feedback')
      .select('id, coupon_code, coupon_redeemed, coupon_redeemed_at, score, coupon_config_id')
      .eq('coupon_code', code)
      .eq('tenant_id', data.tenantId)
      .maybeSingle();

    if (!fb) { setCouponResult({ status: 'not_found' }); return; }
    if (fb.coupon_redeemed) { setCouponResult({ status: 'already', fb }); return; }

    let offer = null;
    if (fb.coupon_config_id) {
      const { data: cfg } = await supabase
        .from('coupon_configs')
        .select('offer_description, offer_value')
        .eq('id', fb.coupon_config_id)
        .maybeSingle();
      offer = cfg;
    }
    setCouponResult({ status: 'found', fb, offer });
  }

  async function redeemCoupon() {
    if (!couponResult?.fb) return;
    setRedeeming(true);
    await supabase
      .from('Feedback')
      .update({
        coupon_redeemed:    true,
        coupon_redeemed_at: new Date().toISOString(),
        coupon_redeemed_by: 'pos-embed',
        recovery_status:    'resolved',
      })
      .eq('id', couponResult.fb.id);
    setCouponResult(prev => ({ ...prev, status: 'redeemed' }));
    setRedeeming(false);
    load(); // refresh stats
  }

  if (error) return (
    <div style={{ padding: 24, color: T.red, fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
      {error}
    </div>
  );

  if (!data) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: T.bg }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${T.coral}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const { tenant, color, feedbacks, todayCount, avg, activeCoupons } = data;

  const scoreColor = (s) => s >= 4 ? T.green : s >= 3 ? T.amber : T.red;
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: T.bg, minHeight: '100vh', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ background: color, color: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '1rem' }}>Customer Experience</span>
        <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{tenant.name}</span>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: T.border }}>
        {[
          { label: 'Hoy', value: todayCount },
          { label: 'Promedio', value: avg ? `★${avg}` : '—' },
          { label: 'Cupones', value: activeCoupons },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: T.card, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink }}>{value}</div>
            <div style={{ fontSize: '0.68rem', color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: T.card, borderBottom: `1px solid ${T.border}` }}>
        {[
          { id: 'feed',   icon: <MessageSquare size={14} />, label: 'Reseñas' },
          { id: 'coupon', icon: <Tag size={14} />,           label: 'Cupones' },
        ].map(({ id, icon, label }) => (
          <button key={id} onClick={() => { setTab(id); setCouponResult(null); setCouponCode(''); }}
            style={{
              flex: 1, padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: '0.82rem', fontWeight: 600,
              color:       tab === id ? color : T.muted,
              borderBottom: tab === id ? `2px solid ${color}` : '2px solid transparent',
            }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Feed tab */}
      {tab === 'feed' && (
        <div style={{ padding: '12px 12px 80px' }}>
          {feedbacks.length === 0 && (
            <div style={{ textAlign: 'center', color: T.muted, padding: '40px 0', fontSize: '0.85rem' }}>
              Aún no hay reseñas. ¡Imprime tu QR y compártelo!
            </div>
          )}
          {feedbacks.map(fb => (
            <div key={fb.id} style={{ background: T.card, borderRadius: 10, padding: '10px 12px', marginBottom: 8, borderLeft: `3px solid ${scoreColor(fb.score)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.9rem', color: scoreColor(fb.score), letterSpacing: '0.05em' }}>{stars(fb.score)}</span>
                <span style={{ fontSize: '0.68rem', color: T.muted }}>
                  {formatDistanceToNow(new Date(fb.created_at), { locale: es, addSuffix: true })}
                </span>
              </div>
              {fb.comentario && (
                <div style={{ fontSize: '0.8rem', color: T.ink, lineHeight: 1.4 }}>{fb.comentario}</div>
              )}
              {fb.coupon_code && (
                <div style={{ marginTop: 6, fontSize: '0.7rem', color: fb.coupon_redeemed ? T.muted : T.teal, fontWeight: 600 }}>
                  {fb.coupon_redeemed ? '✓ Cupón canjeado' : `🎁 ${fb.coupon_code}`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Coupon tab */}
      {tab === 'coupon' && (
        <div style={{ padding: '16px 12px 80px' }}>
          <p style={{ fontSize: '0.82rem', color: T.muted, marginBottom: 12 }}>
            Escanea o escribe el código del cliente
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              value={couponCode}
              onChange={e => { setCouponCode(e.target.value); setCouponResult(null); }}
              onKeyDown={e => e.key === 'Enter' && validateCoupon()}
              placeholder="RECOV-X3K9A"
              autoCapitalize="characters"
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8,
                border: `1.5px solid ${T.border}`, fontSize: '1rem',
                fontWeight: 700, letterSpacing: '0.08em', outline: 'none',
              }}
            />
            <button onClick={validateCoupon}
              style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: color, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
              Validar
            </button>
          </div>

          {couponResult?.status === 'not_found' && (
            <div style={{ background: '#FEF2F2', border: `1px solid ${T.red}`, borderRadius: 10, padding: 14, color: T.red, fontWeight: 600, fontSize: '0.85rem' }}>
              Código no encontrado
            </div>
          )}

          {couponResult?.status === 'already' && (
            <div style={{ background: '#FFFBEB', border: `1px solid ${T.amber}`, borderRadius: 10, padding: 14, color: T.amber, fontWeight: 600, fontSize: '0.85rem' }}>
              Este cupón ya fue canjeado
              {couponResult.fb?.coupon_redeemed_at && (
                <div style={{ fontWeight: 400, fontSize: '0.75rem', marginTop: 4 }}>
                  {formatDistanceToNow(new Date(couponResult.fb.coupon_redeemed_at), { locale: es, addSuffix: true })}
                </div>
              )}
            </div>
          )}

          {(couponResult?.status === 'found' || couponResult?.status === 'redeemed') && (
            <div style={{ background: T.card, border: `2px solid ${couponResult.status === 'redeemed' ? T.green : T.teal}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ background: couponResult.status === 'redeemed' ? T.green : T.teal, padding: '10px 14px', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800 }}>{couponResult.fb.coupon_code}</span>
                {couponResult.status === 'redeemed' && <span style={{ fontSize: '0.78rem' }}>✓ Canjeado</span>}
              </div>
              <div style={{ padding: '12px 14px' }}>
                {couponResult.offer?.offer_description && (
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: T.ink, marginBottom: 8 }}>
                    {couponResult.offer.offer_description}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: T.muted, marginBottom: 12 }}>
                  Calificación original: {'★'.repeat(couponResult.fb.score)}
                </div>
                {couponResult.status === 'found' && (
                  <button onClick={redeemCoupon} disabled={redeeming}
                    style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', background: T.teal, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }}>
                    {redeeming ? 'Canjeando...' : 'Confirmar canje'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer link to full dashboard */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', background: T.card, borderTop: `1px solid ${T.border}`, padding: '10px 16px' }}>
        <a href={`/`} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.75rem', color: T.muted, textDecoration: 'none' }}>
          <ExternalLink size={12} /> Ver dashboard completo en Retelio
        </a>
      </div>
    </div>
  );
}
