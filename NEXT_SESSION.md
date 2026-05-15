# Next Session — saas-admin

## Pendientes prioritarios

### 1. Aviso de Privacidad (LFPDPPP Capa 2)
- Crear página en `retelio.com.mx/privacidad`
- Contenido mínimo: responsable, finalidad, derechos ARCO, contacto INAI
- URL hardcodeada en FeedbackPublic.jsx línea ~710

### 2. Twilio HSM Template para campañas WhatsApp
- Las campañas WhatsApp no se entregan sin plantilla aprobada
- Crear template en Twilio Console → aprobar con Meta
- Luego agregar `TWILIO_CAMPAIGN_TEMPLATE_SID` a secrets de Supabase
- Wiring pendiente en `send-recovery-message` Edge Function

### 3. Verificar columna contact_email en feedbacks
```sql
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS contact_email TEXT;
```
Si no se ejecutó ya, los inserts van a fallar silenciosamente.

### 4. Contratos — Convenio de Encargo (Capa 3 LFPDPPP)
- Cláusula de encargo de datos en contrato de suscripción
- Retelio = Encargado, cliente = Responsable
- Antes del primer cliente enterprise

## Lo que se hizo esta sesión

- Campaigns: locations table fix, only_unredeemed filter, Resend email, canal único recovery (WhatsApp), 30-day suppression, fix "0 enviados"
- FeedbackPublic: email+phone capture en DoneHappy, gamification cupón bloqueado (shimmer + confetti + flip 3D), botón Google dentro del card bloqueado, formulario aparece post-click
- LFPDPPP Capa 1: checkbox marketing opt-in, Aviso de Privacidad link, consent_at + consent_version guardados en DB
- RetelioDashboard: tooltips custom InfoTooltip (reemplazó title attr roto)
- Migrations ejecutadas: marketing_consent.sql

## Estado del repo
- Rama: main (auto-deploy a Netlify)
- Último commit: d909b7b — LFPDPPP consent form
