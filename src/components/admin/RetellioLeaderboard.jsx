import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { Trophy, Star, MessageSquare, Zap, TrendingUp, MapPin, User, Users } from 'lucide-react';
import { subDays } from 'date-fns';

const T = {
  coral:  '#FF5C3A',
  teal:   '#00C9A7',
  purple: '#7C3AED',
  ink:    '#0D0D12',
  muted:  '#6B7280',
  border: '#E5E7EB',
  bg:     '#F7F8FC',
  card:   '#FFFFFF',
  green:  '#16A34A',
  amber:  '#F59E0B',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RetellioLeaderboard() {
  const { tenant } = useTenant();
  const [feedbacks,    setFeedbacks]    = useState([]);
  const [locations,    setLocations]    = useState([]);
  const [employeeQRs,  setEmployeeQRs]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [range,        setRange]        = useState(30);
  const [activeTab,    setActiveTab]    = useState('locations');

  useEffect(() => {
    if (tenant?.id) loadData();
  }, [tenant?.id, range]);

  const loadData = async () => {
    setLoading(true);
    const since = subDays(new Date(), range).toISOString();
    const [fbRes, locRes, qrRes] = await Promise.all([
      supabase.from('feedbacks')
        .select('id, location_id, qr_id, score, routed_to_google, recovery_sent, created_at')
        .eq('tenant_id', tenant.id)
        .gte('created_at', since),
      supabase.from('locations')
        .select('id, name')
        .eq('tenant_id', tenant.id),
      supabase.from('qr_codes')
        .select('id, label, location_id, type')
        .eq('tenant_id', tenant.id)
        .eq('type', 'employee'),
    ]);
    if (fbRes.data)  setFeedbacks(fbRes.data);
    if (locRes.data) setLocations(locRes.data);
    if (qrRes.data)  setEmployeeQRs(qrRes.data);
    setLoading(false);
  };

  const rankings = useMemo(() => {
    return locations.map(loc => {
      const fbs      = feedbacks.filter(f => f.location_id === loc.id);
      const total    = fbs.length;
      const reviews  = fbs.filter(f => f.routed_to_google).length;
      const unhappy  = fbs.filter(f => f.score <= 2).length;
      const recovered= fbs.filter(f => f.recovery_sent).length;
      const avg      = total ? (fbs.reduce((s, f) => s + f.score, 0) / total) : 0;
      const recRate  = unhappy ? Math.round((recovered / unhappy) * 100) : null;
      return { ...loc, total, reviews, avg: avg.toFixed(1), recRate, unhappy };
    }).sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg) || b.reviews - a.reviews);
  }, [feedbacks, locations]);

  const employeeRankings = useMemo(() => {
    return employeeQRs.map(qr => {
      const fbs      = feedbacks.filter(f => f.qr_id === qr.id);
      const total    = fbs.length;
      const reviews  = fbs.filter(f => f.routed_to_google).length;
      const unhappy  = fbs.filter(f => f.score <= 2).length;
      const recovered= fbs.filter(f => f.recovery_sent).length;
      const avg      = total ? (fbs.reduce((s, f) => s + f.score, 0) / total) : 0;
      const recRate  = unhappy ? Math.round((recovered / unhappy) * 100) : null;
      const location = locations.find(l => l.id === qr.location_id);
      return { ...qr, total, reviews, avg: avg.toFixed(1), recRate, unhappy, locationName: location?.name || '—' };
    }).sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg) || b.reviews - a.reviews);
  }, [feedbacks, employeeQRs, locations]);

  const best = rankings[0];

  return (
    <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Leaderboard
          </h1>
          <p style={{ fontSize: '0.85rem', color: T.muted }}>
            Ranking por calificación promedio
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 12, padding: 4 }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setRange(d)} style={{
              padding: '6px 16px', borderRadius: 9, border: 'none',
              background: range === d ? T.ink : 'transparent',
              color: range === d ? '#fff' : T.muted,
              fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: font,
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: 4, background: '#F1F5F9',
        borderRadius: 12, padding: 4, marginBottom: 20, width: 'fit-content',
      }}>
        {[
          { id: 'locations', label: 'Sucursales', Icon: MapPin },
          { id: 'employees', label: 'Empleados',  Icon: Users  },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 16px', borderRadius: 9, border: 'none',
              background: activeTab === id ? T.ink : 'transparent',
              color: activeTab === id ? '#fff' : T.muted,
              fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: font,
              transition: 'all 0.15s',
            }}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ── LOCATIONS TAB ── */}
      {activeTab === 'locations' && (
        <>
          {/* Top location highlight */}
          {!loading && best && best.total > 0 && (
            <div style={{
              background: `linear-gradient(135deg, ${T.ink} 0%, #1a0f0a 100%)`,
              borderRadius: 20, padding: '24px 28px', marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              boxShadow: '0 8px 32px rgba(13,13,18,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: '2.5rem' }}>🥇</div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: T.teal,
                    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    Mejor sucursal · últimos {range}d
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>{best.name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    {best.total} feedbacks · {best.reviews} reseñas Google
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '3rem', fontWeight: 800, color: T.teal, lineHeight: 1 }}>
                  {best.avg}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                  promedio / 5
                </div>
              </div>
            </div>
          )}

          {/* Locations table */}
          <div style={{
            background: T.card, borderRadius: 20, border: `1px solid ${T.border}`,
            overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', gap: 10 }}>
              <Trophy size={16} color={T.coral} />
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: T.ink }}>Ranking de sucursales</h3>
            </div>

            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: T.muted }}>Cargando…</div>
            ) : rankings.length === 0 ? (
              <div style={{ padding: '56px 24px', textAlign: 'center' }}>
                <MapPin size={36} color="#E5E7EB" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: '0.9rem', color: T.muted, fontWeight: 500 }}>
                  Aún no hay sucursales configuradas.
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: `1px solid ${T.border}` }}>
                    {['#', 'Sucursal', 'Feedbacks', 'Reseñas Google', 'Calificación ⌀', 'Recovery'].map(h => (
                      <th key={h} style={{
                        padding: '11px 20px', textAlign: 'left', fontWeight: 700,
                        color: T.muted, fontSize: '0.7rem', textTransform: 'uppercase',
                        letterSpacing: '0.07em', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((loc, i) => {
                    const avgNum = parseFloat(loc.avg);
                    const avgColor = avgNum >= 4.5 ? T.green : avgNum >= 3.5 ? T.teal : avgNum >= 2.5 ? T.amber : T.coral;
                    return (
                      <tr key={loc.id} style={{
                        borderBottom: `1px solid ${T.border}`,
                        background: i === 0 ? `${T.teal}06` : i % 2 === 0 ? '#fff' : '#FAFAFA',
                      }}>
                        <td style={{ padding: '16px 20px', fontWeight: 800, color: T.ink, fontSize: '1rem' }}>
                          {MEDALS[i] || <span style={{ color: T.muted, fontSize: '0.9rem' }}>{i + 1}</span>}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10,
                              background: i === 0 ? T.teal + '20' : T.purple + '10',
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MapPin size={15} color={i === 0 ? T.teal : T.purple} />
                            </div>
                            <span style={{ fontWeight: 700, color: T.ink }}>{loc.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MessageSquare size={14} color={T.muted} />
                            <span style={{ fontWeight: 600, color: T.ink }}>{loc.total}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Star size={14} color={T.teal} />
                            <span style={{ fontWeight: 700, color: T.teal }}>{loc.reviews}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: avgColor }}>
                            {loc.total > 0 ? loc.avg : '—'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: T.muted, marginLeft: 4 }}>/ 5</span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          {loc.unhappy > 0 ? (
                            <span style={{
                              fontSize: '0.8rem', fontWeight: 700, borderRadius: 999,
                              padding: '4px 10px',
                              background: (loc.recRate || 0) > 50 ? T.green + '15' : T.coral + '15',
                              color: (loc.recRate || 0) > 50 ? T.green : T.coral,
                            }}>
                              {loc.recRate}%
                            </span>
                          ) : (
                            <span style={{ color: '#D1D5DB', fontSize: '0.85rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Empty data hint */}
          {!loading && rankings.length > 0 && rankings.every(r => r.total === 0) && (
            <div style={{ marginTop: 16, textAlign: 'center', fontSize: '0.82rem', color: T.muted }}>
              Aún no hay feedbacks en este período. Escanea un QR para empezar.
            </div>
          )}
        </>
      )}

      {/* ── EMPLOYEES TAB ── */}
      {activeTab === 'employees' && (
        <div style={{
          background: T.card, borderRadius: 20, border: `1px solid ${T.border}`,
          overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.border}`,
            display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={16} color={T.purple} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: T.ink }}>Ranking de empleados</h3>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: T.muted }}>Cargando…</div>
          ) : employeeQRs.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <Users size={36} color="#E5E7EB" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: '0.9rem', color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>
                Aún no tienes QRs de empleado.<br />
                Créalos en QR Studio para medir el desempeño de tu equipo.
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: `1px solid ${T.border}` }}>
                  {['#', 'Empleado', 'Sucursal', 'Feedbacks', 'Reseñas Google', 'Calificación ⌀', 'Recovery'].map(h => (
                    <th key={h} style={{
                      padding: '11px 20px', textAlign: 'left', fontWeight: 700,
                      color: T.muted, fontSize: '0.7rem', textTransform: 'uppercase',
                      letterSpacing: '0.07em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employeeRankings.map((emp, i) => {
                  const avgNum   = parseFloat(emp.avg);
                  const avgColor = avgNum >= 4.5 ? T.green : avgNum >= 3.5 ? T.teal : avgNum >= 2.5 ? T.amber : T.coral;
                  return (
                    <tr key={emp.id} style={{
                      borderBottom: `1px solid ${T.border}`,
                      background: i === 0 ? `${T.purple}05` : i % 2 === 0 ? '#fff' : '#FAFAFA',
                    }}>
                      <td style={{ padding: '16px 20px', fontWeight: 800, color: T.ink, fontSize: '1rem' }}>
                        {MEDALS[i] || <span style={{ color: T.muted, fontSize: '0.9rem' }}>{i + 1}</span>}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10,
                            background: i === 0 ? T.purple + '20' : T.purple + '10',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={15} color={T.purple} />
                          </div>
                          <span style={{ fontWeight: 700, color: T.ink }}>{emp.label || 'Empleado'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          fontSize: '0.78rem', fontWeight: 600, color: T.ink,
                          background: T.teal + '10', borderRadius: 6, padding: '3px 8px',
                        }}>
                          {emp.locationName}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MessageSquare size={14} color={T.muted} />
                          <span style={{ fontWeight: 600, color: T.ink }}>{emp.total}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Star size={14} color={T.teal} />
                          <span style={{ fontWeight: 700, color: T.teal }}>{emp.reviews}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: avgColor }}>
                          {emp.total > 0 ? emp.avg : '—'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: T.muted, marginLeft: 4 }}>/ 5</span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        {emp.unhappy > 0 ? (
                          <span style={{
                            fontSize: '0.8rem', fontWeight: 700, borderRadius: 999,
                            padding: '4px 10px',
                            background: (emp.recRate || 0) > 50 ? T.green + '15' : T.coral + '15',
                            color: (emp.recRate || 0) > 50 ? T.green : T.coral,
                          }}>
                            {emp.recRate}%
                          </span>
                        ) : (
                          <span style={{ color: '#D1D5DB', fontSize: '0.85rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
