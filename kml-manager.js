// kml-manager.js (Gestor Avanzado de Descarga de Capas KML Jerárquicas)

let carpetaNombresPersonalizados = {}; // Para almacenar los nombres editados de las carpetas

// --- 1. ABRIR Y CONFIGURAR EL GESTOR DE KML ---
function abrirGestorKmlManager() {
    const managerPanel = document.getElementById("kml-export-manager-panel");
    if (!managerPanel) {
        showToast("⚠️ No se encontró el panel del Gestor KML en el HTML");
        return;
    }

    if (!currentNominatimElements || currentNominatimElements.length === 0) {
        showToast("⚠️ No hay PDI en el gestor para exportar");
        return;
    }

    // Nombre por defecto sugerido para el archivo
    const inputNombreArchivo = document.getElementById("kml-filename-input");
    if (inputNombreArchivo && !inputNombreArchivo.value) {
        const fechaStr = new Date().toISOString().slice(0, 10);
        inputNombreArchivo.value = `otromundo_capa_${fechaStr}.kml`;
    }

    // Renderizar el árbol de carpetas basado en las categorías actuales
    renderizarArbolCarpetasKml();

    // Mostrar el panel a pantalla completa
    managerPanel.classList.remove("hidden");
    managerPanel.style.display = "flex";
}

function cerrarGestorKmlManager() {
    const managerPanel = document.getElementById("kml-export-manager-panel");
    if (managerPanel) {
        managerPanel.classList.add("hidden");
        managerPanel.style.display = "none";
    }
}

// --- 2. RENDERIZAR EL ÁRBOLES DE CARPETAS INTERACTIVO ---
function renderizarArbolCarpetasKml() {
    const treeContainer = document.getElementById("kml-tree-container");
    if (!treeContainer) return;
    treeContainer.innerHTML = "";

    // Agrupar elementos actuales por su familia madre (key)
    const agrupacion = {};
    currentNominatimElements.forEach(el => {
        if (!el.tags) return;
        let keyMadre = "general";
        const keysPrioritarias = ["amenity", "tourism", "shop", "natural", "historic", "man_made", "leisure", "emergency", "highway"];
        
        for (const k of keysPrioritarias) {
            if (el.tags[k]) {
                keyMadre = k;
                break;
            }
        }

        // Usar el nombre traducido del mapa de familias si existe
        const infoFamilia = (typeof familiaTagsMap !== 'undefined' && familiaTagsMap[keyMadre]) 
            ? familiaTagsMap[keyMadre] 
            : { nombre: keyMadre.charAt(0).toUpperCase() + keyMadre.slice(1), color: "#00e5ff" };

        if (!agrupacion[keyMadre]) {
            agrupacion[keyMadre] = {
                id: keyMadre,
                labelOriginal: infoFamilia.nombre,
                color: infoFamilia.color,
                elementos: []
            };
        }
        agrupacion[keyMadre].elementos.push(el);
    });

    // Construir la vista de árbol en el DOM
    Object.keys(agrupacion).forEach(keyMadre => {
        const grupo = agrupacion[keyMadre];
        const nombreActual = carpetaNombresPersonalizados[keyMadre] || grupo.labelOriginal;

        const folderItem = document.createElement("div");
        folderItem.className = "kml-folder-item";
        folderItem.style.cssText = `
            background: rgba(18, 18, 20, 0.9);
            border: 1px solid rgba(0, 229, 255, 0.2);
            border-left: 4px solid ${grupo.color};
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        `;

        folderItem.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                    <img src="./ui-icons/fi-rr-folder.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%);" alt="Carpeta">
                    <input type="text" class="kml-folder-name-input" data-key="${keyMadre}" value="${nombreActual}" style="background: transparent; border: none; border-bottom: 1px dashed rgba(255,255,255,0.3); color: #fff; font-weight: bold; font-size: 0.9rem; flex: 1; padding: 2px 4px; outline: none;" title="Haz clic para editar el nombre de la carpeta">
                </div>
                <span style="font-size: 0.75rem; color: #aaa; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 12px;">
                    ${grupo.elementos.length} elementos
                </span>
            </div>
            <div style="font-size: 0.75rem; color: #888; padding-left: 24px;">
                Subcategorías incluidas: ${[...new Set(grupo.elementos.map(e => e.tags[keyMadre] || 'varios'))].join(', ')}
            </div>
        `;

        treeContainer.appendChild(folderItem);
    });

    // Escuchar cambios en los inputs de nombres de carpetas en tiempo real
    treeContainer.querySelectorAll('.kml-folder-name-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const key = e.target.getAttribute("data-key");
            carpetaNombresPersonalizados[key] = e.target.value.trim();
        });
    });
}

// --- 3. GENERADOR Y DESCARGA DEL KML JERÁRQUICO MULTICARPETA ---
function ejecutarExportacionKmlJerarquico() {
    const inputNombreArchivo = document.getElementById("kml-filename-input");
    let nombreArchivo = inputNombreArchivo && inputNombreArchivo.value ? inputNombreArchivo.value.trim() : "otromundo_capa.kml";
    if (!nombreArchivo.endsWith(".kml")) nombreArchivo += ".kml";

    // Reagrupar elementos
    const agrupacion = {};
    currentNominatimElements.forEach(el => {
        if (!el.tags) return;
        let keyMadre = "general";
        const keysPrioritarias = ["amenity", "tourism", "shop", "natural", "historic", "man_made", "leisure", "emergency", "highway"];
        for (const k of keysPrioritarias) {
            if (el.tags[k]) {
                keyMadre = k;
                break;
            }
        }
        const infoFamilia = (typeof familiaTagsMap !== 'undefined' && familiaTagsMap[keyMadre]) 
            ? familiaTagsMap[keyMadre] 
            : { nombre: keyMadre };

        if (!agrupacion[keyMadre]) {
            agrupacion[keyMadre] = {
                labelOriginal: infoFamilia.nombre,
                elementos: []
            };
        }
        agrupacion[keyMadre].elementos.push(el);
    });

    // Construir estructura KML oficial con carpetas <Folder>
    let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    kml += `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:om="http://www.oruxmaps.com/oruxmapsextensions/1/0" xmlns:gx="http://www.google.com/kml/ext/2.2">\n`;
    kml += `<Document>\n`;
    kml += `  <name><![CDATA[${nombreArchivo.replace('.kml', '')}]]></name>\n`;

    Object.keys(agrupacion).forEach(keyMadre => {
        const grupo = agrupacion[keyMadre];
        const nombreCarpeta = carpetaNombresPersonalizados[keyMadre] || grupo.labelOriginal;

        kml += `  <Folder>\n`;
        kml += `    <name><![CDATA[${nombreCarpeta}]]></name>\n`;

        grupo.elementos.forEach(poi => {
            const name = poi.tags && poi.tags.name ? poi.tags.name : "Punto sin nombre";
            
            // Construir descripción con datos enriquecidos si los hay
            let descHtml = "";
            if (poi.enriquecido && poi.tagsEnriquecidas) {
                const keysIgnorar = ["display_full", "normalized_name"];
                const entries = [];
                Object.keys(poi.tagsEnriquecidas).forEach(key => {
                    if (keysIgnorar.includes(key)) return;
                    const val = poi.tagsEnriquecidas[key];
                    if (!val) return;
                    entries.push(`${key}: ${val}`);
                });
                descHtml = entries.join("<br/>\n");
            } else {
                descHtml = `osm_id: ${poi.id}<br/>\nname: ${name}`;
            }

            kml += `    <Placemark>\n`;
            kml += `      <name><![CDATA[${name}]]></name>\n`;
            kml += `      <description><![CDATA[${descHtml}\n]]></description>\n`;
            kml += `      <Point>\n`;
            kml += `        <coordinates>${poi.lon},${poi.lat},0</coordinates>\n`;
            kml += `      </Point>\n`;
            kml += `    </Placemark>\n`;
        });

        kml += `  </Folder>\n`;
    });

    kml += `</Document>\n`;
    kml += `</kml>`;

    // Descargar archivo
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("📥 Capa KML jerárquica descargada con éxito");
    cerrarGestorKmlManager();
}
