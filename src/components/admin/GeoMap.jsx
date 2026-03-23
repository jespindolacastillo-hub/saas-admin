import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { MapPin, AlertTriangle, TrendingDown, Star, RefreshCw } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const npsColor = (score) => {
  if (score === null || score === undefined) return '#94a3b8';
  if (score >= 4) return '#00C9A7';
  if (score >= 3) return '#f59e0b';
  return '#ef4444';
};

const npsLabel = (score) => {
  if (score === null || score === undefined) return 'Sin datos';
  if (score >= 4) return 'Positivo';
  if (score >= 3) return 'Neutral';
  return 'Negativo';
};

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// ─── Map component (lazy-loaded to avoid SSR issues) ─────────────────────────
function LeafletMap({ stores }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || stores.length === 0) return;

    // Dynamically import leaflet CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      // Cleanup previous instance
      if (mapInstanceRef.current) {
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Find center from stores with coordinates
      const geoStores = stores.filter(s => s.lat && s.lng);
      if (geoStores.length === 0) return;

      const avgLat = geoStores.reduce((a, s) => a + s.lat, 0) / geoStores.length;
      const avgLng = geoStores.reduce((a, s) => a + s.lng, 0) / geoStores.length;

      const map = L.map(mapRef.current, {
        center: [avgLat, avgLng],
        zoom: 11,
        zoomControl: true,
      });
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      // Add circle markers
      geoStores.forEach((store) => {
        const radius = Math.max(12, Math.min(40, (store.count || 1) * 2.5));
        const color = npsColor(store.avg_score);

        const circle = L.circleMarker([store.lat, store.lng], {
          radius,
          fillColor: color,
          color: 'white',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        });

        const badCount = store.bad_count || 0;
        const scoreText = store.avg_score != null
          ? `${store.avg_score.toFixed(1)} / 5`
          : 'Sin datos';

        circle.bindPopup(`
          <div style="font-family: ${font}; min-width: 180px;">
            <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 6px; color: #0D0D12;">
              ${store.nombre}
            </div>
            ${store.ciudad ? `<div style="font-size: 0.78rem; color: #64748b; margin-bottom: 8px;">${store.ciudad}</div>` : ''}
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <div>
                <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Score</div>
                <div style="font-weight: 700; color: ${color}; font-size: 1rem;">${scoreText}</div>
              </div>
              <div>
                <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Feedbacks</div>
                <div style="font-weight: 700; color: #0D0D12; font-size: 1rem;">${store.count || 0}</div>
              </div>
              <div>
                <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Quejas</div>
                <div style="font-weight: 700; color: ${badCount > 0 ? '#ef4444' : '#10b981'}; font-size: 1rem;">${badCount}</div>
              </div>
            </div>
          </div>
        `, { maxWidth: 240 });

        circle.addTo(map);
        markersRef.current.push(circle);
      });

      // Fit map to markers
      if (geoStores.length > 1) {
        const group = L.featureGroup(markersRef.current);
        map.fitBounds(group.getBounds().pad(0.15));
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [stores]);

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden' }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GeoMap() {
  const { tenant } = useTenant();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | bad | good
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const fetchData = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      // Get stores from admin catalog (has tenant_id + nombre)
      const { data: catalogData, error: catErr } = await supabase
        .from('Tiendas_Catalogo')
        .select('id, nombre')
        .eq('tenant_id', tenant.id);

      if (catErr) throw catErr;
      if (!catalogData || catalogData.length === 0) {
        setStores([]);
        setLoading(false);
        return;
      }

      const catalogIds = catalogData.map(s => s.id);

      // Get coordinates from locations table (same IDs, where lat/lng were added)
      const { data: locData, error: locErr } = await supabase
        .from('locations')
        .select('id, lat, lng, ciudad')
        .in('id', catalogIds)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (locErr) throw locErr;

      // Merge: catalog name + location coordinates
      const locMap = {};
      (locData || []).forEach(l => { locMap[l.id] = l; });

      const storeData = catalogData
        .filter(s => locMap[s.id])
        .map(s => ({ ...s, ...locMap[s.id] }));

      if (storeData.length === 0) {
        setStores([]);
        setLoading(false);
        return;
      }

      // Get feedback aggregates per store — filter by store IDs (avoids tenant_id dependency)
      const { data: fbData, error: fbErr } = await supabase
        .from('feedbacks')
        .select('location_id, score')
        .in('location_id', catalogIds);

      if (fbErr) throw fbErr;

      // Aggregate by location_id
      const agg = {};
      (fbData || []).forEach((fb) => {
        if (!fb.location_id) return;
        if (!agg[fb.location_id]) agg[fb.location_id] = { count: 0, sum: 0, bad: 0 };
        agg[fb.location_id].count++;
        if (fb.score != null) agg[fb.location_id].sum += fb.score;
        if (fb.score != null && fb.score <= 2) agg[fb.location_id].bad++;
      });

      const enriched = storeData.map((s) => {
        const a = agg[s.id] || { count: 0, sum: 0, bad: 0 };
        return {
          ...s,
          count: a.count,
          avg_score: a.count > 0 ? a.sum / a.count : null,
          bad_count: a.bad,
        };
      });

      setStores(enriched);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant?.id]);

  const filtered = stores.filter((s) => {
    if (filter === 'bad') return s.avg_score != null && s.avg_score < 3;
    if (filter === 'good') return s.avg_score != null && s.avg_score >= 4;
    return true;
  });

  const totalFeedbacks = stores.reduce((a, s) => a + s.count, 0);
  const totalBad = stores.reduce((a, s) => a + s.bad_count, 0);
  const storesWithData = stores.filter(s => s.count > 0);
  const avgGlobal = storesWithData.length > 0
    ? storesWithData.reduce((a, s) => a + (s.avg_score || 0), 0) / storesWithData.length
    : null;

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.05)' : 'white',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
    borderRadius: '16px',
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: font }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <MapPin size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>Cargando mapa...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', fontFamily: font }}>
        <AlertTriangle size={32} style={{ marginBottom: 8 }} />
        <p>{error}</p>
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: font }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <MapPin size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <h3 style={{ fontWeight: 800, margin: '0 0 8px' }}>Sin coordenadas registradas</h3>
          <p style={{ fontSize: '0.88rem', opacity: 0.6 }}>
            Agrega latitud y longitud a tus sucursales para ver el mapa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', fontFamily: font, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.4rem', color: 'var(--text-main)' }}>
            Mapa de sucursales
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Visualiza patrones de quejas por zona geográfica
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.82rem', fontFamily: font }}
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <div style={cardStyle}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Sucursales</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)' }}>{stores.length}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stores.length - storesWithData.length} sin feedback</span>
        </div>
        <div style={cardStyle}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Total feedbacks</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)' }}>{totalFeedbacks}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>en el mapa</span>
        </div>
        <div style={cardStyle}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Score global</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 900, color: npsColor(avgGlobal) }}>
            {avgGlobal != null ? avgGlobal.toFixed(1) : '—'}
          </span>
          <span style={{ fontSize: '0.75rem', color: npsColor(avgGlobal) }}>{npsLabel(avgGlobal)}</span>
        </div>
        <div style={cardStyle}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Quejas (score ≤ 2)</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 900, color: totalBad > 0 ? '#ef4444' : '#00C9A7' }}>{totalBad}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {totalFeedbacks > 0 ? `${((totalBad / totalFeedbacks) * 100).toFixed(0)}% del total` : '—'}
          </span>
        </div>
      </div>

      {/* Filter + Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: 'all', label: 'Todas' },
            { key: 'bad', label: '🔴 Con quejas' },
            { key: 'good', label: '🟢 Positivas' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
                fontFamily: font, fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s',
                borderColor: filter === key ? '#FF5C3A' : 'var(--border)',
                background: filter === key ? '#FF5C3A' : 'transparent',
                color: filter === key ? 'white' : 'var(--text-secondary)',
              }}
            >{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#00C9A7', display: 'inline-block' }} /> Positivo (≥4)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Neutral (3–4)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Negativo (&lt;3)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} /> Sin datos</span>
        </div>
      </div>

      {/* Map */}
      <div style={{ height: '520px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', background: isDark ? '#1a1a2e' : '#f8fafc' }}>
        <LeafletMap stores={filtered} />
      </div>

      {/* Store list */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
          Ranking por score
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...filtered]
            .sort((a, b) => (a.avg_score ?? 99) - (b.avg_score ?? 99))
            .map((store) => (
              <div key={store.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.75rem 1rem', borderRadius: 12,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'white',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: npsColor(store.avg_score), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={16} color="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.nombre}</div>
                  {store.ciudad && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{store.ciudad}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: npsColor(store.avg_score) }}>
                    {store.avg_score != null ? store.avg_score.toFixed(1) : '—'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{store.count} fb</div>
                </div>
                {store.bad_count > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                    <TrendingDown size={12} /> {store.bad_count}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
