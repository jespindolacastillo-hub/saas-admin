# Última sesión — 2026-04-08

## Mejoras Desplegadas

### 1. Sistema de Feedback Dinámico
- **Soporte Multi-estilo**: `FeedbackPublic.jsx` ahora soporta escalas de **Estrellas** y **NPS (0-10)**, además de los emojis tradicionales.
- **Configuración Dinámica**: El formulario respeta el umbral de negatividad (`negative_threshold`) y los textos/opciones configurados en el administrador.
- **Validación de Tipos**: Las opciones de seguimiento (ej. "Organización", "Ambiente" para eventos) ahora se cargan dinámicamente según el tipo de QR.

### 2. Plantillas por Defecto en Administrador
- **QuestionManager.jsx**: Implementación de `TYPE_DEFAULTS` que pre-carga preguntas y opciones lógicas dependiendo del tipo de QR seleccionado (Empleado, Área, Producto, Evento, etc.).
- **Mejora en UX**: Facilita la creación de nuevos QR al no tener que escribir todas las opciones manualmente.

### 3. Otros Ajustes
- **Parsing de JSON**: Se añadió manejo robusto para las opciones de seguimiento almacenadas como JSON en la base de datos.
- **Control de Contacto**: El paso de captura de WhatsApp ahora es opcional y depende del toggle `request_contact` en el config.

---

## Commits (main → Netlify auto-deploy)

```bash
# feat: dynamic feedback configurations & type-specific defaults
# fix: handle stringified JSON in followup_options
```

---

## Estado Actual

- **Feedback Virtual**: Totalmente adaptativo al tipo de QR.
- **Configurador**: Ofrece sugerencias inteligentes por categoría.

## Pendientes

- [ ] Migrar el componente `Feedback.jsx` (legacy) para que use la misma lógica dinámica que `FeedbackPublic.jsx` o redirigir todo el tráfico a este último.
- [ ] Validar el flujo de cupones con los nuevos tipos de calificación.
