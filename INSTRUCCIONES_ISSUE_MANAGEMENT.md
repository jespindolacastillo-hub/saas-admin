# 🚀 Instrucciones para Activar Issue Management

## Paso 1: Crear la tabla Issues en Supabase

1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard/project/dafojjpkosncekkpjfdv
2. Click en "SQL Editor" en el menú lateral
3. Click en "New Query"
4. Copia y pega el contenido del archivo `create_issues_table.sql`
5. Click en "Run" para ejecutar el script

## Paso 2: Verificar que la tabla se creó correctamente

1. Ve a "Table Editor" en Supabase
2. Deberías ver una nueva tabla llamada "Issues"
3. Verifica que tiene las siguientes columnas:
   - id (UUID)
   - feedback_id (UUID)
   - titulo (TEXT)
   - descripcion (TEXT)
   - categoria (TEXT)
   - severidad (TEXT)
   - estado (TEXT)
   - tienda_id (TEXT)
   - area_id (TEXT)
   - asignado_a (TEXT)
   - fecha_reporte (TIMESTAMP)
   - fecha_asignacion (TIMESTAMP)
   - fecha_resolucion (TIMESTAMP)
   - fecha_verificacion (TIMESTAMP)
   - acciones_tomadas (TEXT)
   - notas (TEXT)
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)

## Paso 3: Probar el sistema

1. Recarga el dashboard admin (http://localhost:5174)
2. Click en la pestaña "Issues" en el menú lateral
3. Deberías ver:
   - KPIs de issues (Total, Críticos, En Progreso, etc.)
   - Panel de "Feedback Crítico" con comentarios negativos
   - Botón "Crear Issue" para cada feedback crítico

## Paso 4: Flujo de trabajo

### Crear un Issue:
1. En la columna derecha verás "Feedback Crítico"
2. Estos son comentarios con calificación ≤2 estrellas
3. Click en "Crear Issue" para convertir el feedback en un issue rastreable

### Gestionar Issues:
1. **Abierto** → Click "Iniciar Trabajo" → Cambia a "En Progreso"
2. **En Progreso** → Click "Marcar Resuelto" → Cambia a "Resuelto"
3. **Resuelto** → Click "Verificar" → Cambia a "Verificado"

### Métricas Disponibles:
- **Total Issues**: Cantidad total de problemas registrados
- **Críticos Abiertos**: Issues con severidad "Crítica" sin resolver
- **En Progreso**: Issues actualmente siendo trabajados
- **Tasa de Resolución**: % de issues resueltos
- **Tiempo Promedio**: Horas promedio para resolver un issue

## 🎯 Características Implementadas:

✅ Tabla Issues en Supabase con RLS habilitado
✅ Detección automática de feedback crítico (≤2 estrellas)
✅ Sistema de estados (Abierto → En Progreso → Resuelto → Verificado)
✅ Clasificación por severidad (Baja, Media, Alta, Crítica)
✅ Tracking de tiempos (reporte, asignación, resolución, verificación)
✅ Filtros por estado y severidad
✅ KPIs ejecutivos
✅ Cálculo automático de tiempo promedio de resolución
✅ Interfaz visual con códigos de color por estado

## 📊 Próximos Pasos (Opcional):

- [ ] Punto 6: Follow-up QR para re-encuestar clientes después de resolver
- [ ] Asignación de responsables
- [ ] Notificaciones automáticas
- [ ] Exportación de reportes
- [ ] Dashboard de tendencias de issues

---

**Nota**: El sistema está listo para usar. Solo necesitas ejecutar el SQL en Supabase y recargar el dashboard.
