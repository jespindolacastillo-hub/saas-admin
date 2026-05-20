# Next Session — saas-admin

## Estado del repo
- Rama: `main` (auto-deploy a Netlify)
- Último commit: `3299ee0` — feat: scope Issues view to assigned locations for Gerente role
- Fecha: 2026-05-19

---

## ✅ Resuelto en sesión 2026-05-19
- `recovery_sent` boolean error (objeto JSON pasado como boolean) — `FeedbackPublic.jsx`
- Teléfono del cliente siempre llegaba como `5550733331` en alertas WhatsApp (stale state) — `FeedbackPublic.jsx` + deploy Edge Function
- `stripe-checkout` redirigía a dominio muerto `ianps.netlify.app` → corregido a `admin.retelio.app`
- `alert()` nativo reemplazado por banner de error inline en formulario público
- CORS `*` restringido a orígenes conocidos en las 9 Edge Functions (`_shared/cors.ts`)
- Scoping de sucursales para Gerente implementado (useTenant + IssueManagement + UserManagement)

---

## 🚨 AUDITORÍA — Fixes críticos (pendiente 2026-05-15)

Auditoría completa realizada por agente. Prioridad ordenada:

### A. CRÍTICO — negocio roto HOY
1. ~~**`stripe-checkout` redirige a `ianps.netlify.app`**~~ ✅ Resuelto 2026-05-19
2. ~~**Bug: teléfono del cliente nunca llega en alertas WhatsApp**~~ ✅ Resuelto 2026-05-19

### B. CRÍTICO — seguridad
3. **Contraseña `'1972'` hardcodeada en bundle JS público**
   - Archivo: `src/App.jsx` línea ~2236
   - Fix: eliminar master mode del cliente o moverlo a verificación server-side
   - Impacto: cualquiera que abra DevTools activa módulos de distribuidores/valuación

4. **`admin-api` Edge Function sin autenticación del caller**
   - Archivo: `supabase/functions/admin-api/index.ts` líneas 71-74
   - Fix: verificar JWT del caller y que tenga rol `owner`/`admin` antes de ejecutar cualquier acción
   - Impacto: cualquiera con el endpoint puede borrar usuarios arbitrarios

5. **`twilio-webhook` no verifica firma Twilio**
   - Archivo: `supabase/functions/twilio-webhook/index.ts` línea 9
   - Fix: validar header `X-Twilio-Signature` con el auth token de Twilio
   - Impacto: cualquiera puede hacer POST y manipular estados de recovery

### C. ALTO — próximo sprint
6. **⬜ PROBAR: Scoping de sucursales para Gerente** — implementado 2026-05-19, pendiente verificación en prod
   - Ir a Equipo → editar un gerente → asignar sucursales → verificar que solo ve esas en Recuperación
7. `admin-api listUsers()` sin paginación — falla silenciosamente con 1000+ usuarios (`index.ts:81`)
8. ~~CORS `'*'` en todas las Edge Functions~~ ✅ Resuelto 2026-05-19
9. `calculateNPS` en `App.jsx` tiene dead code (primer forEach nunca afecta el resultado)
10. `QRGenerator` usa tabla legacy `Tiendas_Catalogo` en lugar de `locations`
11. `dataService.fetchFeedbacks` sin LIMIT — datasets grandes colapsan el cliente
12. ~~`alert()` nativo en FeedbackPublic.jsx~~ ✅ Resuelto 2026-05-19
13. `console.log` en producción — añadir guard `import.meta.env.DEV`
14. 35+ archivos SQL en root sin orden — mover a `supabase/migrations/` con prefijo fecha

### D. LO QUE ESTÁ BIEN — no tocar
- Flujo de pasos en FeedbackPublic (StepScore/Reason/Contact/Done)
- Lógica de buckets hot/warm/cold en IssueManagement
- `send-recovery-message` Edge Function (la más robusta)
- Design tokens `T = { coral, teal, ink... }` inline consistentes
- `planLimits.js` con estructura de pricing (PLAN_LIMITS, PRICING_ZONES, ACTIVE_DISCOUNTS)

---

## Pendientes prioritarios

### 1. Scoping de sucursales para rol Gerente ⭐ (siguiente grande)
**Modelo acordado: VER todo, ACTUAR solo en las propias**

Datos agregados (ver todo):
- Dashboard métricas, Leaderboard, Mapa, KPI general

Datos individuales (solo sus sucursales asignadas):
- Issues / feedback individual con datos de cliente
- Acciones: recovery, respuesta, cupones

**Pasos:**
1. DB: `ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS location_ids UUID[] DEFAULT '{}';`
2. UI: Multi-select de sucursales en modal de UserManagement (solo visible si rol = gerente)
3. `useTenant` hook: exponer `userLocationIds` (vacío = sin restricción)
4. Filtrar en: Issues list, feedback detail, acciones de recovery
5. Leaderboard: mostrar todas las sucursales, marcar las del gerente con indicador visual

### 2. Aviso de Privacidad (LFPDPPP Capa 2)
- Crear página en `retelio.com.mx/privacidad`
- Contenido mínimo: responsable, finalidad, derechos ARCO, contacto INAI
- URL hardcodeada en `FeedbackPublic.jsx` (buscar "privacidad")

### 3. Twilio HSM Template para campañas WhatsApp
- Las campañas WhatsApp no se entregan sin plantilla aprobada por Meta
- Crear template en Twilio Console → aprobar con Meta
- Agregar `TWILIO_CAMPAIGN_TEMPLATE_SID` a secrets de Supabase
- Wiring pendiente en `send-recovery-message` Edge Function

### 4. Migraciones SQL pendientes de ejecutar en Supabase
```sql
-- contact_email en feedbacks (PENDIENTE — no ejecutada aún)
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Normalizar roles existentes en Usuarios
UPDATE "Usuarios" SET rol = 'admin'   WHERE rol IN ('Admin', 'admin');
UPDATE "Usuarios" SET rol = 'gerente' WHERE rol IN ('Gerente', 'gerente');
UPDATE "Usuarios" SET rol = 'caja'    WHERE rol IN ('Caja', 'caja');
UPDATE "Usuarios" SET rol = 'admin'   WHERE rol = 'Usuario' OR rol IS NULL;

-- location_ids para gerente (cuando se implemente el scoping)
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS location_ids UUID[] DEFAULT '{}';
```

### 5. Contratos — Convenio de Encargo (Capa 3 LFPDPPP)
- Cláusula de encargo de datos en contrato de suscripción
- Retelio = Encargado, cliente = Responsable
- Antes del primer cliente enterprise

### 6. Signup abierto — riesgo producción
- Cualquiera puede crear cuenta en `/` sin invitación
- Evaluar: deshabilitar signup público, solo invitación via UserManagement

---

## Lo que se hizo esta sesión (2026-05-14/15 — segunda parte)

### FeedbackPublic — flujo bad review rediseñado
- **StepReason** (obligatorio, no se puede omitir): chips de categoría + textarea opcional con countdown de 3 segundos para auto-avanzar. Si el usuario empieza a escribir, el countdown se cancela y aparece botón "Enviar".
- **StepContact** rediseñado: banner azul "Queremos resolverlo hoy mismo", captura dual WhatsApp + email (ambos opcionales), checkbox marketing opt-in (NO pre-marcado, LFPDPPP), escape "No, solo quería dejar mi opinión".
- **DoneBad**: copy adaptivo según canal (WhatsApp vs email vs sin contacto).
- **submitFeedback**: guarda `contact_email`, `marketing_consent`, `consent_at`, `consent_version` en feedbacks.

### Recovery / IssueManagement — bug fix multi-causa
Síntoma: feedback con score 1/5 visible en Dashboard pero no en Recuperación.

Causas encontradas y corregidas:
1. `is_test === true` estricto → cambiado a `!!is_test` en IssueManagement y RetelioDashboard.
2. Dos instancias de `useTenant()` podían divergir → `IssueManagement` ahora acepta prop `tenantOverride`; App.jsx lo pasa.
3. Sin auto-refresh → agregado interval de 2 min en IssueManagement.
4. `dataService.fetchFeedbacks` filtraba por `is_test` → agregada opción `{ ignoreTestFilter: true }`; IssueManagement la usa para ver todos los feedbacks del tenant.
5. **Root cause final**: feedbacks sin `contact_phone` caían en cubo `noPhone` que solo mostraba un contador de texto — nunca aparecían como tarjetas. Corregido: los buckets ACTUAR AHORA / HOY / TARDE ahora usan `hotAll`/`warmAll`/`expiredAll` (todos los bad reviews pendientes, con o sin teléfono). Los sin teléfono aparecen como tarjetas pero sin botón WhatsApp.

### Lección arquitectónica confirmada
- Sin contacto = el cliente no quiere diálogo; sigue siendo dato válido para operaciones (qué mejorar).
- Dashboard muestra TODO. Recovery solo los que dejaron contacto. Arquitectura correcta.

---

### Widget WhatsApp flotante — retelio.com.mx
- Archivo `wa-widget.js` creado y subido a SiteGround vía FTP
- Script tag inyectado en: index.html (landing), index.php, distribuidores.html, aplicar.html, gracias.html, 5 páginas PHP, y los 84 artículos del blog
- Número obfuscado en JS (no visible en HTML source) — anti-scraping de bots
- Modal de intención antes de revelar el link: 3 opciones (cliente / distribuidor / otra pregunta)
- Al elegir, abre wa.me con mensaje pre-llenado según intención
- Botón verde fijo bottom-right, pulse animation, 100% responsive móvil/desktop
- Para agregar a páginas nuevas: copiar `<script src="/wa-widget.js"></script>` antes de `</body>`

---

## Lo que se hizo sesión anterior (2026-05-14 — primera parte)

- **Campaigns**: fix tabla locations, filtro only_unredeemed, Resend email, canal único recovery (WhatsApp), supresión 30 días, fix "0 enviados", templates amigables.
- **FeedbackPublic**: email+phone capture en DoneHappy, gamification cupón (shimmer + confetti + flip 3D), botón Google dentro del card, copy con nombre del negocio.
- **LFPDPPP Capa 1**: checkbox marketing opt-in (no pre-marcado), Aviso de Privacidad link, campos consent guardados en DB.
- **RetelioDashboard**: tooltips custom `InfoTooltip` component.
- **Roles**: arquitectura 4 roles (owner/admin/gerente/caja), lookup case-insensitive, caja asignable desde UI.

---

## Columnas DB — estado actual

```sql
-- YA EJECUTADAS en Supabase:
ALTER TABLE feedbacks ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE feedbacks ADD COLUMN consent_at TIMESTAMPTZ;
ALTER TABLE feedbacks ADD COLUMN consent_version TEXT;

-- PENDIENTE (no ejecutada):
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- PENDIENTE (para scoping de gerente):
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS location_ids UUID[] DEFAULT '{}';
```

## Archivos clave
- `src/components/FeedbackPublic.jsx` — flujo QR público (bad/good review)
- `src/components/admin/IssueManagement.jsx` — Recovery operations
- `src/components/admin/RetelioDashboard.jsx` — Dashboard principal
- `src/services/dataService.js` — queries centralizadas (feedbacks + locations)
- `src/App.jsx` — routing + tenant context + tenantOverride a IssueManagement
- `src/hooks/useTenant.js` — hook de tenant/auth
