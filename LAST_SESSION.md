# Última sesión — 2026-03-26

## Fixes desplegados

### 1. GeoMap usa `Tiendas_Catalogo` en lugar de `locations`
`GeoMap.jsx`: query cambiada de `locations` → `Tiendas_Catalogo`, filtro `location_id` → `tienda_id`.

### 2. Auto-geocodificación con Nominatim (OSM)
`GeoMap.jsx`: trae todos los stores; para los sin coords llama a Nominatim y actualiza `Tiendas_Catalogo` en background.

### 3. Geocodificación al crear/editar sucursal
- `OnboardingWizard.jsx`: guarda `lat/lng` al crear sucursal desde el wizard.
- `QRStudio.jsx`: guarda `lat/lng` al crear **o editar** sucursal desde QR Studio.

### 4. `column Feedback.score does not exist`
`GeoMap.jsx`: score renombrado a `satisfaccion` (nombre real en producción).

---

## Commits (main → Netlify auto-deploy)

```
23cf06b  fix: GeoMap usa Feedback.satisfaccion en lugar de .score
a8c1bac  feat: auto-geocoding en QRStudio + OnboardingWizard al crear/editar sucursal
ab9ebaf  chore: ignorar CPdescarga.xml (63MB)
c5e3d06  fix: GeoMap usa Tiendas_Catalogo en lugar de locations
```

---

## Estado actual

- `Tiendas_Catalogo` en producción: columnas `lat`, `lng`, `direccion` ✅ existen
- 30 stores en producción, 0 con coords — se geocodificarán automáticamente al abrir el mapa

## Pendientes

- [ ] Rellenar `direccion` en sucursales existentes para mejorar precisión del geocoding
