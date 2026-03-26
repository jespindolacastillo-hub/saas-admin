# Contexto del Proyecto — saas-admin

## ¿Qué es esto?

SaaS de recolección de feedback para negocios (restaurantes, hoteles, clínicas, talleres, etc.). Los clientes escanean un QR, dan retroalimentación, y el dueño del negocio ve dashboards con NPS, sentimiento, y alertas. Multi-tenant: cada cliente tiene sus propios datos aislados por RLS en Supabase.

**Stack:** React 19 + Vite · Supabase (auth + PostgreSQL + RLS + Edge Functions) · React Router v7 · i18next (ES/EN/PT) · Recharts · Stripe · QR code generation · Netlify (deploy)

---

## Estructura clave

```
src/
  App.jsx                  # 2,600 líneas — raíz, rutas, AdminPanel con todo el estado
  hooks/useTenant.js       # Hook central: resuelve tenant_id del usuario logueado
  components/
    Feedback.jsx           # Formulario público de feedback (ruta /feedback)
    admin/
      OnboardingWizard.jsx # Wizard de 4 pasos para dar de alta el negocio
      QRStudio.jsx         # Gestión de sucursales, áreas y códigos QR
      GeoMap.jsx           # Mapa con pins de sucursales y calor de feedback
      OrganizationSettings.jsx  # Reset/borrado de datos del tenant
      RetelioDashboard.jsx # Dashboard principal NPS + métricas
  services/
    userService.js · storeService.js · areaService.js · configService.js · kpiService.js
  config/planLimits.js     # Límites por tier: Starter/Growth/Pro/Enterprise
supabase/
  functions/improve-question/index.ts  # Edge Function: mejora preguntas con Claude Haiku
scripts/
  import-sepomex.mjs       # Script one-time: importó 31,887 CPs a Supabase
  migration_codigos_postales.sql
```

---

## Arquitectura multi-tenant

- Cada usuario está en la tabla `Usuarios` con un `tenant_id` (UUID).
- `useTenant.js` lee ese UUID y lo guarda en `localStorage('saas_tenant_config')`.
- UUID cero (`00000000-...`) = usuario nuevo → se dispara el OnboardingWizard.
- **Toda query a Supabase debe incluir `.eq('tenant_id', tid)`** — RLS lo enforza en la DB.
- El reset en OrganizationSettings borra el tenant row y pone `Usuarios.tenant_id = null`.

---

## Dos modelos de datos (legacy + nuevo) — IMPORTANTE

Hay dos sistemas de tablas que coexisten:

| Concepto | Tabla legacy | Tabla nueva |
|----------|-------------|-------------|
| Sucursal | `Tiendas_Catalogo` (con `tienda_id`) | `locations` (con `location_id`) |
| Área | `Areas_Catalogo` (con `location_id` nullable) | `qr_codes` |
| Feedback | `Feedback` | `Feedback` (misma) |

- El wizard crea en **ambas** tablas simultáneamente.
- GeoMap usa `locations` (no `Tiendas_Catalogo`) para lat/lng.
- QRStudio usa `Areas_Catalogo` para mostrar áreas + `qr_codes` para los QRs.
- **No mezclar IDs** — `locations.id` y `Tiendas_Catalogo.id` son UUIDs diferentes aunque representen la misma sucursal.

---

## Tablas en Supabase

```
Usuarios            — email, tenant_id, rol, plan
tenants             — id, name, plan, trial_end
Tiendas_Catalogo    — id, tenant_id, nombre, direccion, lat, lng
Areas_Catalogo      — id, tenant_id, nombre, location_id (FK→locations)
Tienda_Areas        — junction Tiendas_Catalogo ↔ Areas_Catalogo
Area_Preguntas      — id, tenant_id, area_id, pregunta
Feedback            — id, tenant_id, tienda_id, area_id, respuesta, nps, timestamp
Issues              — id, tenant_id, descripcion, estado
Alerts              — id, tenant_id, mensaje, leida
Metas_KPI           — id, tenant_id, mes, meta_nps, meta_volumen
Config_Snapshots    — snapshots de configuración
Auditoria           — log de acciones
locations           — id, tenant_id, name, address, lat, lng (nuevo modelo)
qr_codes            — id, tenant_id, location_id, area_id, url
codigos_postales    — cp (PK), municipio, estado, colonias text[]
```

**`codigos_postales`**: 31,887 CPs de toda México. Importados desde el XML oficial de SEPOMEX. Se consulta localmente (sin API externa) para autocompletar municipio/estado/colonias en wizard y QRStudio.

---

## Flujo del OnboardingWizard (4 pasos)

```
Paso 0: Tipo de negocio (bizType) — restaurant/retail/hotel/health/auto/services/medical/edu
Paso 1: Datos de la sucursal — nombre, CP → autocompletado municipio/estado/colonias
Paso 2: Área del negocio — presets según bizType + opción "Otro" con texto libre
Paso 3: Pregunta de feedback — texto libre + botón ✨ para mejorar con IA
```

Al guardar (saveStep1):
1. **Wipe completo** de todos los datos del tenant (qr_codes → Area_Preguntas → Tienda_Areas → Areas_Catalogo → Tiendas_Catalogo → locations)
2. Crea registro en `Tiendas_Catalogo`
3. Geocodifica la dirección con Nominatim (OSM) → guarda lat/lng
4. Crea registro en `locations`
5. Crea `Areas_Catalogo` + `Tienda_Areas` + `Area_Preguntas`
6. Crea `qr_codes`

**Trampas conocidas:**
- `setState` es async en React — después de `setSavedStoreId(null)` NO leer `savedStoreId` inmediatamente. Usar variable local `let storeIdToUse = null`.
- RLS puede bloquear DELETE silenciosamente — verificar políticas si datos no se borran.

---

## Edge Function: improve-question

**Archivo:** `supabase/functions/improve-question/index.ts`
**Estado:** ✅ Desplegada en Supabase
**Secret:** `ANTHROPIC_API_KEY` configurado en Supabase

Recibe `{ question, bizType, areaName }`, llama Claude Haiku, devuelve pregunta mejorada en español correcto (máx 12 palabras, formato ¿...?).

Si falla (error de red, etc.), el frontend cae a `improveQuestion()` local (regex + patrones en `OnboardingWizard.jsx`).

---

## Lookup de CP (Código Postal)

**Antes:** API externa icalialabs (lenta, timeouts).
**Ahora:** Query directa a `codigos_postales` en Supabase.

```js
const { data } = await supabase
  .from('codigos_postales')
  .select('colonias, municipio, estado')
  .eq('cp', cp)
  .maybeSingle();
```

Usado en: `OnboardingWizard.jsx` y `QRStudio.jsx`.

---

## Variables de entorno

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_FEEDBACK_URL        # URL de la app pública de feedback
VITE_STRIPE_PUBLISHABLE_KEY
```

---

## Estado actual (marzo 2026)

### ✅ Completado recientemente
- GeoMap: corregido para consultar `locations` por `tenant_id` (no mezclaba IDs con `Tiendas_Catalogo`)
- OnboardingWizard: presets de áreas por tipo de negocio (8 tipos)
- OnboardingWizard: botón ✨ IA para mejorar pregunta (Edge Function + fallback local)
- OnboardingWizard: wipe completo antes de crear datos nuevos (elimina duplicados)
- OnboardingWizard: bug crítico `storeIdToUse` — ahora siempre `null` después del wipe
- QRStudio: lookup de CP desde Supabase (sin API externa)
- QRStudio: banner de áreas huérfanas con botón "Eliminar duplicados"
- OrganizationSettings: reset ahora BORRA el tenant y desvincula `Usuarios.tenant_id`
- `codigos_postales`: tabla con 31,887 CPs importados desde XML oficial SEPOMEX
- Edge Function `improve-question`: desplegada + API key configurada

### 🔲 Pendiente / Por hacer
- Verificar que el botón ✨ llama a Claude Haiku correctamente (recién desplegado)
- Revisar si `locations` tiene políticas RLS correctas para INSERT/DELETE desde el wizard
- Considerar unificar los dos modelos de datos (legacy + nuevo) — actualmente duplica escrituras
- Tests end-to-end del flujo wizard → QRStudio → GeoMap
- Internacionalización de los nuevos textos (presets de áreas están solo en español)

---

## Comandos útiles

```bash
npm run dev          # Dev server con HMR
npm run build        # Build de producción → dist/
npm run lint         # ESLint

# Supabase Edge Functions
supabase functions deploy improve-question
supabase secrets set ANTHROPIC_API_KEY=...

# Importar SEPOMEX (ya corrido, no repetir)
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/import-sepomex.mjs CPdescarga.xml
```

---

## Gotchas importantes

1. **No mezclar IDs** de `locations` y `Tiendas_Catalogo` — son tablas separadas con UUIDs distintos.
2. **RLS silencioso** — si un DELETE no borra nada, revisar políticas en Supabase Dashboard.
3. **PostgREST schema cache** — después de crear una tabla nueva: `NOTIFY pgrst, 'reload schema';` + `GRANT SELECT ON tabla TO anon, authenticated;`
4. **setState async** — nunca leer estado inmediatamente después de `setState`. Usar variables locales.
5. **`Feedback`** (mayúscula) es el nombre real de la tabla — no `feedbacks`.
