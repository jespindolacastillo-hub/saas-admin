# Next Session — saas-admin

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
- URL hardcodeada en FeedbackPublic.jsx línea ~710

### 3. Twilio HSM Template para campañas WhatsApp
- Las campañas WhatsApp no se entregan sin plantilla aprobada
- Crear template en Twilio Console → aprobar con Meta
- Agregar `TWILIO_CAMPAIGN_TEMPLATE_SID` a secrets de Supabase
- Wiring pendiente en `send-recovery-message` Edge Function

### 4. Migraciones SQL pendientes de ejecutar en Supabase
```sql
-- contact_email en feedbacks (si no se ejecutó ya)
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Normalizar roles existentes en Usuarios
UPDATE "Usuarios" SET rol = 'admin'   WHERE rol IN ('Admin', 'admin');
UPDATE "Usuarios" SET rol = 'gerente' WHERE rol IN ('Gerente', 'gerente');
UPDATE "Usuarios" SET rol = 'caja'    WHERE rol IN ('Caja', 'caja');
UPDATE "Usuarios" SET rol = 'admin'   WHERE rol = 'Usuario' OR rol IS NULL;

-- location_ids para gerente (cuando se implemente)
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

## Lo que se hizo esta sesión (2026-05-14)

- **Campaigns**: locations table fix, only_unredeemed filter, Resend email, canal único recovery (WhatsApp), 30-day suppression, fix "0 enviados", templates friendlier
- **FeedbackPublic**: email+phone capture en DoneHappy, gamification cupón bloqueado (shimmer + confetti + flip 3D), botón Google dentro del card bloqueado, formulario aparece post-click, copy con nombre del negocio
- **LFPDPPP Capa 1**: checkbox marketing opt-in (no pre-marcado), Aviso de Privacidad link, marketing_consent + consent_at + consent_version guardados en DB
- **RetelioDashboard**: tooltips custom InfoTooltip component (reemplazó title attr roto)
- **Roles**: arquitectura 4 roles (owner/admin/gerente/caja), lookup case-insensitive, caja asignable desde UI, owner agregado con acceso billing

## Estado del repo
- Rama: main (auto-deploy a Netlify)
- Último commit: 8a861ae — role system fix
