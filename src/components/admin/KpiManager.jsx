import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { KpiService } from '../../services/kpiService';
import { tenantConfig } from '../../config/tenant';
import { useTranslation } from 'react-i18next';
import { Target, Save, Search, Calendar, Award, TrendingUp, Loader, AlertCircle, CheckCircle2 } from 'lucide-react';

const KpiManager = () => {
    const { t } = useTranslation();
    const [stores, setStores] = useState([]);
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null); // storeId being saved
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [message, setMessage] = useState(null);

    // Load stores and initial goals
    useEffect(() => {
        loadData();
    }, [selectedMonth, selectedYear]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Stores
            const { data: storesData, error: storesError } = await supabase
                .from('Tiendas_Catalogo')
                .select('*')
                .eq('tenant_id', tenantConfig.id)
                .order('nombre');

            if (storesError) throw storesError;

            // 2. Fetch Goals for selected period
            const goalsData = await KpiService.getMonthlyGoals(selectedMonth, selectedYear);

            setStores(storesData || []);
            setGoals(goalsData || []);
        } catch (err) {
            console.error('Error loading KPI data:', err);
            setMessage({ type: 'error', text: t('kpi.error_load') + ' ' + err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleGoalChange = (storeId, field, value) => {
        // Optimistic update in local state
        const existingGoalIndex = goals.findIndex(g => g.tienda_id === storeId);
        const val = parseInt(value) || 0;

        if (existingGoalIndex >= 0) {
            const newGoals = [...goals];
            newGoals[existingGoalIndex] = { ...newGoals[existingGoalIndex], [field]: val };
            setGoals(newGoals);
        } else {
            // Create simplified optimistic goal
            setGoals([...goals, { tienda_id: storeId, [field]: val, mes: selectedMonth, anio: selectedYear }]);
        }
    };

    const saveGoal = async (storeId) => {
        setSaving(storeId);
        setMessage(null);
        try {
            const goal = goals.find(g => g.tienda_id === storeId) || {};
            const targetNps = goal.target_nps !== undefined ? goal.target_nps : 50; // Default
            const targetVol = goal.target_volumen !== undefined ? goal.target_volumen : 100; // Default

            await KpiService.setGoal(storeId, selectedMonth, selectedYear, targetNps, targetVol);

            setMessage({ type: 'success', text: t('kpi.success_saved') });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: t('kpi.error_save') + ' ' + err.message });
        } finally {
            setSaving(null);
        }
    };

    const getGoalValue = (storeId, field) => {
        const goal = goals.find(g => g.tienda_id === storeId);
        if (goal) return goal[field];
        return field === 'target_nps' ? 50 : 100; // Defaults
    };

    const filteredStores = stores.filter(s =>
        s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            <Loader size={24} className="spin" /> {t('kpi.loading')}
        </div>
    );

    return (
        <div className="animate-in fade-in duration-500">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Target className="text-primary" size={32} />
                    {t('kpi.title')}
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t('kpi.subtitle')}
                </p>
            </header>

            {/* Controls */}
            <div className="card shadow-sm" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder={t('kpi.search_placeholder')}
                        className="input"
                        style={{ paddingLeft: '2.5rem' }}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                        <Calendar size={18} /> {t('kpi.period')}
                    </div>
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(parseInt(e.target.value))}
                        className="input"
                        style={{ width: '140px' }}
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {t(`months.${i + 1}`).toUpperCase()}
                            </option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(parseInt(e.target.value))}
                        className="input"
                        style={{ width: '100px' }}
                    >
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                    </select>
                </div>
            </div>

            {message && (
                <div style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: message.type === 'success' ? '#166534' : '#dc2626'
                }}>
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    {message.text}
                </div>
            )}

            {/* Grid of Stores */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {filteredStores.map(store => (
                    <div key={store.id} className="card hover-shadow" style={{ transition: 'all 0.2s', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>{store.nombre}</h3>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {store.id}</span>
                            </div>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Building store={store} size={20} color="#64748b" />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Target NPS Input */}
                             <div>
                                 <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                     <span><Award size={14} style={{ verticalAlign: 'text-bottom' }} /> {t('kpi.nps_meta')}</span>
                                     <span style={{ color: '#8b5cf6' }}>{getGoalValue(store.id, 'target_nps')} {t('kpi.units.pts')}</span>
                                 </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={getGoalValue(store.id, 'target_nps')}
                                        onChange={e => handleGoalChange(store.id, 'target_nps', e.target.value)}
                                        style={{ flex: 1, accentColor: '#8b5cf6' }}
                                    />
                                    <input
                                        type="number"
                                        value={getGoalValue(store.id, 'target_nps')}
                                        onChange={e => handleGoalChange(store.id, 'target_nps', e.target.value)}
                                        className="input"
                                        style={{ width: '60px', padding: '4px 8px', textAlign: 'center' }}
                                    />
                                </div>
                            </div>

                            {/* Target Volume Input */}
                             <div>
                                 <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                     <span><TrendingUp size={14} style={{ verticalAlign: 'text-bottom' }} /> {t('kpi.volumen_meta')}</span>
                                     <span style={{ color: '#10b981' }}>{getGoalValue(store.id, 'target_volumen')} {t('kpi.units.res')}</span>
                                 </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="number"
                                        value={getGoalValue(store.id, 'target_volumen')}
                                        onChange={e => handleGoalChange(store.id, 'target_volumen', e.target.value)}
                                        className="input"
                                        style={{ flex: 1 }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                                 <button
                                     onClick={() => saveGoal(store.id)}
                                     disabled={saving === store.id}
                                     className="btn btn-primary btn-sm"
                                     style={{ width: '100%', justifyContent: 'center' }}
                                 >
                                     {saving === store.id ? (
                                         <><Loader size={16} className="spin" /> {t('kpi.saving')}</>
                                     ) : (
                                         <><Save size={16} /> {t('kpi.save_btn')}</>
                                     )}
                                 </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
        .hover-shadow:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-color: #cbd5e1; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

        </div>
    );
}; // End Component

// Helper icon component
const Building = ({ size, color }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M8 10h.01"></path><path d="M16 10h.01"></path><path d="M8 14h.01"></path><path d="M16 14h.01"></path></svg>
);

export default KpiManager;
