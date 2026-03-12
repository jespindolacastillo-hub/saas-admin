# 📘 Guía Completa de Issue Management

## 🚀 Paso 1: Insertar Datos de Prueba

1. Ve a Supabase SQL Editor
2. Copia y pega el contenido de `insert_test_issues.sql`
3. Click en "Run"
4. Deberías ver 8 issues creados con diferentes estados

## 📊 Paso 2: Explorar el Dashboard

### Recarga el Admin Portal
- URL: http://localhost:5174
- Click en la pestaña "Issues" (ícono de triángulo ⚠️)

### KPIs que verás:
- **Total Issues**: 8
- **Críticos Abiertos**: 2-3 (dependiendo de los datos)
- **En Progreso**: 2
- **Tasa de Resolución**: ~37% (3 de 8 resueltos/verificados)
- **Tiempo Promedio**: Varía según las fechas

## 🔄 Paso 3: Cambiar Estados de Issues

### Workflow Completo:

#### 1️⃣ **Issue Abierto → En Progreso**
- Busca un issue con estado "Abierto" (borde rojo)
- Click en botón "Iniciar Trabajo"
- ✅ El issue cambia a "En Progreso" (borde naranja)
- ✅ Se registra `fecha_asignacion` automáticamente

#### 2️⃣ **En Progreso → Resuelto**
- Busca un issue "En Progreso" (borde naranja)
- Click en botón "Marcar Resuelto"
- ✅ El issue cambia a "Resuelto" (borde verde)
- ✅ Se registra `fecha_resolucion` automáticamente
- ✅ El KPI "Tasa de Resolución" aumenta

#### 3️⃣ **Resuelto → Verificado**
- Busca un issue "Resuelto" (borde verde)
- Click en botón "Verificar"
- ✅ El issue cambia a "Verificado" (borde azul)
- ✅ Se registra `fecha_verificacion` automáticamente

## ➕ Paso 4: Crear Nuevos Issues desde Feedback

### Método Automático (desde Feedback Crítico):

1. **Panel derecho "Feedback Crítico"**:
   - Muestra comentarios con ≤2 estrellas
   - Cada tarjeta muestra:
     - ⭐ Calificación
     - 📅 Fecha
     - 💬 Comentario
     - 🏢 Tienda • Área

2. **Click en "Crear Issue"**:
   - ✅ Se crea automáticamente un issue
   - ✅ Título: "Problema reportado en [Área]"
   - ✅ Descripción: El comentario del cliente
   - ✅ Severidad: "Crítica" (si 1⭐) o "Alta" (si 2⭐)
   - ✅ Estado: "Abierto"
   - ✅ Se vincula al feedback original

3. **El feedback desaparece del panel**:
   - Ya tiene un issue asignado
   - Evita duplicados

### Método Manual (desde Supabase):

```sql
INSERT INTO "Issues" (
  titulo,
  descripcion,
  categoria,
  severidad,
  estado,
  tienda_id,
  area_id
) VALUES (
  'Título del problema',
  'Descripción detallada',
  'Servicio', -- Infraestructura, Personal, Producto, Servicio, Otro
  'Alta', -- Baja, Media, Alta, Crítica
  'Abierto',
  'Vallejo',
  'Probadores'
);
```

## 🔍 Paso 5: Filtrar Issues

### Filtro por Estado:
- **Todos los Estados** (default)
- Abierto
- En Progreso
- Resuelto
- Verificado

### Filtro por Severidad:
- **Todas las Severidades** (default)
- Crítica (rojo oscuro)
- Alta (naranja)
- Media (azul)
- Baja (verde)

### Ejemplo de uso:
1. Selecciona "Estado: Abierto"
2. Selecciona "Severidad: Crítica"
3. ✅ Solo verás issues críticos que necesitan atención inmediata

## 🗑️ Paso 6: Eliminar Issues

### Opción 1: Desde Supabase (recomendado)
```sql
-- Ver todos los issues
SELECT id, titulo, estado FROM "Issues";

-- Eliminar un issue específico
DELETE FROM "Issues" WHERE id = 'uuid-del-issue';

-- Eliminar todos los issues de prueba
DELETE FROM "Issues" WHERE titulo LIKE '%prueba%';

-- Eliminar issues antiguos resueltos (más de 90 días)
DELETE FROM "Issues" 
WHERE estado = 'Verificado' 
AND fecha_verificacion < NOW() - INTERVAL '90 days';
```

### Opción 2: Agregar botón de eliminar (código)
Si quieres un botón "Eliminar" en la interfaz, puedo agregarlo.

## 📈 Paso 7: Interpretar las Métricas

### **Total Issues**: 
- Todos los issues registrados
- Útil para ver carga de trabajo total

### **Críticos Abiertos**:
- Issues con severidad "Crítica" sin resolver
- ⚠️ Requieren atención inmediata
- Color rojo = alerta

### **En Progreso**:
- Issues actualmente siendo trabajados
- Indica capacidad del equipo

### **Tasa de Resolución**:
- % de issues resueltos o verificados
- Meta recomendada: >80%
- Mide efectividad del equipo

### **Tiempo Promedio**:
- Horas desde reporte hasta resolución
- Solo cuenta issues resueltos
- Meta recomendada: <48 horas para críticos

## 🎯 Mejores Prácticas

### 1. **Triaje Diario**:
- Revisa "Feedback Crítico" cada mañana
- Crea issues para comentarios negativos
- Prioriza por severidad

### 2. **Asignación**:
- Usa el campo `asignado_a` para responsabilizar
- Formato: email o nombre del responsable

### 3. **Documentación**:
- Usa el campo `notas` para registrar avances
- Usa `acciones_tomadas` para documentar soluciones

### 4. **Seguimiento**:
- Cambia estados conforme avanzas
- No dejes issues en "En Progreso" más de 48h

### 5. **Verificación**:
- Siempre verifica que el problema se resolvió
- Idealmente, contacta al cliente (punto 6 pendiente)

## 🔧 Comandos SQL Útiles

### Ver resumen de issues por estado:
```sql
SELECT estado, COUNT(*) as total
FROM "Issues"
GROUP BY estado
ORDER BY total DESC;
```

### Ver issues críticos abiertos:
```sql
SELECT titulo, tienda_id, area_id, 
       DATE(fecha_reporte) as fecha
FROM "Issues"
WHERE severidad = 'Crítica' 
AND estado IN ('Abierto', 'En Progreso')
ORDER BY fecha_reporte DESC;
```

### Ver tiempo promedio de resolución por tienda:
```sql
SELECT 
  tienda_id,
  ROUND(AVG(EXTRACT(EPOCH FROM (fecha_resolucion - fecha_reporte))/3600)) as horas_promedio,
  COUNT(*) as issues_resueltos
FROM "Issues"
WHERE fecha_resolucion IS NOT NULL
GROUP BY tienda_id
ORDER BY horas_promedio ASC;
```

### Ver issues sin asignar:
```sql
SELECT titulo, severidad, estado, tienda_id
FROM "Issues"
WHERE asignado_a IS NULL
AND estado != 'Verificado'
ORDER BY 
  CASE severidad
    WHEN 'Crítica' THEN 1
    WHEN 'Alta' THEN 2
    WHEN 'Media' THEN 3
    WHEN 'Baja' THEN 4
  END;
```

## 🚨 Troubleshooting

### No veo issues en el dashboard:
1. Verifica que ejecutaste `insert_test_issues.sql`
2. Revisa en Supabase Table Editor que existan registros
3. Abre la consola del navegador (F12) y busca errores

### No aparece "Feedback Crítico":
1. Necesitas tener feedback con satisfaccion ≤2
2. El feedback debe tener comentarios (no null)
3. El feedback no debe tener un issue ya creado

### Los botones no cambian el estado:
1. Verifica que RLS esté habilitado correctamente
2. Revisa la consola del navegador
3. Verifica conexión a Supabase

### Error al crear issue desde feedback:
1. Verifica que el feedback_id sea válido
2. Asegúrate que el tipo sea BIGINT (no UUID)

---

¿Necesitas ayuda con algo específico? 🎯
