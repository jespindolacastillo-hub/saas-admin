import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Feedback from './components/Feedback';
import { supabase } from './lib/supabase';
import { tenantConfig } from './config/tenant';
import OrganizationSettings from './components/admin/OrganizationSettings';
import OnboardingTour from './components/admin/OnboardingTour';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, QrCode, LogOut,
  Menu, X, TrendingUp, TrendingDown,
  Smile, Frown, Meh, Filter, Award, Target, Building,
  Lightbulb, AlertCircle, CheckCircle2, AlertTriangle, Clock,
  Trophy, ShieldCheck, Download, History, HelpCircle, Trash2,
  Search, Plus, Save, Edit2, Check, Eye, Copy, PlusCircle, UserPlus, Fingerprint, Mail
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, AreaChart, Area, LabelList,
  PieChart, Pie, Sector
} from 'recharts';
import Auth from './components/Auth';
import { Bell, MessageSquare, RotateCcw } from 'lucide-react';
import { printQRCodes } from './components/PrintQR';
import QuestionManager from './components/admin/QuestionManager';
import UserManagement from './components/admin/UserManagement';
import ReferenceCode from './components/admin/UserManagement';
import EmailTemplateManager from './components/admin/EmailTemplateManager';
import BackupManager from './components/admin/BackupManager';

import KpiManager from './components/admin/KpiManager';
import IssueManagement from './components/admin/IssueManagement';
import { getSampleData } from './utils/sampleData';
import SetupChecklist from './components/admin/SetupChecklist';
import OnboardingWizard from './components/admin/OnboardingWizard';
import { useTenant } from './hooks/useTenant';

// Helper: Cálculo de NPS (Net Promoter Score)
const calculateNPS = (data) => {
  if (!data || data.length === 0) return 0;
  const promoters = data.filter(f => f.satisfaccion >= 4).length;
  const detractors = data.filter(f => f.satisfaccion <= 2).length;
  return Math.round(((promoters - detractors) / data.length) * 100);
};

// Helper: Exportar a CSV
const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]).join(',');
  const csvRows = data.map(row =>
    Object.values(row).map(val => {
      const stringVal = String(val);
      return `"${stringVal.replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csvContent = [headers, ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.click();
};

// Helper: Registro de Auditoría
const logAudit = async (session, action, table, recordId, details) => {
  if (!session?.user?.email) return;
  try {
    await supabase.rpc('log_action', {
      u_email: session.user.email,
      u_accion: action,
      u_tabla: table,
      u_id: String(recordId),
      u_detalles: details
    });
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
};


const Dashboard = ({
  rawData = [],
  stores = [],
  areas = [],
  filters = {},
  setFilters = () => { },
  loading = false,
  fetchError = null,
  refreshData = () => { },
  isDemoMode = false,
  setIsDemoMode = () => { },
  onStepLaunch = () => { }
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();


  const [metas, setMetas] = useState([]);
  const [isSnapshotMode, setIsSnapshotMode] = useState(false);
  const [highlightedData, setHighlightedData] = useState(null); // { area_id, type }

  useEffect(() => {
    if (isSnapshotMode) {
      document.body.classList.add('is-snapshot-mode');
    } else {
      document.body.classList.remove('is-snapshot-mode');
    }
    return () => document.body.classList.remove('is-snapshot-mode');
  }, [isSnapshotMode]);

  useEffect(() => {
    const fetchMetas = async () => {
      if (!tenant?.id) return;
      const { data } = await supabase.from('Metas_KPI').select('*').eq('tenant_id', tenant.id);
      if (data) setMetas(data);
    };
    fetchMetas();
  }, []);

  // Filtrado por fecha
  const dateFilteredData = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date();

    if (filters.dateRange === 'last7days') {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (filters.dateRange === 'last30days') {
      cutoffDate.setDate(now.getDate() - 30);
    }

    return rawData.filter(f => {
      if (filters.dateRange === 'all') return true;
      const dbDate = new Date(f.created_at);
      return !isNaN(dbDate) && dbDate >= cutoffDate;
    });
  }, [rawData, filters.dateRange]);

  // Filtrado por Tienda
  const storeFilteredData = useMemo(() => {
    if (filters.store === 'Todas') return dateFilteredData;
    return dateFilteredData.filter(f => f.tienda_id === filters.store);
  }, [dateFilteredData, filters.store]);

  // Filtrado por Área
  const areaFilteredData = useMemo(() => {
    if (filters.area === 'Todas') return storeFilteredData;
    return storeFilteredData.filter(f => f.area_id === filters.area);
  }, [storeFilteredData, filters.area]);

  // Filtrado Final por Sentimiento
  const finalFilteredData = useMemo(() => {
    if (filters.sentiment === 'Todos') return areaFilteredData;
    return areaFilteredData.filter(f => {
      const s = f.sentimiento || (f.satisfaccion >= 4 ? 'Positivo' : f.satisfaccion <= 2 ? 'Negativo' : 'Neutral');
      return s === filters.sentiment;
    });
  }, [areaFilteredData, filters.sentiment]);

  const currentMeta = useMemo(() => {
    if (filters.store === 'Todas') return { target_nps: 45, target_volumen: 200 };
    const meta = metas.find(m => m.tienda_id === filters.store);
    return meta || { target_nps: 40, target_volumen: 100 };
  }, [metas, filters.store]);

  // Helper functions to convert IDs to display names
  const getStoreName = (storeId) => {
    if (!Array.isArray(stores)) return storeId;
    const store = stores.find(s => s.id === storeId);
    return store?.nombre || storeId;
  };


  const getAreaName = (areaId) => {
    const area = areas.find(a => a.id === areaId);
    return area?.nombre || areaId;
  };


  // Cálculos NPS Multi-Nivel
  const globalNPS = useMemo(() => calculateNPS(dateFilteredData), [dateFilteredData]);
  const storeNPS = useMemo(() => calculateNPS(storeFilteredData), [storeFilteredData]);
  const currentNPS = useMemo(() => calculateNPS(finalFilteredData), [finalFilteredData]);

  // Comparación semanal (últimos 7 días vs 7 días anteriores)
  const weeklyComparison = useMemo(() => {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previous7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const currentWeek = rawData.filter(f => new Date(f.created_at.endsWith('Z') ? f.created_at : f.created_at + 'Z') >= last7Days);
    const previousWeek = rawData.filter(f => {
      const date = new Date(f.created_at.endsWith('Z') ? f.created_at : f.created_at + 'Z');
      return date >= previous7Days && date < last7Days;
    });

    const currentNPS = calculateNPS(currentWeek);
    const previousNPS = calculateNPS(previousWeek);
    const npsChange = currentNPS - previousNPS;

    const currentTotal = currentWeek.length;
    const previousTotal = previousWeek.length;
    const totalChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100).toFixed(1) : 0;

    return { npsChange, totalChange, currentTotal, previousTotal };
  }, [rawData]);

  // Rankings y Análisis (siempre muestra TODAS las áreas para comparación)
  const areaRanking = useMemo(() => {
    // Usar storeFilteredData (solo filtrado por tienda, NO por área)
    const uniqueAreaIds = [...new Set(storeFilteredData.map(f => f.area_id).filter(Boolean))];
    const ranking = uniqueAreaIds.map(areaId => {
      const areaData = storeFilteredData.filter(f => f.area_id === areaId);
      return {
        id: areaId,
        name: getAreaName(areaId),
        nps: calculateNPS(areaData),
        count: areaData.length
      };
    }).sort((a, b) => b.nps - a.nps);


    return ranking;
  }, [storeFilteredData, areas]);

  // Phase 3: Historical Comparison Logic
  const previousPeriodData = useMemo(() => {
    if (filters.dateRange === 'all') return [];

    const now = new Date();
    const currentCutoff = new Date();
    const prevCutoff = new Date();

    let days = 7;
    if (filters.dateRange === 'last30days') days = 30;

    currentCutoff.setDate(now.getDate() - days);
    prevCutoff.setDate(now.getDate() - (days * 2));

    return (rawData || []).filter(f => {
      if (!f || !f.created_at) return false;
      const dbDate = new Date(f.created_at);
      return !isNaN(dbDate.getTime()) && dbDate >= prevCutoff && dbDate < currentCutoff;
    });
  }, [rawData, filters.dateRange]);


  const stats = useMemo(() => {
    const total = (finalFilteredData || []).length;
    const avg = total > 0 ? (finalFilteredData.reduce((acc, curr) => acc + (curr?.satisfaccion || 0), 0) / total).toFixed(1) : 0;

    // Phase 3: Previous NPS Calculation
    const previousNPS = previousPeriodData.length > 0 ? calculateNPS(previousPeriodData) : null;

    return { total, avg, previousNPS };
  }, [finalFilteredData, previousPeriodData]);

  // Gráfico de Tendencia NPS en el Tiempo
  const npsTimeline = useMemo(() => {
    if (finalFilteredData.length === 0) return [];

    // 1. Determine Date Range to decide Granularity
    const timestamps = finalFilteredData.map(f => new Date(f.created_at).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const diffHours = (maxTime - minTime) / (1000 * 60 * 60);

    const isHourly = diffHours < 48 && diffHours >= 0;


    // 2. Group By
    const groups = (finalFilteredData || []).reduce((acc, f) => {
      if (!f || !f.created_at) return acc;
      const dateObj = new Date(f.created_at);

      if (isNaN(dateObj.getTime())) {
        return acc;
      }

      let key;
      if (isHourly) {
        // Hourly: Use ISO format "2026-01-29 14:00" for Recharts compatibility
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const hour = String(dateObj.getHours()).padStart(2, '0');
        key = `${year}-${month}-${day} ${hour}:00`;
      } else {
        // Daily: Use ISO format "2026-01-29" for Recharts compatibility
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        key = `${year}-${month}-${day}`;
      }

      if (!acc[key]) acc[key] = [];
      acc[key].push(f);
      return acc;
    }, {});

    const timeline = Object.entries(groups)
      .map(([dateKey, data]) => {
        // Create display label using locale
        const firstDate = new Date(data[0].created_at);
        const displayDate = isHourly
          ? firstDate.toLocaleString(i18n.language, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
          : firstDate.toLocaleDateString(i18n.language, {
            month: 'short',
            day: 'numeric'
          });

        return {
          date: dateKey, // ISO format for Recharts
          displayDate, // Localized format for labels
          nps: calculateNPS(data),
          nps_prev: stats.previousNPS, // Constant baseline for comparison
          total: data.length,
          promoters: data.filter(f => f.satisfaccion >= 4).length,
          detractors: data.filter(f => f.satisfaccion <= 2).length,
          _sortDate: new Date(data[0].created_at)
        };
      })
      .sort((a, b) => {
        return new Date(a._sortDate) - new Date(b._sortDate);
      });

    return timeline;
  }, [finalFilteredData, previousPeriodData, i18n.language]);

  // Phase 3: AI Concept Cloud Logic
  const aiConceptCloud = useMemo(() => {
    const stopWords = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'e', 'o', 'u', 'de', 'del', 'al', 'en', 'con', 'por', 'para', 'como', 'su', 'sus', 'que', 'qué', 'todo', 'esta', 'este', 'eso', 'esto', 'muy', 'más', 'pero', 'si', 'no', 'ya', 'tan']);
    const wordsMap = {};

    (finalFilteredData || []).forEach(f => {
      if (!f || typeof f.comentario !== 'string' || !f.comentario.trim()) return;
      const cleanComments = f.comentario.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(/\s+/);

      cleanComments.forEach(word => {
        if (word && word.length > 3 && !stopWords.has(word)) {
          wordsMap[word] = (wordsMap[word] || 0) + 1;
        }
      });
    });

    return Object.entries(wordsMap)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [finalFilteredData]);

  const chartData = useMemo(() => {
    const groups = finalFilteredData.reduce((acc, f) => {
      const date = new Date(f.created_at).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(groups).map(([name, total]) => ({ name, total })).reverse();
  }, [finalFilteredData]);

  // Análisis de Sentimiento IA
  const sentimentStats = useMemo(() => {
    const stats = {
      Positivo: 0,
      Neutral: 0,
      Negativo: 0,
      total: 0
    };

    finalFilteredData.forEach(f => {
      const s = f.sentimiento || (f.satisfaccion >= 4 ? 'Positivo' : f.satisfaccion <= 2 ? 'Negativo' : 'Neutral');
      if (stats[s] !== undefined) {
        stats[s]++;
        stats.total++;
      }
    });

    return [
      { name: t('common.positive'), value: stats.Positivo, color: '#10b981', icon: <Smile size={18} /> },
      { name: t('common.neutral'), value: stats.Neutral, color: '#f59e0b', icon: <Meh size={18} /> },
      { name: t('common.negative'), value: stats.Negativo, color: '#ef4444', icon: <Frown size={18} /> }
    ];
  }, [finalFilteredData, t]);

  // AI Smart Insights — 100% dinámico basado en datos reales
  const aiInsights = useMemo(() => {
    const insights = [];

    // 1. Área líder / área crítica — ahora con metadata para resaltar
    if (Array.isArray(areaRanking) && areaRanking.length > 0) {
      const top = areaRanking[0];
      const bot = areaRanking[areaRanking.length - 1];
      if (top?.nps > 70) insights.push({
        type: 'success',
        msg: t('dashboard.insights.area_leader', { name: top.name, nps: top.nps, count: top.count }),
        icon: <CheckCircle2 size={16} />,
        highlight: { type: 'area', id: top.id }
      });
      if (bot?.nps < 10 && areaRanking.length > 1) insights.push({
        type: 'alert',
        msg: t('dashboard.insights.critical_attention', { name: bot.name, nps: bot.nps }),
        icon: <AlertCircle size={16} />,
        highlight: { type: 'area', id: bot.id }
      });
    }

    // 2. Volumen semanal
    const totalChange = parseFloat(weeklyComparison?.totalChange ?? 0);
    const prevTotal = weeklyComparison?.previousTotal ?? 0;
    if (prevTotal > 0) {
      if (totalChange > 10) {
        insights.push({
          type: 'info',
          msg: t('dashboard.insights.volume_increase', { percent: weeklyComparison.totalChange, current: weeklyComparison.currentTotal, prev: weeklyComparison.previousTotal }),
          icon: <Lightbulb size={16} />
        });
      } else if (totalChange < -20) {
        insights.push({
          type: 'alert',
          msg: t('dashboard.insights.volume_decrease', { percent: weeklyComparison.totalChange }),
          icon: <AlertTriangle size={16} />
        });
      }
    }

    // 3. Cambio de NPS semana a semana
    const npsChange = weeklyComparison?.npsChange ?? 0;
    if (npsChange > 10) {
      insights.push({
        type: 'success',
        msg: t('dashboard.insights.nps_improved', { points: npsChange }),
        icon: <TrendingUp size={16} />
      });
    } else if (npsChange < -10) {
      insights.push({
        type: 'alert',
        msg: t('dashboard.insights.nps_dropped', { points: Math.abs(npsChange) }),
        icon: <TrendingDown size={16} />
      });
    }

    // 4. Progreso vs meta corporativa
    const targetNps = currentMeta?.target_nps ?? 0;
    if (targetNps > 0) {
      if (currentNPS >= targetNps) {
        insights.push({
          type: 'success',
          msg: t('dashboard.insights.goal_reached', { current: currentNPS, target: targetNps }),
          icon: <CheckCircle2 size={16} />
        });
      } else if (currentNPS < targetNps * 0.5) {
        insights.push({
          type: 'alert',
          msg: t('dashboard.insights.goal_below', { current: currentNPS, target: targetNps }),
          icon: <AlertCircle size={16} />
        });
      }
    }

    // 5. Dominancia de sentimiento
    if (Array.isArray(sentimentStats) && sentimentStats.length === 3) {
      const totalSentiment = sentimentStats.reduce((a, b) => a + (b?.value ?? 0), 0);
      if (totalSentiment > 10) {
        const negVal = sentimentStats[2]?.value ?? 0;
        const posVal = sentimentStats[0]?.value ?? 0;
        const negPercent = Math.round((negVal / totalSentiment) * 100);
        const posPercent = Math.round((posVal / totalSentiment) * 100);
        if (negPercent > 40) {
          insights.push({
            type: 'alert',
            msg: t('dashboard.insights.negative_feedback', { percent: negPercent, count: negVal }),
            icon: <Frown size={16} />
          });
        } else if (posPercent > 70) {
          insights.push({
            type: 'success',
            msg: t('dashboard.insights.positive_feedback', { percent: posPercent, count: posVal }),
            icon: <Smile size={16} />
          });
        }
      }
    }

    return insights;
  }, [areaRanking, weeklyComparison, currentNPS, currentMeta, sentimentStats, t]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>{t('menu.loading')}</div>;

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Error de Base de Datos</h2>
        <p className="text-slate-500 max-w-md mb-6">
          El sistema detectó un problema en la estructura de la base de datos (posible columna faltante):
          <br /><code className="bg-slate-100 p-2 rounded mt-2 block text-xs">{fetchError}</code>
        </p>
        <div className="flex gap-4">
          <button onClick={refreshData} className="btn btn-secondary">
            Reintentar
          </button>
          <button onClick={() => window.open('https://app.supabase.com', '_blank')} className="btn btn-primary">
            Ir a Supabase SQL Editor
          </button>
          <button
            onClick={() => {
                localStorage.clear();
                window.location.reload();
            }}
            className="btn btn-danger"
          >
            Resetear Todo (Nueva Sesión)
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-8">
          Nota: Ejecuta los scripts <code>db_force_uuids.sql</code> y <code>fix_rls_policies.sql</code> en el editor SQL para solucionar problemas de estructura o permisos.
        </p>
      </div>
    );
  }

  if (!loading && !isDemoMode && rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
        <SetupChecklist 
          storesCount={stores.length} 
          areasCount={areas.length} 
          onStepClick={onStepLaunch}
        />
        <div style={{ marginTop: '2rem' }}>
          <button
            onClick={() => setIsDemoMode(true)}
            className="btn btn-primary btn-lg animate-pulse"
            style={{ padding: '1.2rem 3rem', borderRadius: '16px', fontWeight: '900', fontSize: '1.1rem', boxShadow: '0 10px 25px rgba(37, 99, 235, 0.3)' }}
          >
            <TrendingUp size={22} style={{ marginRight: '8px' }} /> {t('menu.start_demo')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {isDemoMode && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 99999 }}>
          <div className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '100px', boxShadow: 'var(--shadow-lg)', border: '1px solid #f97316' }}>
            <TrendingUp size={16} /> <strong>DEMO MODE ACTIVE</strong>
            <button onClick={() => setIsDemoMode(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a3412', fontWeight: 'bold', marginLeft: '8px' }}>[EXIT]</button>
          </div>
        </div>
      )}
      {window.location.hostname === 'localhost' && (
        <div className="dev-banner">
          <span className="dev-badge">{t('common.dev_mode')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /> {t('common.localhost_warning')}
          </span>
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }} className="animate-slide-up">
        {/* Title and Action Buttons Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'Outfit', fontSize: '2.2rem', fontWeight: '800', letterSpacing: '-0.03em', color: '#1e293b', marginBottom: '0.25rem' }}>
              {t('dashboard.title')} <span style={{ color: 'var(--primary)' }}>Pro</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: '500' }}>{t('dashboard.subtitle')}</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className={`btn ${isSnapshotMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setIsSnapshotMode(!isSnapshotMode)}>
              <Eye size={18} /> {isSnapshotMode ? t('common.normal_view') : t('common.snapshot_mode')}
            </button>
            <button className="btn btn-secondary" onClick={refreshData}>
              <History size={18} /> {t('common.sync')}
            </button>
            <button className="btn btn-primary" onClick={() => exportToCSV(finalFilteredData, 'feedback_export.csv')}>
              <Download size={18} /> {t('common.export')}
            </button>
          </div>
        </div>

        {/* Executive Snapshot Row (Phase 2) */}
        <div className="snapshot-row">
          <div className="snapshot-pill">
            <div className="snapshot-icon"><MessageSquare size={16} /></div>
            <div className="snapshot-info">
              <span className="snapshot-label">{t('dashboard.feedback_today')}</span>
              <span className="snapshot-data">
                {finalFilteredData.filter(f => new Date(f.created_at).toDateString() === new Date().toDateString()).length} {t('dashboard.entries')}
              </span>
            </div>
          </div>
          <div className="snapshot-pill">
            <div className="snapshot-icon"><Trophy size={16} /></div>
            <div className="snapshot-info">
              <span className="snapshot-label">{t('dashboard.top_area')}</span>
              <span className="snapshot-data">
                {areaRanking.length > 0 ? areaRanking[0].name : '--'}
              </span>
            </div>
          </div>
          <div className="snapshot-pill">
            <div className="snapshot-icon"><Smile size={16} /></div>
            <div className="snapshot-info">
              <span className="snapshot-label">{t('dashboard.sentiment')}</span>
              <span className="snapshot-data">{t('dashboard.dominant_positive')}</span>
            </div>
          </div>
          <div className="snapshot-pill">
            <div className="snapshot-icon" style={{ background: '#fef2f2', color: '#ef4444' }}><AlertTriangle size={16} /></div>
            <div className="snapshot-info">
              <span className="snapshot-label">{t('dashboard.ia_urgency')}</span>
              <span className="snapshot-data">{t('dashboard.critical_count', { count: 0 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Exit Snapshot Mode Floating Button */}
      {isSnapshotMode && (
        <div className="snapshot-mode-overlay">
          <button className="btn btn-primary" style={{ borderRadius: '100px', padding: '12px 24px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} onClick={() => setIsSnapshotMode(false)}>
            <X size={18} /> {t('common.exit_snapshot')}
          </button>
        </div>
      )}

      {/* Hierarchy Upgrade: Strategic vs Operational Sections */}


      <h3 style={{ fontFamily: 'Outfit', fontSize: '1.2rem', fontWeight: '800', marginBottom: '1.25rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <TrendingUp size={20} color="var(--primary)" /> Métricas Estratégicas
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card tier1-card" style={{ borderTop: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">NPS Global de la Red</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '0.5rem' }}>
                <span className="stat-value" style={{ fontSize: '3.5rem' }}>{globalNPS}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '20px', background: weeklyComparison.npsChange >= 0 ? '#dcfce7' : '#fee2e2' }}>
                  {weeklyComparison.npsChange >= 0 ? <TrendingUp size={16} color="#10b981" /> : <TrendingDown size={16} color="#ef4444" />}
                  <span style={{ fontSize: '0.85rem', color: weeklyComparison.npsChange >= 0 ? '#10b981' : '#ef4444', fontWeight: '800' }}>
                    {weeklyComparison.npsChange >= 0 ? '+' : ''}{weeklyComparison.npsChange}
                  </span>
                </div>
              </div>
            </div>
            <div className="tooltip-wrapper">
              <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px' }}>
                <Trophy size={24} color="var(--primary)" />
              </div>
              <span className="tooltip-content">Net Promoter Score Global</span>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.75rem' }}>
            Rango de lealtad neta calculado en todas las unidades de negocio.
          </p>
        </div>

        <div className="card tier1-card" style={{ borderTop: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <span className="stat-label">Cumplimiento de Objetivos</span>
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600' }}>NPS vs Meta</span>
                  <span style={{ color: 'var(--text-muted)' }}>{currentNPS} / {currentMeta.target_nps} pts</span>
                </div>
                <div style={{ height: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.25rem' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.max(0, Math.min(100, (currentNPS / currentMeta.target_nps) * 100))}%`,
                    background: currentNPS >= currentMeta.target_nps ? 'var(--primary)' : 'linear-gradient(90deg, #8b5cf6 0%, #3b82f6 100%)',
                    borderRadius: '10px',
                    boxShadow: '0 0 10px rgba(139, 92, 246, 0.3)'
                  }}></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600' }}>Volumen vs Cuota</span>
                  <span style={{ color: 'var(--text-muted)' }}>{stats.total} / {currentMeta.target_volumen} resp.</span>
                </div>
                <div style={{ height: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.max(5, Math.min(100, (stats.total / currentMeta.target_volumen) * 100))}%`,
                    background: stats.total >= currentMeta.target_volumen ? '#10b981' : '#f59e0b',
                    borderRadius: '10px'
                  }}></div>
                </div>
              </div>
            </div>
            <div style={{ background: '#f5f3ff', padding: '10px', borderRadius: '12px', marginLeft: '1rem' }}>
              <Target size={24} color="#8b5cf6" />
            </div>
          </div>
        </div>
      </div>

      <h3 style={{ fontFamily: 'Outfit', fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#1e293b' }}>Desempeño Operativo</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="stat-label">Sentimiento IA</span>
            <div className="tooltip-wrapper">
              <HelpCircle size={14} color="#94a3b8" className="help-icon" />
              <span className="tooltip-content">
                <strong>Análisis de Sentimiento</strong><br />
                Clasificación automática del tono emocional de los comentarios.<br /><br />
                <strong>Categorías:</strong><br />
                😊 Positivo: Satisfacción alta (4-5★)<br />
                😐 Neutral: Satisfacción media (3★)<br />
                ☹️ Negativo: Insatisfacción (1-2★)<br /><br />
                La barra muestra el % de feedback positivo.
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '1rem', alignItems: 'center' }}>
            {sentimentStats.map(s => (
              <div key={s.name} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: s.color, marginBottom: '4px' }}>{s.icon}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1e293b' }}>{s.value}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.name}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem', background: '#f1f5f9', borderRadius: '4px', height: '4px', width: '100%', overflow: 'hidden' }}>
            <div style={{
              background: (sentimentStats[0]?.value ?? 0) > (sentimentStats[2]?.value ?? 0) ? '#10b981' : '#ef4444',
              height: '100%',
              width: (() => {
                const total = sentimentStats.reduce((a, b) => a + (b?.value ?? 0), 0);
                return `${total > 0 ? ((sentimentStats[0]?.value ?? 0) / total) * 100 : 0}%`;
              })()
            }}></div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="stat-label">Feedback Total</span>
            <div className="tooltip-wrapper">
              <HelpCircle size={14} color="#94a3b8" className="help-icon" />
              <span className="tooltip-content">
                <strong>Volumen de Respuestas</strong><br />
                Número total de feedback recibido en el período seleccionado.<br /><br />
                <strong>Indicador:</strong><br />
                La flecha muestra el cambio vs. semana anterior.<br />
                📈 Verde: Aumento | 📉 Rojo: Disminución<br /><br />
                Mayor volumen = Mayor representatividad de datos
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
            <span className="stat-value" style={{ fontSize: '1.8rem' }}>{stats.total}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {weeklyComparison.totalChange > 0 ? (
                <>
                  <TrendingUp size={14} color="#10b981" />
                  <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700' }}>+{weeklyComparison.totalChange}%</span>
                </>
              ) : weeklyComparison.totalChange < 0 ? (
                <>
                  <TrendingDown size={14} color="#ef4444" />
                  <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '700' }}>{weeklyComparison.totalChange}%</span>
                </>
              ) : null}
            </div>
          </div>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginTop: '4px', display: 'block' }}>Interacciones totales analizadas</small>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="stat-label">Rating Promedio</span>
              <div className="tooltip-wrapper">
                <HelpCircle size={14} color="#94a3b8" className="help-icon" />
                <span className="tooltip-content">
                  <strong>Calificación Promedio</strong><br />
                  Promedio de todas las calificaciones de satisfacción.<br /><br />
                  <strong>Cálculo:</strong><br />
                  Suma de todas las calificaciones / Total de respuestas<br /><br />
                  <strong>Escala:</strong><br />
                  ⭐ 1 = Muy insatisfecho<br />
                  ⭐⭐⭐⭐⭐ 5 = Muy satisfecho
                </span>
              </div>
            </div>
            <div style={{ color: '#fbbf24' }}>⭐</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
            <span className="stat-value" style={{ fontSize: '1.8rem' }}>{stats.avg}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 5.0</span>
          </div>
          <div style={{ marginTop: 'auto', background: '#f8fafc', borderRadius: '4px', height: '6px', width: '100%', overflow: 'hidden' }}>
            <div style={{ background: '#fbbf24', height: '100%', width: `${(stats.avg / 5) * 100}%` }}></div>
          </div>
        </div>
      </div>

      {/* Unified Analytics & Strategy Section - Vertical Columns */}
      {/* Unified Analytics & Strategy Section - Vertical Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>

        {/* Left Column: Intelligence (AI & Sentiment) */}
        {/* Row 1: Intelligence vs Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'stretch' }}>
          {/* AI Insights Card - Redesigned as Executive Summary */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#fef3c7', padding: '8px', borderRadius: '10px' }}>
                  <Lightbulb size={20} color="#f59e0b" />
                </div>
                <h3 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>{t('dashboard.ia_predictive')}</h3>
              </div>
              <span className="badge badge-warning" style={{ borderRadius: '20px', padding: '4px 12px' }}>Beta Pro</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {aiInsights.map((insight, i) => (
                <div
                  key={i}
                  onMouseEnter={() => insight.highlight && setHighlightedData(insight.highlight)}
                  onMouseLeave={() => setHighlightedData(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '1rem',
                    background: 'white',
                    borderRadius: '16px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.3s ease',
                    cursor: insight.highlight ? 'help' : 'default',
                    transform: highlightedData?.id === insight.highlight?.id && insight.highlight ? 'scale(1.02)' : 'none',
                    borderColor: highlightedData?.id === insight.highlight?.id && insight.highlight ? 'var(--primary)' : '#f1f5f9'
                  }}
                  className="hover-card-subtle"
                >
                  <div style={{
                    color: insight.type === 'success' ? '#10b981' : insight.type === 'alert' ? '#ef4444' : '#3b82f6',
                    background: insight.type === 'success' ? '#dcfce7' : insight.type === 'alert' ? '#fee2e2' : '#eff6ff',
                    padding: '8px',
                    borderRadius: '10px'
                  }}>
                    {insight.icon}
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#475569',
                    fontWeight: '500',
                    lineHeight: '1.4'
                  }}>
                    {insight.msg}
                  </div>
                </div>
              ))}
              {aiInsights.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  {t('dashboard.analyzing_trends')}
                </div>
              )}
            </div>
          </div>

          {/* Sentiment Distribution Card */}
          {/* Performance Matrix Card - Refined Layout */}
          {/* Performance Ranking Card */}
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>{t('dashboard.performance_ranking')}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>{t('dashboard.comp_operational')}</p>
              </div>
              <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '10px' }}>
                <TrendingUp size={18} color="var(--primary)" />
              </div>
            </div>

            <div style={{ flex: 1, minHeight: '260px' }}>
              {areaRanking.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={areaRanking.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 10, right: 60, left: 40, bottom: 5 }}
                  >
                    <XAxis type="number" hide domain={[0, 100]} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#475569', fontSize: 10, fontWeight: 800 }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-lg)', padding: '12px' }}
                    />
                    <Bar dataKey="nps" radius={[0, 20, 20, 0]} barSize={22}>
                      {areaRanking.slice(0, 8).map((entry, index) => {
                        const isHighlighted = highlightedData?.type === 'area' && String(highlightedData?.id) === String(entry.id);
                        const hasActiveHighlight = highlightedData?.type === 'area';

                        return (
                          <Cell
                            key={index}
                            fill={entry.nps > 70 ? '#10b981' : entry.nps > 40 ? '#3b82f6' : entry.nps > 0 ? '#f59e0b' : '#ef4444'}
                            fillOpacity={hasActiveHighlight ? (isHighlighted ? 1 : 0.15) : 0.9}
                            className={isHighlighted ? 'highlight-focus' : (hasActiveHighlight ? 'dim-effect' : '')}
                            style={{ transition: 'all 0.3s ease' }}
                          />
                        );
                      })}
                      <LabelList
                        dataKey="nps"
                        position="right"
                        offset={10}
                        style={{
                          fill: '#1e293b',
                          fontWeight: '800',
                          fontSize: '11px',
                          fontFamily: 'Outfit',
                          transition: 'opacity 0.3s ease',
                          opacity: highlightedData?.type === 'area' ? (highlightedData?.id ? 1 : 0.3) : 1
                        }}
                        formatter={(val) => `${val} pts`}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>{t('dashboard.analyzing')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Performance & Detail (Matrix & Categories) */}
        {/* Row 2: Analytical Widgets (Sentiment, Concepts, Categories) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', alignItems: 'stretch', marginBottom: '1.5rem' }}>
          {/* Sentiment Distribution Card - Donut Chart */}
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>{t('dashboard.empathy_analysis')}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>{t('dashboard.emotional_class')}</p>
              </div>
              <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '10px' }}>
                <Users size={18} color="var(--primary)" />
              </div>
            </div>

            <div style={{ flex: 1, minHeight: '220px', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentStats}
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {sentimentStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Content */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b', fontFamily: 'Outfit' }}>
                  {Math.round(((sentimentStats[0]?.value ?? 0) / (stats.total || 1)) * 100)}%
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>{t('common.positive')}</div>
              </div>
            </div>
          </div>

          {/* New Card: Concept Cloud (Phase 3) */}
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>{t('dashboard.key_concepts')}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>{t('dashboard.top_terms')}</p>
              </div>
              <div style={{ background: '#fef3c7', padding: '8px', borderRadius: '10px' }}>
                <Lightbulb size={18} color="#f59e0b" />
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0.5rem', alignContent: 'flex-start' }}>
              {aiConceptCloud.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: idx < 3 ? 'var(--primary-light)' : '#f8fafc',
                    color: idx < 3 ? 'var(--primary)' : '#64748b',
                    fontSize: idx < 3 ? '0.75rem' : '0.65rem',
                    fontWeight: idx < 3 ? '800' : '600',
                    border: '1px solid',
                    borderColor: idx < 3 ? 'rgba(37, 99, 235, 0.1)' : '#e2e8f0',
                    transition: 'all 0.2s ease'
                  }}
                  className="animate-fade-in"
                >
                  {tag.text} ({tag.count})
                </span>
              ))}
              {aiConceptCloud.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', width: '100%', padding: '2rem' }}>
                  {t('dashboard.analyzing')}
                </div>
              )}
            </div>
          </div>


          {/* Top Categories Card */}
          <div className="card">
            <h3 style={{ fontFamily: 'Outfit', fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="#8b5cf6" /> {t('dashboard.top_categories')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Atención', 'Limpieza', 'Rapidez', 'Producto', 'Precio'].map(cat => {
                // Frontend AI Simulation: Detect categories from comments if tags are missing
                const keywords = {
                  'Atención': ['amable', 'actitud', 'personal', 'grosero', 'atencion', 'ayuda', 'trato', 'gente', 'empleado', 'servicio', 'bien', 'mal', 'excelente', 'pésimo', 'hola'],
                  'Limpieza': ['sucio', 'basura', 'baño', 'limpieza', 'limpio', 'polvo', 'olor', 'orden', 'desorden', 'piso', 'mesa'],
                  'Rapidez': ['lento', 'tarda', 'fila', 'rapido', 'espera', 'caja', 'tiempo', 'hora', 'minutos', 'segundos'],
                  'Producto': ['producto', 'talla', 'zapato', 'calidad', 'roto', 'modelo', 'stock', 'variedad', 'número', 'numero', 'par'],
                  'Precio': ['caro', 'precio', 'costo', 'barato', 'oferta', 'descuento', 'promocion', 'pagar', 'pago']
                };

                const count = finalFilteredData.filter(f => {
                  const comment = (f.comentario || '').toLowerCase();
                  // Match DB tags OR simulate from comments
                  return (f.tags_ia && f.tags_ia.includes(cat)) || keywords[cat].some(k => comment.includes(k));
                }).length;

                const percent = finalFilteredData.length > 0 ? Math.round((count / finalFilteredData.length) * 100) : 0;
                return (
                  <div key={cat} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', color: '#1e293b' }}>{cat}</span>
                      <span style={{ color: '#64748b' }}>{count} items ({percent}%)</span>
                    </div>
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        height: '100%',
                        width: `${percent}%`,
                        background: cat === 'Atención' ? '#3b82f6' : cat === 'Limpieza' ? '#10b981' : cat === 'Rapidez' ? '#f59e0b' : '#94a3b8',
                        borderRadius: '4px',
                        transition: 'width 1s ease-in-out'
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>


      {/* Daily Feedback Volume Chart - USER REQUESTED ANALYTICS */}
      <div className="card" style={{ marginBottom: '1.5rem', minHeight: '350px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>
              {t('dashboard.volume_chart_title', 'Daily Feedback Volume')}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
              {t('dashboard.volume_chart_desc', 'Number of responses received per day')}
            </p>
          </div>
          <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '12px' }}>
            <TrendingUp size={20} color="#10b981" />
          </div>
        </div>
        <div style={{ height: '260px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{fill: '#94a3b8', fontSize: 10}}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{fill: '#94a3b8', fontSize: 10}}
              />
              <Tooltip
                cursor={{fill: '#f8fafc', radius: 10}}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-lg)', padding: '12px' }}
              />
              <Bar
                dataKey="total"
                fill="var(--primary)"
                radius={[8, 8, 0, 0]}
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend & Table Grid - Fixed Height for Professional Alignment */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '1.5rem',
        alignItems: 'stretch',
        maxHeight: '480px' // Constrain the height of this row
      }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '480px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1rem' }}>{t('dashboard.nps_evolution')}</h3>
              <div className="tooltip-wrapper">
                <AlertCircle size={14} color="#94a3b8" className="help-icon" />
                <span className="tooltip-content">
                  {t('dashboard.nps_trend_desc')}
                </span>
              </div>
            </div>
            {npsTimeline.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {npsTimeline[npsTimeline.length - 1].nps > npsTimeline[0].nps ? (
                  <>
                    <TrendingUp size={14} color="#10b981" />
                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '700' }}>{t('dashboard.improving')}</span>
                  </>
                ) : (
                  <>
                    <TrendingDown size={14} color="#ef4444" />
                    <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: '700' }}>{t('dashboard.needs_attention')}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minHeight: '280px' }}>
            {npsTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={npsTimeline} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorNps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="displayDate"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8' }}
                    domain={['auto', 'auto']}
                  />
                  <Area
                    type="monotone"
                    dataKey="nps"
                    stroke="var(--primary)"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorNps)"
                    animationDuration={2000}
                  />
                  {stats.previousNPS !== null && (
                    <Line
                      type="monotone"
                      dataKey="nps_prev"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={false}
                      label={false}
                    />
                  )}
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-lg)', padding: '16px' }}
                    formatter={(value, name) => [
                      `${value} pts`,
                      name === 'nps' ? t('dashboard.actual_nps') : t('dashboard.prev_target')
                    ]}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {t('dashboard.generating_timeline')}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '480px', overflow: 'hidden', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '10px' }}>
                <History size={18} color="#64748b" />
              </div>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>{t('dashboard.audit_log')}</h3>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary)', background: '#eff6ff', padding: '4px 12px', borderRadius: '20px' }}>
              {t('dashboard.last_records', { count: finalFilteredData.length > 50 ? 50 : finalFilteredData.length })}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ padding: '12px 1.5rem', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('audit.timestamp')}</th>
                  <th style={{ padding: '12px 1.5rem', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('dashboard.entries')}</th>
                  <th style={{ padding: '12px 1.5rem', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('audit.insight_opinion')}</th>
                </tr>
              </thead>
              <tbody>
                {finalFilteredData.slice(0, 50).map((f) => {
                  const dateObj = new Date(f.created_at);
                  const dateLabel = dateObj.toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: '2-digit' });
                  const timeLabel = dateObj.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid #f8fafc' }} className="hover-row-subtle">
                      <td style={{ padding: '1rem 1.5rem', verticalAlign: 'top' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b' }}>{dateLabel}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{timeLabel}</div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', verticalAlign: 'top' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b' }}>{getStoreName(f.tienda_id)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '600' }}>{getAreaName(f.area_id)}</div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', verticalAlign: 'top' }}>
                        <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0, fontStyle: f.comentario ? 'normal' : 'italic', lineHeight: '1.4' }}>
                          {f.comentario || t('common.no_comment')}
                        </p>
                        <div style={{ marginTop: '8px' }}>
                          <span className={`badge ${f.satisfaccion >= 4 ? 'badge-success' : f.satisfaccion <= 2 ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.6rem', padding: '2px 8px' }}>
                            {f.satisfaccion >= 4 ? t('common.promoter') : f.satisfaccion <= 2 ? t('common.detractor') : t('common.passive')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {finalFilteredData.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      <History size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                      <p style={{ fontSize: '0.85rem' }}>{t('dashboard.no_audit_data')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div >
  );
};

// ... QRGenerator and UserManagement updated for simplified Pro UI
// QR Studio Component: Generación y Gestión de QRs
const QRGenerator = () => {
  const { t } = useTranslation();
  const [stores, setStores] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [loading, setLoading] = useState(true);
  const [batchMode, setBatchMode] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [storesRes, areasRes] = await Promise.all([
      supabase.from('Tiendas_Catalogo').select('*').eq('tenant_id', tenant.id).order('nombre'),
      supabase.from('Areas_Catalogo').select('*').eq('tenant_id', tenant.id).order('orden')
    ]);

    if (storesRes.data) setStores(storesRes.data);
    if (areasRes.data) setAreas(areasRes.data);
    setLoading(false);
  };

  const getQRUrl = (storeId, areaId) => {
    // Usar variable de entorno para la URL base del feedback, fallback a producción
    const baseUrl = import.meta.env.VITE_FEEDBACK_URL || 'https://priceshoes.netlify.app/feedback';
    return `${baseUrl}?t=${storeId}&a=${areaId}`;
  };

  const activeAreas = useMemo(() => {
    if (!selectedStore) return [];
    // Filter areas directly by tienda_id
    return areas.filter(area => area.tienda_id === selectedStore);
  }, [selectedStore, areas]);

  const downloadQR = (id) => {
    const svg = document.getElementById(id);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR-${id}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const printAllQRs = async () => {
    console.log('printAllQRs called', { selectedStore, activeAreasLength: activeAreas.length });

    if (!selectedStore || activeAreas.length === 0) {
      alert(t('qr.alerts.select_store_active'));
      return;
    }

    const storeName = stores.find(s => s.id === selectedStore)?.nombre || t('qr.select_store_placeholder');

    try {
      await printQRCodes(
        activeAreas,
        storeName,
        (areaId) => getQRUrl(selectedStore, areaId),
        t
      );
    } catch (error) {
      console.error('Error al generar QR codes:', error);
      alert(t('qr.alerts.error_generating'));
    }
  };

  const printAllQRs_OLD = () => {
    if (!selectedStore || activeAreas.length === 0) {
      alert('Selecciona una tienda con áreas activas');
      return;
    }

    const storeName = stores.find(s => s.id === selectedStore)?.nombre || 'Tienda';
    const printWindow = window.open('', '_blank');

    // Get grid configuration based on layout
    const layoutConfig = {
      1: { cols: 1, qrSize: 400, fontSize: '1.5rem', titleSize: '2rem' },
      2: { cols: 2, qrSize: 300, fontSize: '1.2rem', titleSize: '1.5rem' },
      4: { cols: 2, qrSize: 200, fontSize: '1rem', titleSize: '1.2rem' },
      6: { cols: 3, qrSize: 150, fontSize: '0.9rem', titleSize: '1rem' }
    };

    const config = layoutConfig[printLayout];
    const itemsPerPage = printLayout;

    // Generate QR codes HTML
    let qrCodesHTML = '';
    activeAreas.forEach((ta, index) => {
      const qrUrl = getQRUrl(selectedStore, ta.id); // Use ta.id for area_id
      const isLastOnPage = (index + 1) % itemsPerPage === 0;
      const pageBreak = isLastOnPage && index < activeAreas.length - 1 ? 'page-break-after: always;' : '';

      qrCodesHTML += `
        <div class="qr-item" style="${pageBreak}">
          <div class="qr-container">
            <svg id="qr-${index}" width="${config.qrSize}" height="${config.qrSize}"></svg>
          </div>
          <div class="qr-label">${ta.nombre}</div>
          <div class="qr-store">${storeName}</div>
        </div>
      `;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Codes - ${storeName}</title>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              padding: 20mm;
            }
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(${config.cols}, 1fr);
              gap: 15mm;
              width: 100%;
            }
            .qr-item {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
            }
            .qr-container {
              background: white;
              padding: 10mm;
              border-radius: 12px;
              border: 2px solid #e2e8f0;
              margin-bottom: 8mm;
              display: inline-block;
            }
            .qr-label {
              font-size: ${config.fontSize};
              font-weight: 700;
              color: #1e293b;
              margin-bottom: 2mm;
            }
            .qr-store {
              font-size: calc(${config.fontSize} * 0.8);
              color: #64748b;
            }
            @media print {
              body { padding: 10mm; }
              .qr-item { break-inside: avoid; }
            }
            @page {
              size: letter;
              margin: 10mm;
            }
          </style>
        </head>
        <body>
          <div class="qr-grid">
            ${qrCodesHTML}
          </div>
          <script>
            ${activeAreas.map((ta, index) => `
              QRCode.toCanvas(document.getElementById('qr-${index}'), '${getQRUrl(selectedStore, ta.id)}', { // Use ta.id for area_id
                width: ${config.qrSize},
                margin: 2,
                errorCorrectionLevel: 'H'
              });
            `).join('\n')}

            // Auto print after QR codes are generated
            setTimeout(() => {
              window.print();
            }, 500);
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('menu.loading')}...</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '700' }}>{t('qr.studio_title')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('qr.studio_desc')}</p>
        </div>
        <button
          className="btn"
          onClick={() => setBatchMode(!batchMode)}
          style={{ background: batchMode ? 'var(--primary)' : 'white', color: batchMode ? 'white' : 'var(--primary)', border: '1px solid var(--primary)' }}
        >
          {batchMode ? t('qr.individual_mode') : t('qr.batch_mode')}
        </button>
      </div>

      {!batchMode ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.5rem' }}>{t('qr.config')}</h3>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>{t('qr.select_store')}</label>
              <select
                value={selectedStore}
                onChange={(e) => { setSelectedStore(e.target.value); setSelectedArea(''); }}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
              >
                <option value="">{t('qr.select_store_placeholder')}</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>{t('qr.select_area')}</label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                disabled={!selectedStore}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', opacity: selectedStore ? 1 : 0.5 }}
              >
                <option value="">{t('qr.select_area_placeholder')}</option>
                {activeAreas.map(area => (
                  <option key={area.id} value={area.id}>{area.nombre}</option>
                ))}
              </select>
            </div>

            <div style={{ padding: '1rem', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
              <p style={{ fontSize: '0.75rem', color: '#0369a1', margin: 0 }}>
                💡 <strong>{t('qr.tip_title')}</strong> {t('qr.tip_desc')}
              </p>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {selectedStore && selectedArea ? (
              <>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9' }}>
                  <QRCodeSVG
                    id="single-qr"
                    value={getQRUrl(selectedStore, selectedArea)}
                    size={200}
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                      src: "/logo-original.png",
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '0.25rem' }}>
                    {stores.find(s => s.id === selectedStore)?.nombre}
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    {t('common.area')}: {areas.find(a => a.id === selectedArea)?.nombre}
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-primary" onClick={() => downloadQR('single-qr')}>{t('qr.download_png')}</button>
                    <button className="btn btn-secondary" onClick={() => window.print()}>{t('qr.print')}</button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: '#94a3b8' }}>
                <QrCode size={64} strokeWidth={1} style={{ marginBottom: '1rem' }} />
                <p style={{ fontSize: '0.9rem' }}>{t('qr.preview_placeholder')}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>{t('qr.batch_select_label')}</label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              style={{ maxWidth: '400px', width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
            >
              <option value="">{t('qr.select_store_placeholder')}</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          {selectedStore && activeAreas.length > 0 && (
            <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.9rem', color: '#0369a1', marginBottom: '0.5rem' }}>
                    <strong>{t('qr.ready_to_print')}</strong> {t('qr.qr_count', { count: activeAreas.length, suffix: activeAreas.length !== 1 ? 's' : '' })}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#0369a1', marginBottom: 0 }}>
                    💡 <strong>{t('qr.tip_title')}</strong> {t('qr.batch_tip')}
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={printAllQRs}
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}
                >
                  🖨️ {t('qr.print')}
                </button>
              </div>
            </div>
          )}

          {selectedStore ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {activeAreas.map(area => (
                <div key={area.id} className="card" style={{ padding: '1rem', textAlign: 'center', background: '#f8fafc' }}>
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', display: 'inline-block', marginBottom: '1rem' }}>
                    <QRCodeSVG
                      id={`batch-qr-${area.id}`}
                      value={getQRUrl(selectedStore, area.id)}
                      size={120}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem' }}>{area.nombre}</div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => downloadQR(`batch-qr-${area.id}`)}
                  >
                    {t('qr.download')}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
              <p>{t('qr.no_store_selected')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// ADMIN SYSTEM: Gestión de Tiendas, Áreas y Usuarios
// ============================================




const Leaderboard = ({ rawData = [], stores = [], areas = [], filters = {}, loading = false }) => {
  const { t } = useTranslation();

  const getStoreName = (id) => stores.find(s => s.id === id)?.nombre || id;

  const storeRankings = useMemo(() => {
    // Apply global filters to data before ranking
    const safeRawData = Array.isArray(rawData) ? rawData : [];
    const dateFiltered = safeRawData.filter(f => {
      if (!f || !filters) return false;
      if (filters.dateRange === 'all') return true;
      const now = new Date();
      const cutoff = new Date();
      if (filters.dateRange === 'last7days') cutoff.setDate(now.getDate() - 7);
      else if (filters.dateRange === 'last30days') cutoff.setDate(now.getDate() - 30);
      return new Date(f.created_at) >= cutoff;
    });

    const uniqueStores = [...new Set(dateFiltered.map(f => f.tienda_id).filter(Boolean))];


    return uniqueStores.map(store => {
      const storeData = dateFiltered.filter(f => f.tienda_id === store);
      return {
        id: store,
        name: getStoreName(store),
        nps: calculateNPS(storeData),
        volume: storeData.length,
        avg: (storeData.reduce((acc, curr) => acc + curr.satisfaccion, 0) / storeData.length || 0).toFixed(1)
      };
    }).sort((a, b) => b.nps - a.nps);
  }, [rawData, filters.dateRange, stores]);


  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('menu.loading')}...</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '700' }}>{t('leaderboard.title')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('leaderboard.subtitle')}</p>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>{t('leaderboard.rank')}</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>{t('common.store')}</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>NPS</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>{t('leaderboard.volume')}</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>{t('leaderboard.status')}</th>
            </tr>
          </thead>
          <tbody>
            {storeRankings.map((store, index) => (
              <tr key={store.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>
                  {index + 1}
                  {index === 0 && ' 🥇'}
                  {index === 1 && ' 🥈'}
                  {index === 2 && ' 🥉'}
                </td>
                <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
                  {store.name}
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('leaderboard.official_store')}</div>
                </td>
                <td style={{
                  padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: '700',
                  color: store.nps > 40 ? '#10b981' : store.nps > 0 ? '#f59e0b' : '#ef4444'
                }}>
                  {store.nps}
                </td>
                <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: '#1e293b' }}>{store.volume}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', width: '80px' }}>
                    <div style={{
                      width: `${Math.max(5, Math.min(100, (store.nps + 100) / 2))}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary) 0%, #60a5fa 100%)',
                      borderRadius: '3px'
                    }}></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const formatDateMX = (dateStr) => {
  if (!dateStr) return 'N/A';
  // Ensure we interpret the string as UTC to force correct timezone shift
  const utcDateStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  return new Date(utcDateStr).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
  });
};

const AuditTrail = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!tenant?.id) return;
      const { data } = await supabase.from('Auditoria').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50);
      if (data) setLogs(data);
      setLoading(false);
    };
    fetchLogs();
  }, []);


  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('menu.loading')}...</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '800' }}>{t('audit.title')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('audit.subtitle')}</p>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>{t('audit.date')}</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>{t('audit.user')}</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>{t('audit.action')}</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>{t('audit.table')}</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>{t('audit.details')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr
                  key={log.id}
                  style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.8rem', cursor: 'pointer', transition: 'background 0.2s' }}
                  onClick={() => setSelectedLog(log)}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '1rem', color: '#64748b' }}>{formatDateMX(log.created_at)}</td>
                  <td style={{ padding: '1rem', fontWeight: '700', color: '#1e293b' }}>{log.usuario_email}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '6px', background: '#eef2ff', color: '#4338ca', fontSize: '0.65rem', fontWeight: '800'
                    }}>
                      {log.accion}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{log.tabla_afectada}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <button className="btn btn-sm" style={{ padding: '4px 12px' }} onClick={() => setSelectedLog(log)}>
                      {t('audit.view_details')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forensic Detail Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(2px)'
        }} onClick={() => setSelectedLog(null)}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '2rem', width: '90%', maxWidth: '800px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>{t('audit.forensic_evidence')}</h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace' }}>{t('common.id')}: {selectedLog.id}</span>
              </div>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', lineHeight: 0 }}>×</button>
            </div>

            {/* Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>{t('audit.responsible_user')}</div>
                <div style={{ fontWeight: '600' }}>{selectedLog.usuario_email}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>{t('audit.date_time')}</div>
                <div style={{ fontWeight: '600' }}>{formatDateMX(selectedLog.created_at)}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>{t('audit.device_user_agent')}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                  {selectedLog.detalles?.meta?.userAgent || t('common.not_registered')}
                </div>
              </div>
            </div>

            {/* Changes Analysis */}
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem' }}>{t('audit.changes_analysis')}</h3>

            {selectedLog.detalles?.changes ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem', fontWeight: '700', fontSize: '0.85rem' }}>{t('audit.previous_state')}</div>
                  <pre style={{ padding: '1rem', margin: 0, fontSize: '0.8rem', overflowX: 'auto', background: '#fff' }}>
                    {JSON.stringify(selectedLog.detalles.changes.before, null, 2)}
                  </pre>
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ background: '#dcfce7', color: '#166534', padding: '0.75rem', fontWeight: '700', fontSize: '0.85rem' }}>{t('audit.new_state')}</div>
                  <pre style={{ padding: '1rem', margin: 0, fontSize: '0.8rem', overflowX: 'auto', background: '#fff' }}>
                    {JSON.stringify(selectedLog.detalles.changes.after, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px' }}>
                <pre style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(selectedLog.detalles, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function AdminPanel({ tenant, tenantLoading }) { // Use 'tenant' directly from props
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Map path to activeTab
  const pathMap = {
    '/ajustes': 'org',
    '/issues': 'issues',
    '/qr': 'qr',
    '/leaderboard': 'leaderboard',
    '/estructura': 'users',
    '/marketing': 'email',
    '/respaldos': 'backup',
    '/metas': 'kpi',
    '/preguntas': 'questions',
    '/auditoria': 'audit',
    '/': 'dash'
  };

  const activeTab = pathMap[pathname] || 'dash';

  const [session, setSession] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [masterMode, setMasterMode] = useState(localStorage.getItem('ps_master_mode') === 'active');
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem('onboarding_complete'));


  // Shared Filtering State
  const [rawData, setRawData] = useState([]);
  const [stores, setStores] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [filters, setFilters] = useState({
    store: 'Todas',
    area: 'Todas',
    dateRange: 'last7days',
    sentiment: 'Todos',
    canal: 'Todos'
  });

  // State for IssueManagement
  const [issues, setIssues] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);


  const fetchIssues = async () => {
    setIssuesLoading(true);
    if (!tenant?.id) return;
    let query = supabase.from('Issues').select('*').eq('tenant_id', tenant.id);
    if (filters.store !== 'Todas') query = query.eq('tienda_id', filters.store);
    if (filters.area !== 'Todas') query = query.eq('area_id', filters.area);
    const { data } = await query.order('fecha_reporte', { ascending: false });
    if (data) setIssues(data);
    setIssuesLoading(false);
  };

  useEffect(() => {
    fetchIssues();
    const safeRawData = Array.isArray(rawData) ? rawData : [];
    const criticalFeedback = safeRawData.filter(f => f && f.satisfaccion <= 2 && f.comentario);
    setFeedback(criticalFeedback);
  }, [filters.store, filters.area, rawData]);


  const handleLaunchWizard = (stepIndex) => {
    setWizardStep(stepIndex);
    setShowOnboarding(true);
  };

  const refreshData = async () => {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      setFetchError(null);

      // Simple, direct fetch with current tenant
      const [fRes, sRes, aRes] = await Promise.all([
        supabase.from('Feedback').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
        supabase.from('Tiendas_Catalogo').select('*').eq('tenant_id', tenant.id),
        supabase.from('Areas_Catalogo').select('*').eq('tenant_id', tenant.id)
      ]);

      if (fRes.error) throw fRes.error;
      if (sRes.error) throw sRes.error;
      if (aRes.error) throw aRes.error;

      setRawData(fRes.data || []);
      setStores(sRes.data || []);
      setAreas(aRes.data || []);
    } catch (error) {
      console.error('Refresh Data Error:', error);
      setFetchError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenant?.id) {
      refreshData();
    }
  }, [tenant?.id]);

  const getStoreName = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    return store?.nombre || storeId;
  };

  const getAreaName = (areaId) => {
    const area = areas.find(a => a.id === areaId);
    return area?.nombre || areaId;
  };

  const dateFilteredData = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date();
    if (filters.dateRange === 'last7days') cutoffDate.setDate(now.getDate() - 7);
    else if (filters.dateRange === 'last30days') cutoffDate.setDate(now.getDate() - 30);

    return rawData.filter(f => {
      if (filters.dateRange === 'all') return true;
      const dbDate = new Date(f.created_at);
      return !isNaN(dbDate) && dbDate >= cutoffDate;
    });
  }, [rawData, filters.dateRange]);

  const storeFilteredData = useMemo(() => {
    if (filters.store === 'Todas') return dateFilteredData;
    return dateFilteredData.filter(f => f.tienda_id === filters.store);
  }, [dateFilteredData, filters.store]);

  const finalFilteredData = useMemo(() => {
    let filtered = storeFilteredData;
    if (filters.area !== 'Todas') filtered = filtered.filter(f => f.area_id === filters.area);
    if (filters.canal !== 'Todos') filtered = filtered.filter(f => f.canal === filters.canal);
    if (filters.sentiment !== 'Todos') filtered = filtered.filter(f => (f.sentimiento || (f.satisfaccion >= 4 ? 'Positivo' : f.satisfaccion <= 2 ? 'Negativo' : 'Neutral')) === filters.sentiment);
    return filtered;
  }, [storeFilteredData, filters.area, filters.sentiment]);

  const handleStoreChange = (newStore) => {
    const newStoreData = newStore === 'Todas' ? dateFilteredData : dateFilteredData.filter(f => f.tienda_id === newStore);
    const availableAreas = [...new Set(newStoreData.map(f => f.area_id).filter(Boolean))];
    const newArea = availableAreas.includes(filters.area) ? filters.area : 'Todas';
    setFilters({ ...filters, store: newStore, area: newArea });
  };

  const handleMasterBypass = () => {
    if (masterMode) {
      // Desactivar modo maestro
      if (window.confirm(t('admin.master_mode_deactivate_confirm'))) {
        localStorage.removeItem('ps_master_mode');
        setMasterMode(false);
        alert(t('admin.master_mode_deactivated'));
      }
    } else {
      // Activar modo maestro
      const pass = prompt(t('admin.master_mode_password_prompt'));
      if (pass === '1972') {
        localStorage.setItem('ps_master_mode', 'active');
        setMasterMode(true);
        alert(t('admin.master_mode_activated'));
      } else if (pass !== null) {
        alert(t('admin.master_mode_incorrect_password'));
      }
    }
  };


  useEffect(() => {
    // Escuchar cambios en la sesión
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchNotifications();

      // Realtime alerts subscription
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'Alerts' },
          (payload) => {
            setNotifications(prev => [payload.new, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session]);

  const fetchNotifications = async () => {
    if (!tenant?.id) return;
    const { data } = await supabase
      .from('Alerts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setNotifications(data);
  };

  const markAsRead = async (id) => {
    await supabase.from('Alerts').update({ leida: true }).eq('id', id).eq('tenant_id', tenant.id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, leida: true } : n));
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('saas_tenant_config');
      setSession(null);
    } catch (err) {
      console.error('Logout error:', err);
      // Even if signOut fails, clear local state
      localStorage.removeItem('saas_tenant_config');
      setSession(null);
    }
  };

  if (!session) {
    return <Auth />;
  }

  if (tenantLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', background: '#f8fafc' }}>
        <Loader className="animate-spin" size={40} color="var(--primary)" />
        <p style={{ fontWeight: '800', color: '#1e40af', fontSize: '1rem' }}>Sincronizando identidad...</p>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingWizard 
        session={session} 
        initialStep={wizardStep} 
        stores={stores}
        areas={areas}
        refreshData={refreshData}
        onComplete={() => { setShowOnboarding(false); setWizardStep(0); }} 
      />
    );
  }

  return (
    <div className="admin-layout">
      {/* Sidebar Mobile Overlay */}
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '0 0.5rem', marginBottom: '2rem' }}>
          <img src={tenant.logoUrl} alt={tenant.name} style={{ maxWidth: '130px', objectFit: 'contain' }} />
        </div>
        <nav style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ul className="nav-links">
            <li>
              <button className={`nav-item ${activeTab === 'dash' ? 'active' : ''}`} onClick={() => { navigate('/'); setIsSidebarOpen(false); }}>
                <LayoutDashboard size={18} /> {t('menu.dashboard')}
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'org' ? 'active' : ''}`} onClick={() => { navigate('/ajustes'); setIsSidebarOpen(false); }}>
                <Building size={18} /> {t('menu.settings')}
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'issues' ? 'active' : ''}`} onClick={() => { navigate('/issues'); setIsSidebarOpen(false); }}>
                <AlertTriangle size={18} /> {t('menu.issues')}
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'qr' ? 'active' : ''}`} onClick={() => { navigate('/qr'); setIsSidebarOpen(false); }}>
                <QrCode size={18} /> {t('menu.qr')}
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => { navigate('/leaderboard'); setIsSidebarOpen(false); }}>
                <Trophy size={18} /> {t('menu.leaderboard')}
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { navigate('/estructura'); setIsSidebarOpen(false); }}>
                <Users size={18} /> {t('menu.structure')}
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'email' ? 'active' : ''}`} onClick={() => { navigate('/marketing'); setIsSidebarOpen(false); }}>
                <Mail size={18} /> {t('menu.marketing')}
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'questions' ? 'active' : ''}`} onClick={() => { navigate('/preguntas'); setIsSidebarOpen(false); }}>
                <MessageSquare size={18} /> {t('menu.questions')}
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'kpi' ? 'active' : ''}`} onClick={() => { navigate('/metas'); setIsSidebarOpen(false); }}>
                <Target size={18} /> {t('menu.kpi')}
              </button>
            </li>
            <li style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
              <button className={`nav-item ${activeTab === 'backup' ? 'active' : ''}`} onClick={() => { navigate('/respaldos'); setIsSidebarOpen(false); }}>
                <RotateCcw size={18} /> {t('menu.backup')}
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => { navigate('/auditoria'); setIsSidebarOpen(false); }}>
                <ShieldCheck size={18} /> {t('menu.audit')}
              </button>
            </li>
            
            <li style={{ marginTop: '1rem' }}>
              <div style={{ padding: '1rem', background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)', borderRadius: '16px', border: '1px solid #dbeafe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#1e40af' }}>
                  <HelpCircle size={16} />
                  <span style={{ fontSize: '0.75rem', fontWeight: '800' }}>{t('menu.help')}</span>
                </div>
                <p style={{ fontSize: '0.65rem', color: '#60a5fa', lineHeight: '1.4', marginBottom: '8px' }}>
                  {t('menu.help_desc')}
                </p>
                <button className="btn btn-sm btn-primary" style={{ width: '100%', fontSize: '0.65rem' }}>
                  {t('menu.contact_support')}
                </button>
              </div>
            </li>
          </ul>
        </nav>

        <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', flexShrink: 0, marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {session?.user?.email?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700' }}>{session?.user?.user_metadata?.nombre || t('menu.admin')}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{session?.user?.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#ef4444', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
          >
            <LogOut size={16} /> {t('menu.logout')}
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              className="mobile-toggle"
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>
            <h2 className="view-title">
              {activeTab === 'dash' ? t('menu.dashboard') :
                activeTab === 'issues' ? t('menu.issues') :
                  activeTab === 'email' ? t('menu.marketing') :
                    activeTab === 'backup' ? t('menu.backup') :
                      activeTab === 'kpi' ? t('menu.kpi') :
                        activeTab === 'qr' ? t('menu.qr') :
                        activeTab === 'org' ? t('menu.settings') :
                        activeTab === 'leaderboard' ? t('menu.leaderboard') :
                        activeTab === 'users' ? t('menu.structure') :
                        activeTab === 'questions' ? t('menu.questions') :
                        activeTab === 'audit' ? t('menu.audit') : t('menu.structure')}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Global Filter Bar */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#f8fafc', padding: '4px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              {/* Language Selector */}
              <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '2px', borderRadius: '8px', marginRight: '8px' }}>
                <button
                  onClick={() => i18n.changeLanguage('es')}
                  style={{
                    padding: '4px 8px', fontSize: '0.65rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: i18n.language.startsWith('es') ? 'white' : 'transparent',
                    fontWeight: i18n.language.startsWith('es') ? '700' : '500',
                    boxShadow: i18n.language.startsWith('es') ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                  }}
                  title={t('common.spanish')}
                >
                  ES
                </button>
                <button
                  onClick={() => i18n.changeLanguage('en')}
                  style={{
                    padding: '4px 8px', fontSize: '0.65rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: i18n.language.startsWith('en') ? 'white' : 'transparent',
                    fontWeight: i18n.language.startsWith('en') ? '700' : '500',
                    boxShadow: i18n.language.startsWith('en') ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                  }}
                  title={t('common.english')}
                >
                  EN
                </button>
                <button
                  onClick={() => i18n.changeLanguage('pt')}
                  style={{
                    padding: '4px 8px', fontSize: '0.65rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: i18n.language.startsWith('pt') ? 'white' : 'transparent',
                    fontWeight: i18n.language.startsWith('pt') ? '700' : '500',
                    boxShadow: i18n.language.startsWith('pt') ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                  }}
                  title={t('common.portuguese')}
                >
                  PT
                </button>
              </div>
              
              <Filter size={16} color="var(--primary)" />
              <select className="filter-select-mini" value={filters.dateRange} onChange={e => setFilters({ ...filters, dateRange: e.target.value })}>
                <option value="last7days">{t('common.last_7_days')}</option>
                <option value="last30days">{t('common.last_30_days')}</option>
                <option value="all">{t('common.all_time')}</option>
              </select>
              <select className="filter-select-mini" value={filters.store} onChange={e => handleStoreChange(e.target.value)}>
                <option value="Todas">{t('common.all_stores')}</option>
                {[...new Set(dateFilteredData.map(f => f.tienda_id).filter(Boolean))].map(s => <option key={s} value={s}>{getStoreName(s)}</option>)}
              </select>
              <select className="filter-select-mini" value={filters.area} onChange={e => setFilters({ ...filters, area: e.target.value })}>
                <option value="Todas">{t('common.all_areas')}</option>
                {[...new Set(storeFilteredData.map(f => f.area_id).filter(Boolean))].map(a => <option key={a} value={a}>{getAreaName(a)}</option>)}
              </select>
              <select className="filter-select-mini" value={filters.sentiment} onChange={e => setFilters({ ...filters, sentiment: e.target.value })}>
                <option value="Todos">{t('common.sentiment')}: {t('common.all')}</option>
                <option value="Positivo">{t('common.positive')} 🟢</option>
                <option value="Neutral">{t('common.neutral')} 🟡</option>
                <option value="Negativo">{t('common.negative')} 🔴</option>
              </select>
              <select className="filter-select-mini" value={filters.canal} onChange={e => setFilters({ ...filters, canal: e.target.value })}>
                <option value="Todos">{t('common.origin')}: {t('common.all')}</option>
                <option value="QR">QR Code 📱</option>
                <option value="Email">Email Marketing 📧</option>
              </select>
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleMasterBypass}
                style={{
                  color: masterMode ? '#10b981' : '#ef4444',
                  background: 'transparent',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 9999
                }}
                title={masterMode ? t('admin.master_mode_active_tooltip') : t('admin.master_mode_inactive_tooltip')}
              >
                <Fingerprint size={24} />
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="header-icon-btn"
                >
                  <Bell size={20} />
                  {notifications.filter(n => !n.leida).length > 0 && (
                    <span className="notification-badge">
                      {notifications.filter(n => !n.leida).length}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div className="dropdown-overlay" onClick={() => setShowNotifications(false)}></div>
                    <div className="notifications-dropdown">
                      <div className="dropdown-header">
                        <span>{t('menu.notifications')}</span>
                        <span className="badge">{t('menu.recent')}</span>
                      </div>
                      <div className="dropdown-body">
                        {notifications.length === 0 ? (
                          <div className="empty-state">
                            <Bell size={32} />
                            <p>{t('menu.no_notifications')}</p>
                          </div>
                        ) : (
                          notifications.map(n => (
                            <div
                              key={n.id}
                              onClick={() => { markAsRead(n.id); setShowNotifications(false); }}
                              className={`notification-item ${n.leida ? 'read' : 'unread'}`}
                            >
                              <div className="notification-icon">
                                {n.tipo === 'Alerta' ? <AlertTriangle size={18} /> : <AlertCircle size={18} />}
                              </div>
                              <div className="notification-content">
                                <div className="notif-title">{n.titulo}</div>
                                <div className="notif-msg">{n.mensaje}</div>
                                <div className="notif-time">{new Date(n.created_at).toLocaleTimeString('es-MX')}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="main-content">
          <OnboardingTour />
          {fetchError && activeTab !== 'dash' && (
            <div className="card animate-shake" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #ef4444', background: '#fef2f2', padding: '1rem' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <AlertCircle color="#ef4444" size={20} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: '#991b1b', fontSize: '0.9rem', fontWeight: '800', marginBottom: '4px' }}>
                    {t('common.database_error', 'Error de Estructura de Datos')}
                  </h4>
                  <p style={{ color: '#b91c1c', fontSize: '0.75rem', fontWeight: '500' }}>
                    {fetchError.includes('tenant_id') 
                      ? 'Faltan columnas de multi-tenant en la base de datos. Por favor ejecuta el script de migración SQL.' 
                      : fetchError}
                  </p>
                </div>
                <button onClick={refreshData} className="btn btn-sm btn-primary" style={{ height: '32px' }}>
                  {t('common.retry', 'Reintentar')}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'org' && <OrganizationSettings />}
          {activeTab === 'dash' && (
            <Dashboard
              rawData={isDemoMode ? getSampleData(i18n.language).rawData : rawData}
              stores={isDemoMode ? getSampleData(i18n.language).stores : stores}
              areas={isDemoMode ? getSampleData(i18n.language).areas : areas}
              filters={filters}
              setFilters={setFilters}
              loading={loading}
              fetchError={fetchError}
              refreshData={refreshData}
              isDemoMode={isDemoMode}
              setIsDemoMode={setIsDemoMode}
              onStepLaunch={handleLaunchWizard}
            />
          )}

          {activeTab === 'leaderboard' && (
            <Leaderboard
              rawData={rawData}
              stores={stores}
              areas={areas}
              filters={filters}
              loading={loading}
            />
          )}
          {activeTab === 'issues' && (
            <IssueManagement
              issues={issues}
              feedback={feedback}
              onIssueUpdate={fetchIssues}
            />
          )}
          {activeTab === 'qr' && <QRGenerator />}
          {activeTab === 'users' && <UserManagement session={session} />}
          {activeTab === 'email' && <EmailTemplateManager />}
          {activeTab === 'backup' && <BackupManager />}
          {activeTab === 'kpi' && <KpiManager />}
          {activeTab === 'questions' && <QuestionManager />}
          {activeTab === 'audit' && <AuditTrail />}
        </main>
      </div >
    </div >
  );
}

export default function App() {
  const { tenant, loading: tenantLoading } = useTenant();
  
  return (
    <Routes>
      <Route path="/feedback" element={<Feedback />} />
      <Route path="/*" element={<AdminPanel tenant={tenant} tenantLoading={tenantLoading} />} />
    </Routes>
  );
}
