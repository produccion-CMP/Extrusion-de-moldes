# Extrusión de moldes – Planta Cevil

Del plano del molde de extrusión (PDF o DXF de AutoCAD) al **ladrillo cocido en 3D**, con **revisión técnica del plano**, **plano con vistas** y **catálogo por familias**. Cada plano se guarda en Drive junto con la animación del ladrillo cocido, agrupado por tipo de ladrillo.

## Navegación

| Pantalla | Qué muestra |
|---|---|
| **Catálogo** | Familias: Huecos, Portantes, Losas, Climablock (editables por el admin) |
| **Familia** | Tipos de la familia (H8, H12, H18, P12, P18…) con cantidad de variantes |
| **Tipo** | Variantes del molde con **vista previa del plano**, huecos, % de vacío, peso y estado de la revisión |
| **Variante** | Pestañas: 3D · Plano y vistas · Revisión · Medidas · Versiones |
| **Nuevo plano** | Soltar el PDF o DXF → 3D cocido + revisión + plano → guardar con animación |
| **Comparar** | Dos variantes lado a lado |
| **Ajustes** | Acceso de administrador, familias, tipos, reglas de revisión, conexión |

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
3. Ejecutá **`autorizar`** una vez. Crea la planilla «Extrusión de moldes - Catálogo» dentro de la carpeta de planos y la hoja `Config`.
4. *Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar*. Así se mantiene la URL `/exec` de `config.js`.

### GitHub Pages
Subí `index.html`, `styles.css`, `config.js`, `geo.js`, `revision.js`, `plano.js`, `datos.js`, `visor.js`, `app.js`, `seed.json`, `img/` y este README.

### Navegador
La animación se graba en el navegador. Usá Chrome o Edge en una PC, por https (GitHub Pages ya lo es). Si el navegador no puede grabar video, se guarda solo la imagen.
