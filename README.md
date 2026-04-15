# 🚀 Retelio Admin Dashboard

Bienvenido al proyecto de administración de **Retelio**. Este repositorio contiene el panel de control multi-tenant para la gestión de sucursales, usuarios, feedback (NPS) y notificaciones de WhatsApp.

## 🛠️ Stack Tecnológico
- **Frontend**: React 19 + Vite + Lucide Icons.
- **Backend/Base de Datos**: Supabase (PostgreSQL + Auth + Storage).
- **Lógica de Servidor**: Supabase Edge Functions (Deno Runtime).
- **Estilos**: Vanilla CSS / JavaScript-in-JS (Rich UI aesthetics).

---

## 📂 Estructura del Proyecto
- `/src`: Contiene los componentes de React, hooks y configuración.
  - `/src/components/admin`: Vistas principales del dashboard.
  - `/src/hooks/useTenant.js`: Hook central para la identidad multi-tenant.
- `/supabase`: Configuración de Supabase y funciones de servidor.
  - `/supabase/functions/admin-api`: API central para tareas administrativas (creación/borrado de usuarios).
  - `/supabase/functions/send-whatsapp-alert`: Integración con Twilio para alertas críticas.

---

## ⚠️ Estado Actual: Problema de Guardado de Usuarios
Actualmente estamos depurando un error en el componente `UserManagement.jsx`. 
- **Problema**: El guardado de nuevos usuarios a veces retorna un error `non-2xx status code` desde la Edge Function `admin-api`.
- **Qué se ha hecho**: Se centralizó la creación en el servidor para evitar conflictos de RLS, pero el servidor está rechazando algunas peticiones.
- **Para debugear**: Mira los logs en tiempo real en el dashboard de Supabase -> Edge Functions -> admin-api.

---

## 🤝 Reglas de Colaboración (Para Humanos y AIs)
Para mantener la integridad del proyecto y la transparencia entre los desarrolladores:

1.  **NO pushear directo a `main`**: Todos los cambios deben ir en una rama nueva (ej: `fix/error-save-users`).
2.  **Pull Requests**: Abre una PR para cada cambio. Netlify generará una "Deploy Preview" para probar antes de fusionar.
3.  **Edge Functions**: Toda tarea administrativa sensible (como crear usuarios en Auth) **DEBE** pasar por las Edge Functions usando el `service_role_key` para garantizar consistencia.
4.  **Multi-tenancy**: Siempre usa el `tenant_id` resuelto por el hook `useTenant` para filtrar datos.

---

## 🚀 Cómo Empezar
1.  Clona el repositorio.
2.  Copia el archivo `.env.example` (si existe) o pide las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3.  Instala dependencias: `npm install`.
4.  Corre el servidor local: `npm run dev`.

---
*Mantenido por Antigravity (tu asistente de IA) y el equipo de Retelio.*
