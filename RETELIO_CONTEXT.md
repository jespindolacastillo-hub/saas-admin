# Retelio — Contexto Estratégico Completo
> Este archivo es la fuente de verdad para Claude Code al trabajar en el proyecto Antigravity/Retelio.
> Léelo completo antes de cualquier tarea.

---

## 1. Producto

**Nombre:** Retelio  
**URL:** retelio.com.mx  
**Tagline:** "Lo bueno se amplifica. Lo malo se resuelve."  
**Categoría:** Customer Growth Engine para negocios físicos  
**Diferenciador:** Es el único que combina (1) generación de reseñas Google con filtro de sentimiento + (2) recovery automático de clientes insatisfechos + (3) inteligencia de desempeño por empleado — todo vía QR, sin hardware, sin app.

---

## 2. Flujo Core

```
Cliente entra al negocio
    → escanea QR (en mesa, mostrador, recibo, espejo)
    → pantalla de feedback: 1-5 estrellas (sin app, sin login, 3 segundos)
    → Motor de sentimiento:
        ≥ 4★ (happy)   → redirect a Google Reviews + oferta de incentivo
        ≤ 2★ (unhappy) → WhatsApp alert al manager (<60s) + oferta de recovery
        3★ (neutral)   → gracias + campo de comentario opcional
```

**Regla crítica:** Los clientes insatisfechos (≤2★) NUNCA son redirigidos a Google.

---

## 3. Tipos de QR

Cada QR es una URL única que identifica:
- `area` — caja, cocina, sala de espera, estacionamiento
- `shift` — turno mañana, tarde, noche
- `employee` — QR personal de cada empleado
- `product` — servicio o producto específico
- `event` — evento o fecha especial
- `channel` — canal de adquisición

Tabla sugerida en Supabase:
```sql
qr_codes (
  id, tenant_id, location_id, type, label,
  employee_id (nullable), created_at, active
)
```

---

## 4. Planes y Pricing

| Plan       | Precio/mes | Sucursales | Reseñas Google/mes | Employee QRs | Features clave |
|------------|-----------|------------|-------------------|--------------|----------------|
| Free       | $0        | 1          | hasta 15          | 0            | QR + redirect + 1 recovery alert |
| Growth     | $79 USD   | 1          | hasta 150         | hasta 10     | WhatsApp alerts + recovery auto + revenue dashboard |
| Scale      | $149 USD  | hasta 5    | hasta 500 total   | hasta 20     | Multi-suc dashboard comparativo |
| People     | $349 USD  | hasta 15   | ilimitadas        | ilimitados   | Compensación variable + leaderboard + top performer analysis |
| Enterprise | por suc.  | ilimitadas | ilimitadas        | ilimitados   | POS/CRM + white-label + account manager + SLA 99.9% |

**Precios Enterprise por sucursal:**
- 16–30 suc: $39/suc/mes
- 31–60 suc: $29/suc/mes  
- 61+ suc: $19/suc/mes

**Regla de pricing:** Precio fijo por EMPRESA, no por sucursal. El plan incluye N sucursales.

**Límite del Free:** Por RESEÑAS GENERADAS (no feedbacks). Más transparente y mejor trigger de upgrade.

---

## 5. Upgrade Triggers (por orden de efectividad)

1. **Banner al 80% del límite de reseñas** — "Llevas 12 de 15 reseñas este mes"
2. **Recovery agotado** — "Ya usaste tu 1 alerta del mes. Con Growth tienes ilimitadas"
3. **Revenue impact card bloqueada** — La tarjeta de impacto estimado está borrosa/locked en Free
4. **Notificación al cruzar umbral de sucursales**

---

## 6. People Intelligence (diferenciador clave — plan People+)

- Cada empleado tiene su QR único → URL trackeada a su perfil
- Las calificaciones de clientes construyen su **perfil real de desempeño**
- No es lo que el manager cree — es lo que el cliente experimenta
- **Módulo de compensación variable:** liga el rating promedio mensual a cálculo de bono
- **Leaderboard del equipo:** ranking visible, gamificación del servicio
- **Análisis de patrones:** identifica comportamientos de top performers para replicar
- **Buyer persona para este módulo:** HR Director / Operations Director (no el dueño del restaurante)

---

## 7. Verticales Objetivo

1. 🍽️ Restaurantes & Bares
2. ✂️ Salones & Barberías
3. 🏥 Clínicas & Consultorios
4. 🔧 Talleres & Mecánicas
5. 🏋️ Gimnasios & Fitness
6. 💊 Farmacias & Ópticas

---

## 8. Competencia (precios reales verificados 2025)

| Competidor | Precio | Tiene QR presencial | Tiene filtro sentimiento | Tiene recovery real | Contrato |
|-----------|--------|--------------------|-----------------------|-------------------|---------|
| Birdeye | $299–449/loc/mes | ✗ | ✗ | ✗ | Anual obligatorio |
| HappyOrNot | $100–200/kiosko/mes + hardware | ✗ | ✗ | ✗ | Anual |
| NiceJob | $75–125/mes | ✗ | ✗ | ✗ | No |
| Podium | $399/mes | ✗ | ✗ | parcial | Anual |
| QR casero | $0 | ✓ | ✗ | ✗ | — |
| **Retelio Growth** | **$79/mes** | **✓** | **✓** | **✓** | **No** |

**Ahorro vs Birdeye con 5 sucursales:** $299×5 = $1,495/mes vs Retelio Scale $149 → **$16,152/año menos**

---

## 9. Mercado y Objetivos

- **TAM LATAM:** ~10.9M ubicaciones físicas
- **ICP primario:** negocio de 1–3 locales, $50k–500k MXN revenue/año
- **Geo secuencia:** CDMX + GDL + MTY → Colombia → Brasil → Argentina
- **Meta MRR:** $500k MXN/mes = **285 clientes pagados** (ARPU blended $1,752 MXN)
- **Conversión free→paid objetivo:** 12–15%
- **Churn mensual máximo tolerable:** 3.5%
- **NRR objetivo:** >110%

---

## 10. Stack Técnico

- **Frontend:** Vite + React (saas-admin)
- **Backend/DB:** Supabase
- **Deploy:** Netlify
- **Patrón:** Multi-tenant con `useTenant` hook
- **i18n:** Implementado (ES default, EN, PT)
- **Theming:** Implementado por tenant

---

## 11. Lo Que Necesita Construirse (por prioridad)

### Prioridad 1 — Flujo MVP (sin esto no hay producto)
- [ ] Tabla `qr_codes` en Supabase con tipos
- [ ] Pantalla pública de feedback (sin auth) — `/f/:qr_id`
- [ ] Motor de sentimiento y routing (happy/unhappy/neutral)
- [ ] Redirect a Google Reviews (URL del negocio configurable)
- [ ] WhatsApp alert al manager (Twilio o WhatsApp Business API)
- [ ] Oferta de recovery automática al cliente

### Prioridad 2 — Dashboard básico
- [ ] Métricas: feedbacks recibidos, reseñas generadas, recovery rate
- [ ] Revenue impact estimado (fórmula: reseñas × 2.8 × ticket × ticket)
- [ ] Vista por área / por turno
- [ ] Historial de feedbacks

### Prioridad 3 — Sistema de planes
- [ ] Tabla `plan_limits` en Supabase
- [ ] Lógica de límites por plan (reseñas, sucursales, employee QRs)
- [ ] Upgrade triggers y banners
- [ ] Revenue impact card bloqueada en Free

### Prioridad 4 — People Intelligence
- [ ] QR por empleado con perfil trackeado
- [ ] Tabla `employee_ratings` en Supabase
- [ ] Dashboard de desempeño por empleado
- [ ] Leaderboard del equipo
- [ ] Módulo de compensación variable (cálculo de bono)

### Prioridad 5 — Multi-sucursal (Scale+)
- [ ] Dashboard comparativo entre sucursales
- [ ] Métricas por ubicación
- [ ] QRs por área dentro de cada sucursal

---

## 12. Fórmulas del ROI Calculator

```javascript
// Inputs: ticket (USD), visits (por suc/mes), scanPct (%), emps, suc

const totalVisits   = visits * suc
const scans         = totalVisits * scanPct
const happy         = scans * 0.72        // 72% da ≥4★
const unhappy       = scans * 0.20        // 20% da ≤2★
const reviewsGen    = happy * 0.45        // 45% de happy llega a Google
const revFromReviews = reviewsGen * 2.8 * ticket  // 2.8 nuevos clientes por reseña (BrightLocal)
const recovered     = unhappy * 0.62      // 62% de unhappy se recupera
const revFromRecovery = recovered * ticket * 2.5  // 2.5× valor revisita
const empBoost      = emps * Math.min(visits/emps, 120) * ticket * 0.027

// Loss (sin Retelio):
const loss = (unhappy - recovered) * ticket * 1.8 + (happy - reviewsGen) * ticket * 0.5
```

---

## 13. Esquema Supabase Sugerido

```sql
-- Tenants (negocios)
tenants (id, name, slug, plan, google_review_url, whatsapp_number, created_at)

-- Sucursales
locations (id, tenant_id, name, address, active)

-- QR codes
qr_codes (id, tenant_id, location_id, employee_id, type, label, scan_count, active, created_at)

-- Feedbacks
feedbacks (id, qr_id, tenant_id, location_id, employee_id, score, comment, 
           routed_to_google, recovery_sent, created_at, ip_hash)

-- Empleados
employees (id, tenant_id, location_id, name, role, avg_rating, total_ratings)

-- Planes
plan_limits (plan_name, max_locations, max_reviews_per_month, max_employee_qrs, 
             has_whatsapp, has_revenue_dashboard, has_people_intelligence, price_usd)
```

---

## 14. Decisiones de Diseño Ya Tomadas

- **Colores:** coral `#FF5C3A`, teal `#00C9A7`, purple `#7C3AED`, ink `#0D0D12`
- **Fuente:** Plus Jakarta Sans 400/500/600/700/800
- **Logo:** 4×4 dot matrix coral+teal, wordmark "retelio"
- **Idioma default:** Español
- **Landing page:** Existe como HTML estático (`retelio-landing.html`) — pendiente integrar al app

