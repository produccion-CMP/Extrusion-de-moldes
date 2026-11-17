# Extrusión de moldes – Planta Cevil

Del plano del molde de extrusión (PDF o DXF de AutoCAD) al **ladrillo cocido en 3D**, con **revisión técnica del plano**, **plano con vistas** y **catálogo por familias**. Además, las **piezas del molde** (dados, marco, araña, boquilla) y de las máquinas pasan del plano a un sólido 3D. Todo se sube desde un solo lugar y cada plano se guarda en Drive con su animación.

## Navegación

| Pantalla | Qué muestra |
|---|---|
| **Catálogo** | Familias: Huecos, Portantes, Losas, Climablock (editables por el admin) |
| **Familia** | Tipos de la familia (H8, H12, H18, P12, P18…) con cantidad de variantes |
| **Tipo** | Variantes del molde con **vista previa del plano**, huecos, % de vacío, peso y estado de la revisión |
| **Variante** | Pestañas: 3D · Plano y vistas · Revisión · Medidas · Versiones |
| **Subir plano** | Un solo lugar para todos los planos: la app identifica si es **ladrillo** o **pieza** y lo lleva a su sección |
| **Nuevo plano** | Ladrillo: 3D cocido + revisión + plano → guardar con animación |
| **Piezas** | Piezas de moldes y máquinas en 3D, por grupo: molde/matriz, araña, boquilla, extrusora, ejes, bujes, poleas, placas, soportes |
| **Comparar** | Dos variantes lado a lado |
| **Ajustes** | Acceso de administrador, familias, tipos, reglas de revisión, conexión |

## Subir plano: ladrillo o pieza

Se elige **Detectar solo**, **Ladrillo** o **Pieza** (con su grupo). En automático la app suma indicios:

| Indicio | Apunta a |
|---|---|
| Modelo 3D (STEP, IGES, STL, OBJ) | Pieza |
| Nombre del archivo con boquilla, araña, dado, núcleo, marco, eje, buje, polea, brida, soporte… | Pieza, y propone el grupo |
| Nombre con matriz, molde, ladrillo, portante, H12, P12… | Ladrillo |
| Marco cerrado con 8 o más huecos, casi todos rectangulares y repetidos | Ladrillo |
| Rayado en las caras | Ladrillo |
| Vacío entre 35 % y 75 % | Ladrillo |
| Huecos redondos (agujeros de mecanizado) o sin marco con dados | Pieza |

Arriba del resultado se ve qué decidió, con qué seguridad y por qué. El botón **«No, es una pieza» / «No, es un ladrillo»** abre el mismo archivo en la otra sección sin volver a subirlo.

## Piezas de moldes y máquinas

Pantallas: **Grupos** → **piezas del grupo** (filtro por máquina) → **ficha** con 3D, medidas, peso, datos y archivos.

- Grupos por defecto: 🧩 Molde / matriz (dados, marco, núcleos, portanúcleos, puentes), 🕸️ Araña, 🔻 Boquilla, 🌀 Extrusora, 🔩 Ejes, ⭕ Bujes, ⚙️ Poleas, 🔲 Placas, 🏗️ Soportes.
- Cada pieza se puede enlazar a un **molde** del catálogo (*Molde al que pertenece*). La ficha del molde tiene la pestaña **🧩 Piezas** con todas sus piezas y el botón **＋ Agregar pieza**.

| Entrada | Qué hace la app |
|---|---|
| PDF o DXF con vistas | Encuentra las vistas del plano, ignora el marco y el rótulo, y propone frente, planta y lateral según su ubicación |
| STEP, IGES, STL u OBJ | Muestra el modelo 3D directo, en mm |

| Método | Para qué piezas | Qué usa |
|---|---|---|
| 🔄 Revolución | Ejes, bujes, poleas, bridas torneadas | Un perfil que gira sobre su eje. El eje se propone solo según la simetría |
| ▭ Extrusión | Placas, chapas, bridas cortadas | Un perfil con espesor. El espesor sale de la otra vista o se escribe |
| 🧊 Por vistas | Soportes, ménsulas, piezas prismáticas | Intersección de frente, planta y lateral. Admite ISO E (IRAM) y ISO A |

- En **Huecos y macizos** se toca un área para pasarla de hueco a macizo o al revés. Por ejemplo, el agujero de un buje en un corte.
- En **Capas del plano** se activan o desactivan capas: cotas, ejes, líneas ocultas. Por defecto se ignoran las capas de cotas, ejes, ocultas y textos.
- La escala se pone como 1:N o con el ancho real de la vista.
- Peso = volumen × densidad del material.
- Descargas: **STL** (para impresión 3D) e imagen.
- **Corte**: muestra el interior.
- Se guarda la receta de la pieza: las vistas y los parámetros, o la malla si es un modelo 3D.
- En Drive se suben el archivo original, la animación y una imagen, en `Piezas de máquinas/<grupo>/` (en la planilla, hoja `Piezas`, columna `Molde` para el enlace).
- Los grupos se crean y editan en *Ajustes → Grupos de piezas* o con **＋ Nuevo grupo**. Solo el administrador puede hacerlo. Cada grupo tiene un método por defecto.

Límites de los planos 2D:
- Por vistas arma la silueta común de las vistas. Los agujeros ciegos y las ranuras internas que no se ven en ninguna vista salen pasantes o no salen.
- En revolución no entran los agujeros que no son coaxiales, como los de los bulones de una brida. Para eso conviene el modelo STEP.

## Revisión del plano

Se hace al cargar el plano y se guarda con cada variante. Cada observación tiene un número, que también aparece **marcado en el plano**, y una sugerencia de corrección.

| Control | Nivel |
|---|---|
| Contorno abierto (líneas que no cierran) | Error si la abertura es > 0,5 mm |
| Tramo del contorno en otra capa o color | Aviso |
| Proporción del plano distinta a la medida del molde del tipo | Aviso |
| Pared exterior y tabiques bajo el mínimo | Error |
| Pared más fina que el tabique; tabiques o paredes desparejos | Aviso |
| Simetría izquierda/derecha de los huecos | Aviso |
| Huecos chicos; esquinas de dado vivas (radio estimado) | Aviso |
| Ancho y alto cocido contra el objetivo del tipo | Aviso |
| % de vacío fuera de rango; peso por encima del máximo | Aviso |
| Sin rayado en las caras | Nota |

Los mínimos y las tolerancias se configuran en *Ajustes → Reglas de la revisión técnica*. Los objetivos (medida cocida, % de vacío, peso máximo) se configuran en cada tipo.

## Plano y vistas

Hoja A3 con:
- **vista frontal** (sección de huecos) acotada en cadena;
- **vista superior** (cara 330 × 190) y **vista lateral** (cara 120 × 190), con el rayado;
- imagen 3D y rótulo.

Botones: *Imprimir / PDF*, *SVG*, *DXF cocido* y *DXF molde*.

## Administrador

- La contraseña se guarda **solo en Apps Script**, en la propiedad del script `ADMIN_PASS`. No está en el repositorio.
- La sesión dura 12 horas. Va firmada con una clave interna que se genera sola (`TOKEN_SECRET`).

| Acción | Usuario | Admin |
|---|---|---|
| Ver catálogo, 3D, plano, revisión, comparar | ✔ | ✔ |
| Cargar plano nuevo | ✔ (salvo que se active «Solo el administrador puede cargar planos») | ✔ |
| Editar o borrar variantes | — | ✔ |
| Crear, editar o borrar tipos | — | ✔ |
| Editar familias y reglas de revisión | — | ✔ |
| Crear y editar grupos de piezas | — | ✔ |
| Cargar piezas | ✔ (misma regla que los planos) | ✔ |
| Editar o borrar piezas | — | ✔ |
| Importar ejemplos | — | ✔ |

En modo local (sin planilla) todo queda habilitado y se guarda solo en el navegador.

## Escala de los PDF

En los PDF de AutoCAD las cotas vienen dibujadas como líneas y no como texto, así que el PDF no dice cuánto mide el molde. La app usa la medida exterior del molde (ancho × alto) guardada en el **tipo**. Por ejemplo, el P12 usa 344 × 125 mm. Los DXF ya vienen en milímetros, así que son la entrada recomendada.

## Puesta en marcha

### Apps Script
1. Reemplazá `Code.gs` por `apps-script/Code.gs`. Si cambió el manifiesto, reemplazá también `appsscript.json`.
2. *Configuración del proyecto → Propiedades del script*: agregá
   - `ADMIN_PASS`: la contraseña del administrador;
   - opcionalmente, `API_KEY` (clave de acceso para todos) y `CARPETA_ID` (otra carpeta de planos).
3. Ejecutá **`autorizar`** una vez. Crea la planilla «Extrusión de moldes - Catálogo» dentro de la carpeta de planos y las hojas que falten (`Config`, `Piezas`).
4. *Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar*. Así se mantiene la URL `/exec` de `config.js`.

### GitHub Pages
Subí `index.html`, `styles.css`, `config.js`, `geo.js`, `revision.js`, `plano.js`, `datos.js`, `visor.js`, `app.js`, `piezas.js`, `pieza3d.js`, `subir.js`, `seed.json`, `img/` y este README.

### Navegador
La animación se graba en el navegador. Usá Chrome o Edge en una PC, por https (GitHub Pages ya lo es). Si el navegador no puede grabar video, se guarda solo la imagen.
