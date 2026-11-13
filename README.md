# Matrices – Planta Cevil

Aplicación web para pasar del **plano del molde de extrusión** (PDF o DXF de AutoCAD) al **ladrillo cocido**: detecta el marco y los dados, aplica las contracciones de planta, calcula medidas, % de huecos, volumen y peso, muestra el ladrillo en 3D y guarda todo en un catálogo agrupado por tipo de ladrillo, con las versiones de cada molde enlazadas.

- **Frontend:** `index.html`, `styles.css`, `config.js`, `geo.js` (lectura de PDF/DXF, detección de geometría y cálculos), `datos.js` (conexión, modo local, parámetros), `visor.js` (3D con three.js), `app.js` (interfaz), `seed.json` (catálogo inicial) e `img/logo-cmp.png`. Se publica en GitHub Pages. Usa el mismo sistema visual que Control de Tierra, Cronograma de Producción e Insumos Críticos.
- **Backend:** `apps-script/Code.gs`. Aplicación web de Google Apps Script que guarda el catálogo en una planilla de Google y los planos originales en Drive.

## Funciones

| Pestaña | Contenido |
|---|---|
| Catálogo | Moldes agrupados por familia y tipo de ladrillo. Cada línea muestra las versiones enlazadas (original → propuesta → revisión; ⑂ para ramas), con miniatura de la sección, estado, huecos, % de vacío y peso cocido. Búsqueda y filtros por familia y estado. |
| Molde | Ladrillo cocido en 3D (posición de obra o de salida de extrusora, vistas, cotas, contorno del molde superpuesto, captura PNG), sección cocida acotada con huecos por tipo, tabla molde vs. cocido (paredes, tabiques, rayado, áreas, perímetros, volumen, peso), línea de versiones, parámetros aplicados, descarga de DXF cocido y DXF del molde, enlace al plano en Drive, edición y borrado. |
| Cargar molde | Arrastrás el PDF o DXF; la app detecta sola las capas del molde, el marco, los dados y la orientación. Se puede corregir capas, rotar, espejar y fijar la escala. Se completan tipo, código, versión, versión anterior, estado, proveedor, fecha y autor, se ve el ladrillo cocido y se guarda. |
| Comparar | Dos moldes cualesquiera: secciones cocidas superpuestas, huecos de cada uno y tabla de diferencias (B − A) con verde para mejora y naranja para empeora. |
| Tipos | Parámetros de planta por tipo de ladrillo: familia, nombre, medida nominal, línea, largo cocido, contracción horizontal, vertical y longitudinal, densidad del cocido. Al cambiarlos se recalculan todos los moldes del tipo. |
| Ajustes | Conexión con Apps Script, modo local, importación del catálogo inicial y respaldo en JSON. |

### Cómo detecta la geometría

1. **PDF:** lee los trazos vectoriales con pdf.js y los agrupa por color y grosor. **DXF:** lee LINE, LWPOLYLINE (con arcos), POLYLINE, ARC, CIRCLE, ELLIPSE, SPLINE e INSERT de bloques, agrupados por capa; ignora capas apagadas o congeladas y las cotas.
2. Elige automáticamente la capa (o el par de capas) donde hay un contorno cerrado con varios huecos repetidos adentro y descarta el rótulo, las cotas y los ejes. Las aberturas de dibujo de hasta 0,8 % del tamaño (líneas que no cierran) se puentean.
3. Rasteriza esas capas a ~0,06 mm por píxel, separa el material de cada dado y traza los contornos sobre la línea media del trazo.
4. Pone el lado largo horizontal y el chaflán abajo, y escala: el DXF ya viene en mm; en el PDF se carga el ancho y el alto reales (por defecto, los del último molde del mismo tipo) y la app avisa si el alto no coincide.

Precisión verificada con los planos de la 12×19×33 contra la geometría exacta: área llena dentro de ±0,5 % (±0,05 % desde DXF), cantidad de huecos y de ondulaciones exacta, medidas individuales ±0,06 mm.

### Cálculo del ladrillo cocido

- Medida cocida = medida del molde × (1 − contracción), horizontal sobre el lado largo y vertical sobre el corto.
- Largo de corte en verde = largo cocido ÷ (1 − contracción longitudinal).
- Volumen = sección neta cocida × largo cocido. Peso = volumen × densidad (se muestra el rango ±0,1 g/cm³).
- Cada molde usa los parámetros de su tipo, salvo los que tenga cargados como propios.

## Puesta en marcha

### 1. Planilla y Apps Script

1. Creá una planilla de Google vacía, por ejemplo «Matrices CEVIL».
2. En la planilla: *Extensiones → Apps Script*. Pegá `apps-script/Code.gs`.
3. En *Configuración del proyecto*, marcá «Mostrar el archivo de manifiesto appsscript.json» y reemplazalo por `apps-script/appsscript.json`.
4. Opcional, recomendado: en *Propiedades de la secuencia de comandos* agregá `API_KEY` con una clave. Si el script no está vinculado a la planilla, agregá también `SHEET_ID`. Para elegir la carpeta de Drive de los planos, `CARPETA_ID` (si no, se crea «Matrices CEVIL - Planos»).
5. Ejecutá una vez la función `autorizar` para dar permisos y crear las hojas `Tipos`, `Moldes`, `Geometrias` y `Log`.
6. *Implementar → Nueva implementación → Aplicación web*: ejecutar como **Yo**, acceso **Cualquier usuario**. Copiá la URL `/exec`.

Cada vez que cambies `Code.gs`: *Implementar → Administrar implementaciones → Editar → Nueva versión*, para conservar la URL.

### 2. GitHub Pages

1. Subí al repositorio todos los archivos menos la carpeta `apps-script` (opcional) y sin claves.
2. En `config.js` podés dejar la URL `/exec` en `SCRIPT_URL`. La clave **no** va al repositorio: cada usuario la carga en *Ajustes → Conexión*.
3. *Settings → Pages → Deploy from a branch*, rama `main`, carpeta `/ (root)`.
4. Abrí la app, entrá a *Ajustes* y tocá **Importar** en «Catálogo inicial» para cargar el tipo Portante 12×19×33 con sus 4 moldes.

Sin URL configurada, la app funciona en **modo local** (todo queda en el navegador), útil para probar.

## Qué se guarda en la planilla

| Hoja | Contenido |
|---|---|
| Tipos | ID (T-001…), familia, nombre, nominal, largo cocido, contracciones H/V/L, densidad, línea, notas |
| Moldes | ID (M-0001…), tipo, código, versión, **versión anterior (Padre ID)**, estado, proveedor, fecha, autor, archivo y enlace a Drive, medidas del molde, huecos, % vacío, lleno en verde, parámetros propios, métricas (JSON), miniatura, notas |
| Geometrias | Contorno y dados de cada molde en mm (JSON en partes de 45.000 caracteres) |
| Log | Fecha, usuario, acción y detalle de cada cambio |

Al borrar un molde, sus versiones posteriores quedan enlazadas a la versión anterior del borrado. Un tipo con moldes no se puede borrar.
