# Contexto del Proyecto — saas-admin
> **Última actualización:** 2026-03-27

## ¿Qué es esto?

SaaS de recolección de feedback para negocios (restaurantes, hoteles, clínicas, talleres, etc.). Los clientes escanean un QR, dan retroalimentación, y el dueño del negocio ve dashboards con NPS, sentimiento, y alertas. Multi-tenant: cada cliente tiene sus propios datos aislados por RLS en Supabase.

**Stack:** React 19 + Vite · Supabase (auth + PostgreSQL + RLS + Edge Functions) · React Router v7 · i18next (ES/EN/PT) · Recharts · Stripe · Netlify (deploy)

---

## Estructura clave y Nuevos Módulos

```
src/
  App.jsx                  # Raíz, rutas, AdminPanel con todo el estado
  hooks/useTenant.js       # Hook central: resuelve tenant_id del usuario logueado
  components/
    Feedback.jsx           # Formulario público de feedback (Universal Hub en /feedback)
    admin/
      OnboardingWizard.jsx # Wizard Apple-style (6 pasos, IA, Confetti, ES/EN/PT)
      SetupChecklist.jsx   # Checklist de configuración inicial (4 pasos)
      QRStudio.jsx         # Gestión de sucursales, áreas y códigos QR
      GeoMap.jsx           # Mapa con pines auto-geocodificados
      OrganizationSettings.jsx  # Reset/borrado de datos del tenant (3-column UI)
      RetelioDashboard.jsx # Dashboard principal NPS + métricas
      RecoverySettings.jsx # Pipeline de recuperación y composición de WhatsApp
      CouponManagement.jsx # Sistema de cupones para clientes insatisfechos
      DistributorPortal.jsx # Portal de Distribuidores y Afiliados (One-pager PDF)
      DevValuationPanel.jsx # Valoración algorítmica COCOMO I & II con API de GitHub
  services/
    userService.js · storeService.js · areaService.js · configService.js · kpiService.js
  config/planLimits.js     # Límites por tier: Starter/Growth/Pro/Enterprise
supabase/
  functions/improve-question/index.ts  # Edge Function: mejora preguntas con Claude Haiku
scripts/
  import-sepomex.mjs       # Script one-time: importó 31,887 CPs a Supabase
```

---

## Arquitectura multi-tenant y Autenticación

- Cada usuario está en la tabla `Usuarios` con un `tenant_id` (UUID).
- UUID cero (`00000000-...`) activa el `OnboardingWizard`, que limpia datos basura previos y crea un nuevo tenant.
- **Toda query a Supabase debe incluir `.eq('tenant_id', tid)`** — RLS lo enforza en la DB.
- El reset en OrganizationSettings **borra el tenant row** y desvincula `Usuarios.tenant_id`.
- Se implementó i18n global (ES, EN, PT).

---

## Modelos de Datos (Location vs Tiendas) y Auto-Geocoding

Históricamente coexisten dos tablas: `Tiendas_Catalogo` (legacy) y `locations` (nueva).
- **Auto-Geocoding:** Al abrir `GeoMap.jsx`, se buscan las sucursales de `Tiendas_Catalogo` sin coordenadas, se geocodifican mediante `Nominatim (OSM)` combinando Nombre + Dirección + México. Las coordenadas se actualizan automáticamente en DB para que la próxima carga sea instantánea.
- **Creación en QRStudio/Wizard:** Al crear nuevas sucursales, las coordenadas se calculan desde el Código Postal (lookup local a `codigos_postales`) y se guardan directamente en `Tiendas_Catalogo` y `locations`.
- **No mezclar IDs** — `locations.id` y `Tiendas_Catalogo.id` son UUIDs diferentes. Feedback usa `tienda_id`.

---

## Módulos Core Recientes

### 1. Sistema de Distribuidores & Afiliados
- Módulo de partners que permite aplicar (`/quiero-ser-distribuidor`).
- Dashboard dedicado para Distribuidores con generación de un folleto PDF (One-pager) que incluye su código QR de afiliado único.

### 2. Recuperación de Clientes y Cupones (Recovery Pipeline)
- Pipeline visual con 4 estados (Nuevo, En Proceso, Recuperado, Expirado).
- Modal de composición de WhatsApp integrado que permite previsualizar el teléfono, elegir el "tono" del mensaje, configurar quién envía (Nombre y Rol del empleado) e inyectar **Códigos de Cupón únicos**.

### 3. Feedback Universal Hub
- Toda la recolección corre bajo la ruta `/feedback`.
- La URL de feedback por defecto punta internamente, generando un fallback resiliente para QR escaneados.

### 4. Dev Valuation Panel (COCOMO)
- Módulo interno para medir la valuación del portafolio del código, consumiendo la API de GitHub en tiempo real basada en modelos de ingeniería de software (COCOMO).

---

## Flujo del OnboardingWizard (6 pasos Apple-Style)

```
Paso 0: Identidad — Nombre del negocio, Tipo de negocio, Logo
Paso 1: Sucursal — CP (lookup en Supabase de 31k registros), Calle
Paso 2: Área del negocio — Presets según Tipo de Negocio
Paso 3: Pregunta — Botón ✨ para IA Claude Haiku (fallback local si falla)
Paso 4: Contacto — Ticket Promedio y Nombre/Rol del Sender (WhatsApp)
Paso 5: Activación de Plan Confetti
```
Al guardar el paso 1, **se realiza un Wipe completo de los datos** (resuelve bloqueos de RLS).

---

## Comandos útiles

```bash
npm run dev          # Dev server con HMR
npm run build        # Build de producción → dist/
npm run lint         # ESLint

# Supabase Edge Functions
supabase functions deploy improve-question
supabase secrets set ANTHROPIC_API_KEY=...
```

---

## Gotchas importantes

1. **`Feedback`** (mayúscula) es el nombre real de la tabla, y su campo central relacionado con sucursales es `tienda_id` (NO `location_id`). Su métrica es `satisfaccion` o `score`.
2. **PostgREST schema cache** — después de alterar tablas: `NOTIFY pgrst, 'reload schema';`
3. **setState async** — nunca leas estado inmediatamente después de `setState` en los Wizards. Crea una variable let local antes de guardar en DB.
4. **CP Lookup local** — Si Nominatim falla en geocodificar, el wizard no se bloquea, permite seguir el flujo y el mapa luego intentará auto-geocodificar en base al nombre.
