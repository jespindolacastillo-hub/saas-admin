import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { Target, Save, Search, Calendar, Award, TrendingUp, Loader, AlertCircle, CheckCircle2, MapPin } from 'lucide-react';

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

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const KpiManager = () => {
  const { tenant } = useTenant();
  const [locations, setLocations] = useState([]);
  const [goals, setGoals]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear());
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (tenant?.id) loadData();
  }, [tenant?.id, selectedMonth, selectedYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [locRes, goalRes] = await Promise.all([
        supabase.from('locations').select('id, name').eq('tenant_id', tenant.id).order('name'),
        supabase.from('Metas_KPI').select('*').eq('mes', selectedMonth).eq('anio', selectedYear).eq('tenant_id', tenant.id),
      ]);
      if (locRes.error) throw locRes.error;
      setLocations(locRes.data || []);
      setGoals(goalRes.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cargar datos: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoalChange = (locationId, field, value) => {
    const val = parseInt(value) || 0;
    setGoals(prev => {
      const idx = prev.findIndex(g => g.tienda_id === locationId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: val };
        return next;
      }
      return [...prev, { tienda_id: locationId, [field]: val, mes: selectedMonth, anio: selectedYear }];
    });
  };

  const saveGoal = async (locationId) => {
    setSaving(locationId);
    setMessage(null);
    try {
      const goal = goals.find(g => g.tienda_id === locationId) || {};
      const targetNps = goal.target_nps ?? 50;
      const targetVol = goal.target_volumen ?? 100;

      const { error } = await supabase.from('Metas_KPI').upsert({
        tienda_id: locationId,
        mes: selectedMonth,
        anio: selectedYear,
        target_nps: targetNps,
        target_volumen: targetVol,
        tenant_id: tenant.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tienda_id,mes,anio' });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Meta guardada correctamente.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al guardar: ' + err.message });
    } finally {
      setSaving(null);
    }
  };

  const getGoalValue = (locationId, field) => {
    const goal = goals.find(g => g.tienda_id === locationId);
    if (goal && goal[field] !== undefined) return goal[field];
    return field === 'target_nps' ? 50 : 100;
  };

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>
          Metas KPI
        </h1>
        <p style={{ fontSize: '0.85rem', color: T.muted }}>
          Define objetivos de NPS y volumen por sucursal y período
        </p>
      </div>

      {/* Controls */}
      <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.muted }} />
          <input
            type="text"
            placeholder="Buscar sucursal…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
              border: `1.5px solid ${T.border}`, fontSize: '0.88rem', fontFamily: font,
              outline: 'none', boxSizing: 'border-box', color: T.ink,
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.muted, fontSize: '0.88rem' }}>
          <Calendar size={16} />
          <span style={{ fontWeight: 600 }}>Período:</span>
        </div>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(parseInt(e.target.value))}
          style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: '0.88rem', fontFamily: font, color: T.ink, background: '#fff', outline: 'none' }}
        >
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(parseInt(e.target.value))}
          style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: '0.88rem', fontFamily: font, color: T.ink, background: '#fff', outline: 'none' }}
        >
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
          background: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
          color: message.type === 'success' ? T.green : '#DC2626',
          fontSize: '0.88rem', fontWeight: 600,
        }}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, padding: '56px 24px', textAlign: 'center' }}>
          <MapPin size={36} color={T.border} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: '0.9rem', color: T.muted, fontWeight: 500 }}>
            {locations.length === 0 ? 'Aún no tienes sucursales configuradas.' : 'No hay sucursales que coincidan.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {filtered.map(loc => {
            const npsVal = getGoalValue(loc.id, 'target_nps');
            const volVal = getGoalValue(loc.id, 'target_volumen');
            const isSaving = saving === loc.id;
            return (
              <div key={loc.id} style={{ background: T.card, borderRadius: 18, border: `1.5px solid ${T.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: T.teal + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={18} color={T.teal} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: T.ink, fontSize: '0.95rem' }}>{loc.name}</div>
                    <div style={{ fontSize: '0.72rem', color: T.muted }}>{MONTHS[selectedMonth - 1]} {selectedYear}</div>
                  </div>
                </div>

                {/* NPS Goal */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: T.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Award size={13} /> Meta NPS
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: T.purple }}>{npsVal} pts</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      type="range" min={0} max={100} value={npsVal}
                      onChange={e => handleGoalChange(loc.id, 'target_nps', e.target.value)}
                      style={{ flex: 1, accentColor: T.purple }}
                    />
                    <input
                      type="number" min={0} max={100} value={npsVal}
                      onChange={e => handleGoalChange(loc.id, 'target_nps', e.target.value)}
                      style={{ width: 56, padding: '6px 8px', borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: '0.85rem', fontFamily: font, textAlign: 'center', color: T.ink, outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Volume Goal */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: T.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <TrendingUp size={13} /> Meta de respuestas
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: T.teal }}>{volVal} resp.</span>
                  </div>
                  <input
                    type="number" min={0} value={volVal}
                    onChange={e => handleGoalChange(loc.id, 'target_volumen', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: '0.88rem', fontFamily: font, color: T.ink, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  onClick={() => saveGoal(loc.id)}
                  disabled={isSaving}
                  style={{
                    marginTop: 4, padding: '10px 16px', borderRadius: 12,
                    background: isSaving ? T.muted : T.coral,
                    color: '#fff', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: '0.88rem', fontFamily: font,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {isSaving
                    ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</>
                    : <><Save size={15} /> Guardar meta</>
                  }
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default KpiManager;
