import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import {
  Plus, Send, Users, MessageSquare, Mail, TrendingDown,
  TrendingUp, RotateCcw, ChevronRight, ChevronLeft, X,
  CheckCircle2, Loader, BarChart2, Clock, Zap, Eye,
  AlertCircle, MapPin,
} from 'lucide-react';
import { subDays, format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const T = {
  coral:'#FF5C3A', teal:'#00C9A7', purple:'#7C3AED', ink:'#0D0D12',
  muted:'#6B7280', border:'#E5E7EB', bg:'#F7F8FC', card:'#FFFFFF',
  green:'#16A34A', amber:'#F59E0B', red:'#DC2626', blue:'#3B82F6',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// ─── Campaign type presets ────────────────────────────────────────────────────
const CAMPAIGN_TYPES = [
  {
    value:           'recovery',
    label:           'Recuperar clientes',
    icon:            TrendingDown,
    color:           T.coral,
    desc:            'Contacta a clientes insatisfechos (1-2★) que aún no han sido recuperados.',
    segment:         { min_score: 1, max_score: 2, recovery_status: 'pending' },
    allowedChannels: ['whatsapp'],
    template: (loc) =>
      `Hola 👋 Lamentamos que tu experiencia reciente${loc ? ` en ${loc}` : ''} no haya sido la mejor. Queremos compensarte con un beneficio especial en tu próxima visita. ¿Podemos hacer algo por ti? Escríbenos aquí mismo 🙏`,
    note:            'Campaña de recuperación automática',
  },
  {
    value:           'amplify',
    label:           'Pedir reseña Google',
    icon:            TrendingUp,
    color:           T.teal,
    desc:            'Pide a tus clientes más satisfechos (5★) que compartan su experiencia en Google.',
    segment:         { min_score: 5, max_score: 5, routed_to_google: false },
    allowedChannels: ['whatsapp', 'email'],
    template: (loc) =>
      `Hola 🌟 Nos alegra saber que tuviste una gran experiencia${loc ? ` en ${loc}` : ''}. ¿Nos ayudarías dejando una reseña en Google? Solo toma un minuto y significa muchísimo para el equipo. ¡Gracias de corazón! 🙏`,
    note:            'Campaña de amplificación Google',
  },
  {
    value:           'reactivate',
    label:           'Reactivar clientes',
    icon:            RotateCcw,
    color:           T.purple,
    desc:            'Re-engancha a clientes con experiencia regular (3-4★) que no han regresado.',
    segment:         { min_score: 3, max_score: 4 },
    allowedChannels: ['whatsapp', 'email'],
    template: (loc) =>
      `Hola 😊 Ha pasado un tiempo desde tu última visita${loc ? ` a ${loc}` : ''} y nos gustaría verte pronto. Tenemos algo especial esperándote. ¿Te apuntas con un descuento exclusivo solo para ti?`,
    note:            'Campaña de reactivación',
  },
  {
    value:           'custom',
    label:           'Campaña personalizada',
    icon:            Zap,
    color:           T.amber,
    desc:            'Define tu propio segmento y mensaje para cualquier tipo de campaña.',
    segment:         { min_score: 1, max_score: 5 },
    allowedChannels: ['whatsapp', 'email'],
    template:        () => '',
    note:            '',
  },
];

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp', Icon: MessageSquare, color: '#25D366', desc: 'Requiere que el cliente haya dejado teléfono' },
  { value: 'email',    label: 'Email',    Icon: Mail,          color: T.blue,    desc: 'Requiere que el cliente haya dejado correo' },
];

const DATE_RANGES = [
  { value: 7,  label: 'Últimos 7 días' },
  { value: 14, label: 'Últimos 14 días' },
  { value: 30, label: 'Últimos 30 días' },
  { value: 60, label: 'Últimos 60 días' },
  { value: 90, label: 'Últimos 90 días' },
];

// ─── Audience counter ─────────────────────────────────────────────────────────
function countAudience(feedbacks, config) {
  const { min_score, max_score, location_ids, date_range_days, channel, recovery_status, routed_to_google, only_unredeemed } = config;
  const since = subDays(new Date(), date_range_days || 30);
  return feedbacks.filter(f => {
    if (f.score < min_score || f.score > max_score) return false;
    if (new Date(f.created_at) < since) return false;
    if (location_ids?.length && !location_ids.includes(f.location_id)) return false;
    if (channel === 'whatsapp' && !f.contact_phone) return false;
    if (channel === 'email'    && !f.contact_email) return false;
    if (recovery_status === 'pending' && f.recovery_status && f.recovery_status !== 'pending') return false;
    if (routed_to_google === false && f.routed_to_google) return false;
    if (only_unredeemed && !f.recovery_sent) return false;
    if (only_unredeemed && f.coupon_redeemed === true) return false;
    return true;
  });
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ step }) {
  const steps = ['Audiencia', 'Mensaje', 'Confirmar'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const done    = i < step;
        const active  = i === step;
        return (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: done ? T.teal : active ? T.coral : T.bg,
                border: `2px solid ${done ? T.teal : active ? T.coral : T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 800,
                color: done || active ? '#fff' : T.muted,
              }}>
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: active ? 700 : 500, color: active ? T.ink : T.muted }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? T.teal + '40' : T.border, margin: '0 10px' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Campaign row in list ─────────────────────────────────────────────────────
function CampaignRow({ campaign, onView }) {
  const type = CAMPAIGN_TYPES.find(t => t.value === campaign.type) || CAMPAIGN_TYPES[3];
  const Icon = type.icon;
  const convRate = campaign.sent_count
    ? Math.round(campaign.converted_count / campaign.sent_count * 100)
    : 0;
  const statusCfg = {
    draft:   { label: 'Borrador',  color: T.muted  },
    sending: { label: 'Enviando',  color: T.amber  },
    sent:    { label: 'Enviada',   color: T.green  },
    failed:  { label: 'Con errores', color: T.red  },
  }[campaign.status] || { label: campaign.status, color: T.muted };

  return (
    <div onClick={() => onView(campaign)} style={{
      background: T.card, borderRadius: 14, padding: '14px 18px',
      border: `1.5px solid ${T.border}`, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = type.color + '60'}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: type.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={type.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.9rem', marginBottom: 2 }}>{campaign.name}</div>
        <div style={{ fontSize: '0.72rem', color: T.muted }}>
          {campaign.sent_at ? format(new Date(campaign.sent_at), "d MMM yyyy · HH:mm", { locale: es }) : 'No enviada aún'}
          {campaign.audience?.location_ids?.length ? ` · ${campaign.audience.location_ids.length} sucursal(es)` : ' · Todas las sucursales'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, flexShrink: 0, alignItems: 'center' }}>
        {campaign.status === 'sent' && (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: T.ink }}>{campaign.sent_count}</div>
              <div style={{ fontSize: '0.62rem', color: T.muted, fontWeight: 600 }}>Enviados</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: T.green }}>{convRate}%</div>
              <div style={{ fontSize: '0.62rem', color: T.muted, fontWeight: 600 }}>Conversión</div>
            </div>
          </>
        )}
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: statusCfg.color, background: statusCfg.color + '12', padding: '3px 10px', borderRadius: 999 }}>{statusCfg.label}</span>
        <ChevronRight size={14} color={T.muted} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CampaignManager() {
  const { tenant } = useTenant();
  const [feedbacks,  setFeedbacks]  = useState([]);
  const [locations,  setLocations]  = useState([]);
  const [campaigns,  setCampaigns]  = useState([]);
  const [userEmail,  setUserEmail]  = useState('');
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState('list');  // list | new | detail | success
  const [selected,   setSelected]   = useState(null);   // campaign being viewed
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // New campaign wizard state
  const [step,       setStep]       = useState(0);
  const [camType,    setCamType]    = useState(null);
  const [channel,    setChannel]    = useState('whatsapp');
  const [locationIds, setLocationIds] = useState([]);
  const [dateRange,  setDateRange]  = useState(30);
  const [onlyUnredeemed, setOnlyUnredeemed] = useState(false);
  const [message,    setMessage]    = useState('');
  const [camName,    setCamName]    = useState('');
  const [sending,    setSending]    = useState(false);
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [suppressedContacts, setSuppressedContacts] = useState(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.email) setUserEmail(data.session.user.email);
    });
  }, []);

  useEffect(() => { if (tenant?.id) loadData(); }, [tenant?.id]);

  const loadData = async () => {
    setLoading(true);
    const [locRes, campRes] = await Promise.all([
      supabase.from('locations').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('campaigns').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
    ]);
    if (locRes.data)  setLocations(locRes.data);
    if (campRes.data) setCampaigns(campRes.data);

    // Filter feedbacks by store IDs (tenant_id column may not be reliable)
    const storeIds = (locRes.data || []).map(l => l.id);
    if (storeIds.length > 0) {
      const { data: fbData } = await supabase
        .from('feedbacks')
        .select('id, location_id, score, contact_phone, contact_email, recovery_status, recovery_sent, routed_to_google, coupon_redeemed, created_at')
        .in('location_id', storeIds)
        .gte('created_at', subDays(new Date(), 90).toISOString());
      if (fbData) setFeedbacks(fbData);
    }

    // Load contacts already reached in the last 30 days for suppression
    const { data: recentRecipients } = await supabase
      .from('campaign_recipients')
      .select('destination')
      .eq('tenant_id', tenant.id)
      .eq('status', 'sent')
      .gte('sent_at', subDays(new Date(), 30).toISOString());
    setSuppressedContacts(new Set((recentRecipients || []).map(r => r.destination)));

    setLoading(false);
  };

  // ── Audience preview ──────────────────────────────────────────────────────
  const audienceConfig = useMemo(() => {
    if (!camType) return null;
    const type = CAMPAIGN_TYPES.find(t => t.value === camType);
    return { ...type.segment, location_ids: locationIds, date_range_days: dateRange, channel, only_unredeemed: onlyUnredeemed };
  }, [camType, locationIds, dateRange, channel]);

  const audienceFeedbacks = useMemo(() => {
    if (!audienceConfig) return [];
    const seen = new Set();
    return countAudience(feedbacks, audienceConfig).filter(f => {
      const key = channel === 'whatsapp' ? f.contact_phone : f.contact_email;
      if (!key || seen.has(key)) return false;
      if (suppressedContacts.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [feedbacks, audienceConfig, channel, suppressedContacts]);

  // ── Auto-fill campaign name + message when type selected ──────────────────
  const selectType = (typeVal) => {
    const type = CAMPAIGN_TYPES.find(t => t.value === typeVal);
    setCamType(typeVal);
    setOnlyUnredeemed(false);
    if (type.allowedChannels?.length === 1) setChannel(type.allowedChannels[0]);
    const locName = locationIds.length === 1
      ? locations.find(l => l.id === locationIds[0])?.name
      : null;
    setMessage(type.template(locName));
    setCamName(`${type.label} · ${format(new Date(), "d MMM", { locale: es })}`);
  };

  // ── Send campaign ─────────────────────────────────────────────────────────
  const sendCampaign = async () => {
    if (!audienceFeedbacks.length || !message || !camName) return;
    setSending(true);
    setSendProgress({ done: 0, total: audienceFeedbacks.length, errors: 0 });

    // Get current session token for Edge Function auth
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    // 1. Create campaign record
    const { data: camp, error: campErr } = await supabase.from('campaigns').insert({
      tenant_id:   tenant.id,
      name:        camName,
      type:        camType,
      audience:    audienceConfig,
      channel,
      message,
      status:      'sending',
      total_count: audienceFeedbacks.length,
      created_by:  userEmail,
    }).select().single();

    if (campErr || !camp) {
      setSending(false);
      alert('Error al crear campaña: ' + (campErr?.message || 'desconocido'));
      return;
    }

    // 2. Send to each recipient
    let done = 0, errors = 0;
    const type = CAMPAIGN_TYPES.find(t => t.value === camType);

    for (const fb of audienceFeedbacks) {
      const destination = channel === 'whatsapp' ? fb.contact_phone : fb.contact_email;
      let status = 'sent';
      let errorMessage = null;

      try {
        if (channel === 'whatsapp') {
          const { data, error } = await supabase.functions.invoke('send-recovery-message', {
            body: {
              feedback_id: fb.id,
              tenant_id:   tenant.id,
              phone:       destination,
              message,
              channel:     'whatsapp',
              note:        type?.note || camName,
              actor_email: userEmail,
            },
          });
          if (error || !data?.ok) {
            status = 'failed';
            errorMessage = data?.error || error?.message || 'Error desconocido';
            errors++;
          }
        } else {
          // Email via Resend
          const locName = locations.find(l => l.id === fb.location_id)?.name;
          const emailSubject = CAMPAIGN_TYPES.find(t => t.value === camType)?.label || camName;
          const { data, error } = await supabase.functions.invoke('send-campaign-email', {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
            body: {
              feedback_id: fb.id,
              tenant_id:   tenant.id,
              email:       destination,
              subject:     emailSubject,
              message,
              from_name:   locName || undefined,
              actor_email: userEmail,
              campaign_id: camp.id,
            },
          });
          if (error || !data?.ok) {
            status = 'failed';
            errorMessage = data?.error || error?.message || 'Error desconocido';
            errors++;
          }
        }
      } catch (e) {
        status = 'failed';
        errorMessage = String(e);
        errors++;
      }

      // Insert recipient record
      await supabase.from('campaign_recipients').insert({
        campaign_id: camp.id,
        tenant_id:   tenant.id,
        feedback_id: fb.id,
        destination,
        channel,
        status,
        error_message: errorMessage,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      });

      done++;
      setSendProgress({ done, total: audienceFeedbacks.length, errors });

      // Small delay to avoid rate limiting
      if (done < audienceFeedbacks.length) await new Promise(r => setTimeout(r, 300));
    }

    // 3. Update campaign status
    const finalStatus = errors === audienceFeedbacks.length ? 'failed' : 'sent';
    await supabase.from('campaigns').update({
      status:     finalStatus,
      sent_count: done - errors,
      failed_count: errors,
      sent_at:    new Date().toISOString(),
    }).eq('id', camp.id);

    setSending(false);
    await loadData();

    // Show success screen with summary
    setSendProgress({ done, total: audienceFeedbacks.length, errors });
    setView('success');
    resetWizard();
  };

  const openDetail = async (campaign) => {
    setSelected(campaign);
    setView('detail');
    setLoadingRecipients(true);
    const { data } = await supabase
      .from('campaign_recipients')
      .select('destination, status, error_message, sent_at, channel')
      .eq('campaign_id', campaign.id)
      .order('sent_at', { ascending: false });
    setRecipients(data || []);
    setLoadingRecipients(false);
  };

  const resetWizard = () => {
    setStep(0); setCamType(null); setChannel('whatsapp');
    setLocationIds([]); setDateRange(30); setOnlyUnredeemed(false); setMessage(''); setCamName('');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view === 'list') {
    const totalSent      = campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + (c.sent_count || 0), 0);
    const totalConverted = campaigns.reduce((s, c) => s + (c.converted_count || 0), 0);
    const avgConv        = totalSent ? Math.round(totalConverted / totalSent * 100) : 0;

    return (
      <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>Campañas</h1>
            <p style={{ fontSize: '0.85rem', color: T.muted }}>Contacta a tus clientes en segundos, segmentado por cómo se sienten.</p>
          </div>
          <button onClick={() => { resetWizard(); setView('new'); }} style={{
            padding: '10px 18px', borderRadius: 12, border: 'none',
            background: T.coral, color: '#fff', fontFamily: font,
            fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Plus size={16} /> Nueva campaña
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Campañas enviadas', value: campaigns.filter(c => c.status === 'sent').length, color: T.ink, Icon: Send },
            { label: 'Mensajes enviados',  value: totalSent,      color: T.teal,  Icon: MessageSquare },
            { label: 'Tasa conversión',   value: `${avgConv}%`,  color: T.green, Icon: BarChart2 },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} style={{ background: T.card, borderRadius: 16, padding: '16px 20px', border: `1.5px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon size={14} color={color} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Campaign list */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Cargando campañas…
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📣</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: T.ink, marginBottom: 8 }}>Crea tu primera campaña</div>
            <div style={{ fontSize: '0.88rem', color: T.muted, maxWidth: 400, margin: '0 auto 24px' }}>
              A diferencia de Mailchimp, no necesitas importar contactos. Retelio ya sabe quién está insatisfecho, quién te ama, y quién no ha regresado.
            </div>
            <button onClick={() => { resetWizard(); setView('new'); }} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: T.coral, color: '#fff', fontFamily: font, fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
              Crear campaña
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {campaigns.map(c => (
              <CampaignRow key={c.id} campaign={c} onView={openDetail} />
            ))}
          </div>
        )}

        <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUCCESS VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view === 'success') {
    const sent   = sendProgress.total - sendProgress.errors;
    const errors = sendProgress.errors;
    return (
      <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: T.card, borderRadius: 24, padding: '48px 40px', border: `1.5px solid ${T.border}`, textAlign: 'center', maxWidth: 400, width: '100%' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>{errors === 0 ? '🎉' : '⚠️'}</div>
          <h2 style={{ fontWeight: 900, color: T.ink, fontSize: '1.4rem', marginBottom: 8 }}>
            {errors === 0 ? 'Campaña enviada' : 'Campaña enviada con errores'}
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, margin: '20px 0 28px' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: T.teal }}>{sent}</div>
              <div style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 700, textTransform: 'uppercase' }}>Enviados</div>
            </div>
            {errors > 0 && (
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: T.red }}>{errors}</div>
                <div style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 700, textTransform: 'uppercase' }}>Fallidos</div>
              </div>
            )}
          </div>
          <button onClick={() => { setView('list'); setSendProgress({ done: 0, total: 0, errors: 0 }); }} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: T.coral, color: '#fff', fontFamily: font, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
            Ver campañas
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETAIL VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const type = CAMPAIGN_TYPES.find(t => t.value === selected.type) || CAMPAIGN_TYPES[3];
    const Icon = type.icon;
    return (
      <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh' }}>
        <button onClick={() => setView('list')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontFamily: font, fontSize: '0.82rem', fontWeight: 600, marginBottom: 20 }}>
          <ChevronLeft size={16} /> Volver
        </button>
        <div style={{ background: T.card, borderRadius: 20, padding: 24, border: `1.5px solid ${T.border}`, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: type.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={22} color={type.color} />
            </div>
            <div>
              <h2 style={{ fontWeight: 800, color: T.ink, fontSize: '1.1rem', marginBottom: 2 }}>{selected.name}</h2>
              <div style={{ fontSize: '0.78rem', color: T.muted }}>
                {selected.sent_at ? `Enviada el ${format(new Date(selected.sent_at), "d MMM yyyy · HH:mm", { locale: es })}` : 'Borrador'}
                {' · '} por {selected.created_by || '—'}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Audiencia',   value: selected.total_count   || 0, color: T.ink  },
              { label: 'Enviados',    value: selected.sent_count    || 0, color: T.teal },
              { label: 'Fallidos',    value: selected.failed_count  || 0, color: T.red  },
              { label: 'Convertidos', value: selected.converted_count || 0, color: T.green },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: T.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: T.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Mensaje enviado</div>
            <div style={{ fontSize: '0.85rem', color: T.ink, lineHeight: 1.6 }}>{selected.message}</div>
          </div>
        </div>

        {/* Recipients */}
        <div style={{ background: T.card, borderRadius: 20, padding: 24, border: `1.5px solid ${T.border}` }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
            Destinatarios ({recipients.length})
          </div>
          {loadingRecipients ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: T.muted, fontSize: '0.85rem' }}>Cargando...</div>
          ) : recipients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: T.muted, fontSize: '0.85rem' }}>Sin destinatarios registrados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recipients.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: T.bg, border: `1px solid ${T.border}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: r.status === 'sent' ? T.teal + '15' : T.red + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {r.status === 'sent'
                      ? <CheckCircle2 size={14} color={T.teal} />
                      : <AlertCircle size={14} color={T.red} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.destination}</div>
                    {r.error_message && <div style={{ fontSize: '0.72rem', color: T.red, marginTop: 2 }}>{r.error_message}</div>}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: T.muted, flexShrink: 0 }}>
                    {r.sent_at ? format(new Date(r.sent_at), 'HH:mm', { locale: es }) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NEW CAMPAIGN WIZARD
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => { resetWizard(); setView('list'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, display: 'flex', alignItems: 'center', gap: 5, fontFamily: font, fontSize: '0.82rem', fontWeight: 600 }}>
          <ChevronLeft size={16} /> Volver
        </button>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: T.ink }}>Nueva campaña</h1>
      </div>

      <StepBar step={step} />

      {/* ── STEP 0: Audience ── */}
      {step === 0 && (
        <div>
          {/* Campaign type */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Tipo de campaña</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {CAMPAIGN_TYPES.map(type => {
                const active = camType === type.value;
                return (
                  <button key={type.value} onClick={() => selectType(type.value)} style={{
                    padding: '14px 16px', borderRadius: 14, textAlign: 'left',
                    border: `2px solid ${active ? type.color : T.border}`,
                    background: active ? type.color + '08' : T.card,
                    cursor: 'pointer', fontFamily: font,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: type.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <type.icon size={16} color={type.color} />
                      </div>
                      <span style={{ fontWeight: 700, color: T.ink, fontSize: '0.88rem' }}>{type.label}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: T.muted, lineHeight: 1.4 }}>{type.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {camType && (
            <>
              {/* Channel */}
              {(() => {
                const allowed = CAMPAIGN_TYPES.find(t => t.value === camType)?.allowedChannels || ['whatsapp', 'email'];
                const visibleChannels = CHANNELS.filter(ch => allowed.includes(ch.value));
                return (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Canal</div>
                    {visibleChannels.length === 1 ? (() => {
                      const onlyCh = visibleChannels[0];
                      const OnlyIcon = onlyCh.Icon;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: onlyCh.color + '08', border: `2px solid ${onlyCh.color}` }}>
                          <OnlyIcon size={14} color={onlyCh.color} />
                          <span style={{ fontWeight: 700, color: onlyCh.color, fontSize: '0.82rem' }}>{onlyCh.label}</span>
                          <span style={{ fontSize: '0.7rem', color: T.muted, marginLeft: 4 }}>— único canal disponible para este tipo de campaña</span>
                        </div>
                      );
                    })() : (
                      <div style={{ display: 'flex', gap: 10 }}>
                        {visibleChannels.map(ch => {
                          const active = channel === ch.value;
                          return (
                            <button key={ch.value} onClick={() => setChannel(ch.value)} style={{
                              padding: '10px 16px', borderRadius: 10, flex: 1,
                              border: `2px solid ${active ? ch.color : T.border}`,
                              background: active ? ch.color + '08' : T.card,
                              cursor: 'pointer', fontFamily: font, textAlign: 'left',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                <ch.Icon size={14} color={active ? ch.color : T.muted} />
                                <span style={{ fontWeight: 700, color: active ? ch.color : T.ink, fontSize: '0.82rem' }}>{ch.label}</span>
                              </div>
                              <div style={{ fontSize: '0.68rem', color: T.muted }}>{ch.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Location filter */}
              {locations.length > 1 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                    Sucursales <span style={{ fontWeight: 500, textTransform: 'none' }}>(vacío = todas)</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {locations.map(loc => {
                      const active = locationIds.includes(loc.id);
                      return (
                        <button key={loc.id} onClick={() => setLocationIds(active ? locationIds.filter(id => id !== loc.id) : [...locationIds, loc.id])} style={{
                          padding: '5px 12px', borderRadius: 20,
                          border: `1.5px solid ${active ? T.coral : T.border}`,
                          background: active ? T.coral + '10' : 'none',
                          color: active ? T.coral : T.muted,
                          fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: font,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          <MapPin size={10} /> {loc.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Date range */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Período</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {DATE_RANGES.map(r => (
                    <button key={r.value} onClick={() => setDateRange(r.value)} style={{
                      padding: '6px 14px', borderRadius: 20,
                      border: `1.5px solid ${dateRange === r.value ? T.purple : T.border}`,
                      background: dateRange === r.value ? T.purple + '10' : 'none',
                      color: dateRange === r.value ? T.purple : T.muted,
                      fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: font,
                    }}>{r.label}</button>
                  ))}
                </div>
              </div>

              {/* Coupon filter */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                  <div
                    onClick={() => setOnlyUnredeemed(v => !v)}
                    style={{
                      width: 40, height: 22, borderRadius: 999, cursor: 'pointer',
                      background: onlyUnredeemed ? T.coral : T.border,
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, left: onlyUnredeemed ? 21 : 3,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: T.ink }}>Solo con cupón sin canjear</div>
                    <div style={{ fontSize: '0.7rem', color: T.muted }}>Filtra clientes que recibieron cupón pero no regresaron a usarlo</div>
                  </div>
                </label>
              </div>

              {/* Audience preview */}
              <div style={{ background: audienceFeedbacks.length > 0 ? T.teal + '08' : T.amber + '08', borderRadius: 14, padding: '14px 18px', border: `1.5px solid ${audienceFeedbacks.length > 0 ? T.teal + '30' : T.amber + '30'}`, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Users size={20} color={audienceFeedbacks.length > 0 ? T.teal : T.amber} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: T.ink }}>
                    {audienceFeedbacks.length} {audienceFeedbacks.length === 1 ? 'contacto' : 'contactos'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: T.muted }}>
                    {audienceFeedbacks.length === 0
                      ? 'No hay contactos que cumplan estos filtros'
                      : `Recibirán tu mensaje por ${channel === 'whatsapp' ? 'WhatsApp' : 'Email'}`}
                  </div>
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              disabled={!camType || audienceFeedbacks.length === 0}
              onClick={() => setStep(1)}
              style={{ padding: '10px 24px', borderRadius: 11, border: 'none', background: camType && audienceFeedbacks.length > 0 ? T.coral : T.border, color: '#fff', fontFamily: font, fontSize: '0.85rem', fontWeight: 700, cursor: camType && audienceFeedbacks.length > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 7 }}>
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 1: Message ── */}
      {step === 1 && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Nombre de la campaña</div>
            <input
              value={camName} onChange={e => setCamName(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontFamily: font, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Mensaje</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: T.purple, fontWeight: 600 }}>
                <Zap size={10} /> Generado por IA · editable
              </div>
            </div>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              rows={5}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontFamily: font, fontSize: '0.88rem', lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: '0.7rem', color: T.muted, marginTop: 4 }}>{message.length} caracteres</div>
          </div>

          {/* Preview */}
          {message && (
            <div style={{ background: '#075E54', borderRadius: 14, padding: '14px 16px', marginBottom: 24 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Preview WhatsApp</div>
              <div style={{ background: '#DCF8C6', borderRadius: '12px 12px 12px 0', padding: '10px 14px', display: 'inline-block', maxWidth: '85%' }}>
                <div style={{ fontSize: '0.82rem', color: '#111', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{message}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(0)} style={{ padding: '10px 20px', borderRadius: 11, border: `1.5px solid ${T.border}`, background: 'none', color: T.muted, fontFamily: font, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChevronLeft size={16} /> Atrás
            </button>
            <button disabled={!message.trim() || !camName.trim()} onClick={() => setStep(2)} style={{ padding: '10px 24px', borderRadius: 11, border: 'none', background: message.trim() && camName.trim() ? T.coral : T.border, color: '#fff', fontFamily: font, fontSize: '0.85rem', fontWeight: 700, cursor: message.trim() && camName.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 7 }}>
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Confirm & Send ── */}
      {step === 2 && (
        <div>
          {sending ? (
            <div style={{ background: T.card, borderRadius: 20, padding: '40px 24px', border: `1.5px solid ${T.border}`, textAlign: 'center' }}>
              <Loader size={32} color={T.coral} style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: T.ink, marginBottom: 8 }}>
                Enviando mensajes…
              </div>
              <div style={{ fontSize: '0.88rem', color: T.muted, marginBottom: 20 }}>
                {sendProgress.done} de {sendProgress.total}
                {sendProgress.errors > 0 && ` · ${sendProgress.errors} errores`}
              </div>
              {/* Progress bar */}
              <div style={{ background: T.bg, borderRadius: 999, height: 8, overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  background: `linear-gradient(90deg, ${T.teal}, ${T.coral})`,
                  width: `${sendProgress.total ? Math.round(sendProgress.done / sendProgress.total * 100) : 0}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ background: T.card, borderRadius: 20, padding: 24, border: `1.5px solid ${T.border}`, marginBottom: 16 }}>
                <h3 style={{ fontWeight: 800, color: T.ink, fontSize: '1rem', marginBottom: 16 }}>Resumen de campaña</h3>
                {[
                  { label: 'Nombre',     value: camName },
                  { label: 'Tipo',       value: CAMPAIGN_TYPES.find(t => t.value === camType)?.label },
                  { label: 'Canal',      value: channel === 'whatsapp' ? 'WhatsApp (Twilio)' : 'Email' },
                  { label: 'Sucursales', value: locationIds.length ? `${locationIds.length} seleccionada(s)` : 'Todas' },
                  { label: 'Período',    value: `Últimos ${dateRange} días` },
                  { label: 'Audiencia',  value: `${audienceFeedbacks.length} contactos` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: '0.82rem', color: T.muted, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: '0.82rem', color: T.ink, fontWeight: 700 }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: T.amber + '08', borderRadius: 12, padding: '12px 16px', border: `1px solid ${T.amber}30`, marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertCircle size={16} color={T.amber} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: '0.78rem', color: T.ink, lineHeight: 1.5 }}>
                  Se enviarán <strong>{audienceFeedbacks.length} mensajes</strong> de forma inmediata. Esta acción no se puede deshacer.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(1)} style={{ padding: '10px 20px', borderRadius: 11, border: `1.5px solid ${T.border}`, background: 'none', color: T.muted, fontFamily: font, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ChevronLeft size={16} /> Atrás
                </button>
                <button onClick={sendCampaign} style={{ padding: '10px 24px', borderRadius: 11, border: 'none', background: T.coral, color: '#fff', fontFamily: font, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Send size={16} /> Enviar a {audienceFeedbacks.length} contactos
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}
