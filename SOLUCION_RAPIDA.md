# Solución Rápida: Crear Usuario en Supabase Auth

## El Problema

`evivaso@priceshoes.com` existe en la tabla `Usuarios` pero **NO** en Supabase Auth, por eso sigue dando "Invalid login credentials".

## Solución: Crear el Usuario en Supabase Auth

### Opción 1: Crear Manualmente en Supabase (⚡ Más Rápido)

1. **Ir a Supabase Auth Users**:
   https://supabase.com/dashboard/project/dafojjpkosncekkpjfdv/auth/users

2. **Click en "Add user" → "Create new user"**

3. **Completar el formulario**:
   - Email: `evivaso@priceshoes.com`
   - Password: (elegir una contraseña temporal, ej: `TempPassword123!`)
   - ✅ **Auto Confirm User**: ACTIVAR (importante!)

4. **Click "Create user"**

5. **Probar login** en https://priceshoes.netlify.app/

### Opción 2: Usar el Formulario de Registro

1. Ir a https://priceshoes.netlify.app/
2. Click en "Crea una cuenta"
3. Usar el email `evivaso@priceshoes.com`
4. Crear nueva contraseña
5. El trigger automático sincronizará con la tabla Usuarios

## ¿Por Qué Pasó Esto?

El script SQL que ejecutaste solo migra usuarios que **ya existen en Supabase Auth**. Como `evivaso@priceshoes.com` solo existía en la tabla personalizada `Usuarios` (probablemente insertado vía SQL), el script no lo migró a Auth.

## Después de Crear el Usuario

El trigger automático que instalamos se encargará de:
1. Actualizar el ID en la tabla `Usuarios` con el ID de Auth
2. Mantener sincronizado cualquier nuevo usuario que se registre
