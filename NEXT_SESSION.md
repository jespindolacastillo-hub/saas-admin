# Next Session — saas-admin

## Estado del repo
- Rama: `main` (auto-deploy a Netlify)
- Último commit: `6960a84` — fix: add retelio.app to CORS allowlist for feedback form Edge Functions
- Fecha: 2026-05-20

---

## ✅ Resuelto en sesión 2026-05-20

- `admin-api` Edge Function sin autenticación → JWT + verificación de rol owner/admin ✅
- `twilio-webhook` sin verificación de firma Twilio → HMAC-SHA1 implementado ✅
- Contraseña `'1972'` hardcodeada en bundle JS → eliminada, `masterMode` ahora es `userRole === 'owner'` ✅
- Scoping de sucursales para Gerente implementado (useTenant + IssueManagement + UserManagement) ✅
- **Feature recompensas no monetarias (BMW):** `reward_type` + `reward_value` en `coupon_configs` y `recovery_config` ✅
  - UI: selector de tipo (Descuento / Mercancía / Evento / Experiencia) en RecoverySettings y CouponManagement
  - FeedbackPublic: card muestra "Tu recompensa" / "Código de canje" si no es descuento
  - Edge Function `send-whatsapp-alert` adapta label en mensaje
  - Fix: campo valor estimado ya no antepone cero al escribir
- CORS `retelio.app` faltante → alertas WhatsApp bloqueadas por preflight → corregido en `_shared/cors.ts` ✅

---

## ✅ Resuelto en sesión 2026-05-19
- `recovery_sent` boolean error (objeto JSON pasado como boolean) — `FeedbackPublic.jsx`
- Teléfono del cliente siempre llegaba como `5550733331` en alertas WhatsApp (stale state) — `FeedbackPublic.jsx` + deploy Edge Function
- `stripe-checkout` redirigía a dominio muerto `ianps.netlify.app` → corregido a `admin.retelio.app`
- `alert()` nativo reemplazado por banner de error inline en formulario público
- CORS `*` restringido a orígenes conocidos en las 9 Edge Functions (`_shared/cors.ts`)

---

## 🚨 Pendientes prioritarios

### A. Verificar en producción
1. **⬜ Scoping de sucursales para Gerente** — implementado, pendiente prueba real
   - Ir a Equipo → editar un gerente → asignar sucursales → verificar que solo ve esas en Recuperación

### B. ALTO — próximo sprint
2. `admin-api listUsers()` sin paginación — falla silenciosamente con 1000+ usuarios (`index.ts:99`)
3. `QRGenerator` usa tabla legacy `Tiendas_Catalogo` en lugar de `locations` (sin impacto hasta activar gerentes)
4. `dataService.fetchFeedbacks` sin LIMIT — datasets grandes colapsan el cliente
5. `console.log` en producción — añadir guard `import.meta.env.DEV`
6. `calculateNPS` dead code en `App.jsx`

### C. Legal / Compliance
7. **Aviso de Privacidad (LFPDPPP Capa 2)** — crear página en `retelio.com.mx/privacidad`
8. **Contratos — Convenio de Encargo (Capa 3)** — antes del primer cliente enterprise
9. **Signup abierto** — cualquiera puede crear cuenta; evaluar deshabilitar signup público

### D. Twilio
10. **HSM Template para campañas WhatsApp** — sin plantilla aprobada por Meta los mensajes no se entregan
    - Crear en Twilio Console → aprobar con Meta → agregar `TWILIO_CAMPAIGN_TEMPLATE_SID`

---

## Migraciones SQL — estado

```sql
-- YA EJECUTADAS:
ALTER TABLE feedbacks ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE feedbacks ADD COLUMN consent_at TIMESTAMPTZ;
ALTER TABLE feedbacks ADD COLUMN consent_version TEXT;
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS location_ids UUID[] DEFAULT '{}';
ALTER TABLE coupon_configs ADD COLUMN IF NOT EXISTS reward_type TEXT NOT NULL DEFAULT 'discount';
ALTER TABLE coupon_configs ADD COLUMN IF NOT EXISTS reward_value NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE recovery_config ADD COLUMN IF NOT EXISTS reward_type TEXT NOT NULL DEFAULT 'discount';
ALTER TABLE recovery_config ADD COLUMN IF NOT EXISTS reward_value NUMERIC(10,2) NOT NULL DEFAULT 0;

-- PENDIENTE (no ejecutada):
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Normalizar roles:
UPDATE "Usuarios" SET rol = 'admin'   WHERE rol IN ('Admin', 'admin');
UPDATE "Usuarios" SET rol = 'gerente' WHERE rol IN ('Gerente', 'gerente');
UPDATE "Usuarios" SET rol = 'caja'    WHERE rol IN ('Caja', 'caja');
UPDATE "Usuarios" SET rol = 'admin'   WHERE rol = 'Usuario' OR rol IS NULL;
```

---

## Orígenes CORS permitidos (`_shared/cors.ts`)
```
https://admin.retelio.app   ← admin panel
https://retelio.app         ← feedback form público
https://ian-feedback.netlify.app
http://localhost:5173
http://localhost:3000
```
⚠️ Si se agrega un nuevo dominio para el form público, actualizar este archivo y redesplegar las funciones afectadas.

---

## Archivos clave
- `src/components/FeedbackPublic.jsx` — flujo QR público (bad/good review)
- `src/components/admin/IssueManagement.jsx` — Recovery operations
- `src/components/admin/CouponManagement.jsx` — Cupones automáticos + catálogo
- `src/components/admin/RecoverySettings.jsx` — Config recovery/loyalty + reward types
- `src/components/admin/RetelioDashboard.jsx` — Dashboard principal
- `src/services/dataService.js` — queries centralizadas
- `src/App.jsx` — routing + tenant context
- `src/hooks/useTenant.js` — hook de tenant/auth (incluye userLocationIds)
- `supabase/functions/_shared/cors.ts` — CORS allowlist centralizado
- `supabase/functions/send-whatsapp-alert/index.ts` — alertas WhatsApp al gerente
- `supabase/functions/admin-api/index.ts` — CRUD de usuarios con auth JWT
- `supabase/functions/twilio-webhook/index.ts` — webhook de respuestas del cliente

---

## Lo que está bien — no tocar
- Flujo de pasos en FeedbackPublic (StepScore/Reason/Contact/Done)
- Lógica de buckets hot/warm/cold en IssueManagement
- `send-recovery-message` Edge Function (la más robusta)
- Design tokens `T = { coral, teal, ink... }` inline consistentes
- `planLimits.js` con estructura de pricing
