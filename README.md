# Generador de Rúbricas Formativas (general, multi-docente)

App web en **React + Vite + TypeScript + Tailwind** para crear y usar rúbricas formativas de forma general (no atada a marcos legales específicos). Incluye:
- Niveles de logro configurables (nombres y puntajes).
- Pesos por tipo de evaluación: **Auto**, **Coevaluación**, **Heteroevaluación**.
- Estudiantes y equipos (para coevaluación con reparto de puntos).
- Criterios con descriptores por nivel.
- Registro de evidencias y feedback.
- Reportes por estudiante y generales.
- Exportar/Importar **JSON**.

## Requisitos
- Node.js 18+ y npm

## Instalación
```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Construir para producción
```bash
npm run build
npm run preview
```

## Estructura
- `src/App.tsx` — aplicación principal (sin librerías UI externas).
- `src/styles.css` — Tailwind + utilidades mínimas.
- Exporta/Importa JSON desde la cabecera de la app.

## Notas
- La suma sugerida de pesos de criterios es 100% (la app funciona con cualquier suma).
- La suma de pesos de tipos (Auto/Co/Hetero) idealmente es 100%.
- La coevaluación puede activarse como **bono** (máx. % configurable).

---

## Desplegar en GitHub Pages (recomendado)

1. Crea un repositorio **nuevo** en GitHub (ej.: `rubric-app-general`) y súbelo:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit"
   git branch -M main
   git remote add origin https://github.com/<TU_USUARIO>/rubric-app-general.git
   git push -u origin main
   ```
2. En GitHub, ve a **Settings → Pages** y en **Build and deployment** selecciona **GitHub Actions**.
3. La acción `Deploy to GitHub Pages` ya está configurada en `.github/workflows/deploy.yml`.
   - Cuando hagas **push a `main`**, GitHub construirá y publicará automáticamente.
4. Tu sitio quedará en: `https://<TU_USUARIO>.github.io/rubric-app-general/`

> Nota: el workflow fija `BASE_PATH=/<repo>/` automáticamente, por lo que **no necesitas** editar `vite.config.ts`.
