# Extrusión de moldes – Planta Cevil

Del plano del molde de extrusión (PDF o DXF de AutoCAD) al **ladrillo cocido en 3D**. Cada plano se guarda con la animación del ladrillo cocido, agrupado por tipo de ladrillo.

## Cómo se usa

1. **Soltá el plano** en la pantalla principal (PDF exportado de AutoCAD o DXF).
2. En segundos aparece **el ladrillo cocido en 3D girando**, con las medidas finales, la cantidad de huecos, el % de huecos, el peso, la pared mínima y el tabique mínimo.
3. Elegí el **tipo de ladrillo**, poné el **código y la versión**, y opcionalmente la versión anterior del molde. Después tocá **Guardar plano y animación**.
4. La app graba un video del ladrillo girando y sube a Drive, en la subcarpeta del tipo:
   - el plano original;
   - la animación (`.webm`);
   - una imagen (`.png`).

   La ficha queda guardada en la planilla.

En **Moldes** se ven todos los guardados, agrupados por tipo y con las versiones enlazadas (→ versión siguiente, ⑂ rama). Cada ficha tiene:
- el 3D;
- la sección cocida acotada y los huecos por medida;
- todas las medidas;
- los enlaces a Drive;
- la descarga de los DXF del cocido y del molde;
- la comparación con la versión anterior.

### Escala de los PDF
En los PDF de AutoCAD las cotas vienen dibujadas como líneas y no como texto, así que el PDF no dice cuánto mide el molde. La app toma la medida exterior del molde (ancho × alto) que tiene guardada el **tipo de ladrillo**. Por ejemplo, el portante 12×19×33 tiene un molde de 344 × 125 mm. Si el plano no tiene esas proporciones, la app avisa. Los DXF ya vienen en milímetros.

### Tipos de ladrillo (Ajustes)
Para cada tipo se guarda:
- la medida del molde;
- las contracciones horizontal, vertical y longitudinal;
- el largo cocido;
- la densidad del cocido.

El primer tipo se crea solo al guardar el primer plano, con los valores del portante 12×19×33 que se pueden editar. Si se cambian los parámetros de un tipo, se recalculan todos sus moldes.

## Puesta en marcha

### Apps Script (una sola vez)
1. Abrí el proyecto de Apps Script y reemplazá `Code.gs` por `apps-script/Code.gs`.
2. En *Configuración del proyecto* activá «Mostrar el archivo de manifiesto» y reemplazá `appsscript.json` por `apps-script/appsscript.json`.
3. Elegí la función **`autorizar`** y tocá **Ejecutar**. Aceptá los permisos. Esto:
   - crea la planilla **«Extrusión de moldes - Catálogo»** dentro de la carpeta de planos, con las hojas `Tipos`, `Moldes`, `Geometrias` y `Log`;
   - escribe en el registro la dirección de la planilla y la de la carpeta.
4. *Implementar → Administrar implementaciones → ✏️ Editar → Versión: Nueva versión → Implementar*. Así se mantiene la misma URL `/exec` que ya está en `config.js`.
   - Si es la primera implementación: *Implementar → Nueva implementación → Aplicación web*, ejecutar como **Yo**, acceso **Cualquier usuario**.

La carpeta de planos ya viene configurada (`CARPETA_DEFECTO` en `Code.gs`). Para usar otra carpeta, agregá la propiedad `CARPETA_ID`. Para proteger la app con clave, agregá la propiedad `API_KEY`; cada usuario carga esa clave en *Ajustes*.

### GitHub Pages
Subí `index.html`, `styles.css`, `config.js`, `geo.js`, `datos.js`, `visor.js`, `app.js`, `seed.json`, `img/` y este README. La URL `/exec` va en `config.js` (`SCRIPT_URL`).

### Navegador
La animación se graba en el navegador. Usá Chrome o Edge en una PC, que lo graban a 30 cuadros por segundo. Si el navegador no puede grabar video, se guarda solo la imagen.
