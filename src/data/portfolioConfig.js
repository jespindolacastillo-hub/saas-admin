/**
 * portfolioConfig.js
 * Configuración de todos los proyectos del portfolio del founder.
 * SLOC y archivos se actualizan ejecutando: bash scripts/update-portfolio-stats.sh
 * GitHub API trae commits, fechas y actividad en tiempo real.
 *
 * Última actualización de SLOC: 2026-03-27
 */

export const PORTFOLIO = [
  // ── Retelio SaaS ────────────────────────────────────────────────────────────
  {
    id:       'saas-admin',
    name:     'Retelio Admin',
    desc:     'Backoffice multi-tenant: feedback, NPS, QR, distribuidores, reportes',
    repo:     'saas-admin',
    category: 'Retelio SaaS',
    color:    '#FF5C3A',
    icon:     '🏢',
    sloc:     19864,
    files:    43,
    components: 28,
    tech:     'React 19 · Vite · Supabase · Recharts · Stripe',
  },
  {
    id:       'retelio-backoffice',
    name:     'Retelio Backoffice v1',
    desc:     'Versión anterior del backoffice — base del sistema actual',
    repo:     'retelio-backoffice',
    category: 'Retelio SaaS',
    color:    '#FF5C3A',
    icon:     '📦',
    sloc:     2032,
    files:    12,
    components: 8,
    tech:     'React · Supabase',
  },
  {
    id:       'saas-feedback',
    name:     'Feedback App',
    desc:     'App pública de recolección de feedback y NPS via QR',
    repo:     'saas-feedback',
    category: 'Retelio SaaS',
    color:    '#00C9A7',
    icon:     '📲',
    sloc:     706,
    files:    8,
    components: 0,
    tech:     'HTML · CSS · Supabase JS CDN',
  },
  {
    id:       'retelio-landing',
    name:     'Landing Retelio',
    desc:     'Sitio público retelio.com.mx — landing, distribuidores, aplicar, blog',
    repo:     null, // no git repo, archivos estáticos en FTP
    category: 'Retelio SaaS',
    color:    '#00C9A7',
    icon:     '🌐',
    sloc:     6712,
    files:    22,
    components: 0,
    tech:     'HTML · CSS · JS · Apache',
  },

  // ── Price Shoes (Prototipo cliente) ──────────────────────────────────────────
  {
    id:       'price-shoes-admon',
    name:     'Price Shoes Admin',
    desc:     'Panel administrativo de feedback para cadena Price Shoes',
    repo:     'price-shoes-admon',
    category: 'Price Shoes',
    color:    '#7C3AED',
    icon:     '👟',
    sloc:     7925,
    files:    18,
    components: 11,
    tech:     'React · Supabase · Recharts',
  },
  {
    id:       'price-shoes-feedback',
    name:     'Price Shoes Feedback',
    desc:     'App de feedback público para tiendas Price Shoes',
    repo:     'price-shoes-feedback',
    category: 'Price Shoes',
    color:    '#7C3AED',
    icon:     '⭐',
    sloc:     888,
    files:    6,
    components: 0,
    tech:     'HTML · CSS · Supabase JS CDN',
  },

  // ── Otros proyectos ──────────────────────────────────────────────────────────
  {
    id:       'assesment-app',
    name:     'Assessment App',
    desc:     'Aplicación de evaluaciones y assessments',
    repo:     'Assesment-APP',
    category: 'Otros',
    color:    '#3B82F6',
    icon:     '📋',
    sloc:     1200,
    files:    8,
    components: 4,
    tech:     'React',
  },
  {
    id:       'copilot-ia',
    name:     'Copilot IA Price Shoes',
    desc:     'Asistente IA para equipo de ventas Price Shoes',
    repo:     'Copilot-IA-Price-Shoes',
    category: 'Otros',
    color:    '#3B82F6',
    icon:     '🤖',
    sloc:     800,
    files:    6,
    components: 3,
    tech:     'React · OpenAI API',
  },
  {
    id:       'publitas',
    name:     'Publitas Template Designer',
    desc:     'Diseñador de plantillas para catálogos digitales',
    repo:     'publitas-template-designer',
    category: 'Otros',
    color:    '#F59E0B',
    icon:     '🎨',
    sloc:     600,
    files:    5,
    components: 2,
    tech:     'JavaScript · Canvas API',
  },
];

// Totales del portfolio (calculados de los valores de arriba)
export const PORTFOLIO_TOTALS = {
  totalSLOC:      PORTFOLIO.reduce((s, p) => s + p.sloc, 0),
  totalFiles:     PORTFOLIO.reduce((s, p) => s + p.files, 0),
  totalComponents:PORTFOLIO.reduce((s, p) => s + p.components, 0),
  projectCount:   PORTFOLIO.length,
  repoCount:      PORTFOLIO.filter(p => p.repo).length,
  categories:     [...new Set(PORTFOLIO.map(p => p.category))],
};
