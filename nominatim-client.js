// nominatim-client.js (Lógica de búsqueda y sincronización bidireccional Listado ⇄ Mapa)

let currentNominatimElements = [];
let selectedNodesMap = new Map();
let activeCategoryName = "";
let activeMapMarkers = [];
let selectedPoiId = null; // Para llevar el control del PDI seleccionado actualmente
let userInteractionHistory = []; // Registro de los últimos clics en checkboxes para rangos consecutivos

function showToast(message, duration = 3000) {
    let existingToast = document.getElementById("debug-toast");
    if (existingToast) existingToast.remove();

    const toast = document.createElement("div");
    toast.id = "debug-toast";
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: #fff;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        border: 1px solid #444;
        text-align: center;
        max-width: 90vw;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast) toast.remove();
    }, duration);
}

document.addEventListener("DOMContentLoaded", () => {
    initNominatimModule();
    initDetailPanelEvents();
    initMapViewButton();
    initHeaderActionButtons();
    initAdvancedOptionsEvents();
});

if (document.readyState === "interactive" || document.readyState === "complete") {
    initNominatimModule();
    initDetailPanelEvents();
    initMapViewButton();
    initHeaderActionButtons();
    initAdvancedOptionsEvents();
}

function initNominatimModule() {
    const btnSearch = document.getElementById("btn-search");

    if (btnSearch) {
        btnSearch.onclick = null;
        
        btnSearch.addEventListener("click", (e) => {
            e.preventDefault();
            
            const latToUse = typeof currentLat !== 'undefined' ? currentLat : 37.3414;
            const lonToUse = typeof currentLon !== 'undefined' ? currentLon : -5.9304;

            ejecutarConsultaNominatim(latToUse, lonToUse);
        });
    } else {
        showToast("Error: No se encontró el botón de búsqueda", 5000);
    }
}

// --- GESTIÓN DE LOS BOTONES Y BARRA DE ACCIONES MASIVAS ---
function initHeaderActionButtons() {
    const btnToggleSearch = document.getElementById("btn-toggle-search");
    const quickSearchContainer = document.getElementById("quick-search-container");
    const quickSearchInput = document.getElementById("quick-search-input");

    if (btnToggleSearch && quickSearchContainer) {
        btnToggleSearch.onclick = (e) => {
            e.preventDefault();
            const isHidden = quickSearchContainer.style.display === "none" || !quickSearchContainer.style.display;
            quickSearchContainer.style.display = isHidden ? "block" : "none";
            if (isHidden && quickSearchInput) {
                quickSearchInput.focus();
            }
        };
    }

    if (quickSearchInput) {
        quickSearchInput.oninput = (e) => {
            const query = e.target.value.toLowerCase().trim();
            filtrarTarjetasPorNombre(query);
        };
    }

    const btnSelectAll = document.getElementById("btn-select-all");
    if (btnSelectAll) {
        btnSelectAll.onclick = (e) => {
            e.preventDefault();
            const checkboxes = document.querySelectorAll(".poi-select-checkbox");
            if (checkboxes.length === 0) return;

            const allChecked = Array.from(checkboxes).every(chk => chk.checked);
            checkboxes.forEach(chk => {
                chk.checked = !allChecked;
            });

            userInteractionHistory = [];
            actualizarBarraAccionesMasivas();
            showToast(allChecked ? "☑️ Todos desmarcados" : "✅ Todos marcados");
        };
    }

    const btnBulkDelete = document.getElementById("btn-bulk-delete");
    if (btnBulkDelete) {
        btnBulkDelete.onclick = (e) => {
            e.preventDefault();
            ejecutarBorradoMasivo();
        };
    }

    const btnBulkRangeUncheck = document.getElementById("btn-bulk-range-uncheck");
    if (btnBulkRangeUncheck) {
        btnBulkRangeUncheck.onclick = (e) => {
            e.preventDefault();
            ejecutarDesmarcadoPorRango();
        };
    }

    const btnDownload = document.getElementById("btn-download-preset");
    if (btnDownload) {
        btnDownload.onclick = (e) => {
            e.preventDefault();
            exportarPdiAKml();
        };
    }
}

// --- FILTRAR TARJETAS POR NOMBRE ---
function filtrarTarjetasPorNombre(query) {
    const cards = document.querySelectorAll(".node-card");
    cards.forEach(card => {
        const nameElement = card.querySelector(".node-name");
        if (nameElement) {
            const nameText = nameElement.textContent.toLowerCase();
            if (nameText.includes(query)) {
                card.style.display = "flex";
            } else {
                card.style.display = "none";
            }
        }
    });
}

// --- ACTUALIZAR BARRA DE ACCIONES MASIVAS ---
function actualizarBarraAccionesMasivas() {
    const bulkBar = document.getElementById("bulk-action-bar");
    const counterText = document.getElementById("bulk-counter-text");
    const checkboxesSeleccionados = document.querySelectorAll(".poi-select-checkbox:checked");

    if (!bulkBar || !counterText) return;

    if (checkboxesSeleccionados.length > 0) {
        bulkBar.style.display = "flex";
        counterText.textContent = `${checkboxesSeleccionados.length} seleccionados`;
    } else {
        bulkBar.style.display = "none";
    }
}

// --- RANGO BIDIRECCIONAL BASADO EN HISTORIAL DE CLICS ---
function ejecutarDesmarcadoPorRango() {
    const checkboxes = Array.from(document.querySelectorAll(".poi-select-checkbox"));
    if (checkboxes.length === 0) return;

    const validHistory = userInteractionHistory.filter(id => {
        return checkboxes.some(chk => parseInt(chk.getAttribute("data-id")) === id);
    });

    if (validHistory.length < 2) {
        showToast("⚠️ Marca o desmarca al menos dos extremos recientes para definir el rango");
        return;
    }

    const id1 = validHistory[validHistory.length - 2];
    const id2 = validHistory[validHistory.length - 1];

    const chk1 = checkboxes.find(c => parseInt(c.getAttribute("data-id")) === id1);
    const chk2 = checkboxes.find(c => parseInt(c.getAttribute("data-id")) === id2);

    if (!chk1 || !chk2) {
        showToast("⚠️ No se pudieron identificar los extremos del rango");
        return;
    }

    const index1 = checkboxes.indexOf(chk1);
    const index2 = checkboxes.indexOf(chk2);

    const minIdx = Math.min(index1, index2);
    const maxIdx = Math.max(index1, index2);

    const actionMark = chk1.checked && chk2.checked;
    const actionUnmark = !chk1.checked && !chk2.checked;

    if (!actionMark && !actionUnmark) {
        showToast("⚠️ Los dos extremos seleccionados deben tener el mismo estado");
        return;
    }

    let contador = 0;
    for (let i = minIdx + 1; i < maxIdx; i++) {
        if (checkboxes[i].checked !== actionMark) {
            checkboxes[i].checked = actionMark;
            contador++;
        }
    }

    actualizarBarraAccionesMasivas();
    showToast(actionMark ? `✨ Rango procesado: ${contador} marcadas` : `✨ Rango procesado: ${contador} desmarcadas`);
}

// --- EJECUTAR BORRADO MASIVO ---
function ejecutarBorradoMasivo() {
    const checkboxesSeleccionados = document.querySelectorAll(".poi-select-checkbox:checked");
    if (checkboxesSeleccionados.length === 0) return;

    if (!confirm(`¿Estás seguro de eliminar los ${checkboxesSeleccionados.length} PDI seleccionados?`)) {
        return;
    }

    checkboxesSeleccionados.forEach(chk => {
        const id = parseInt(chk.getAttribute("data-id"));
        eliminarPoiSilencioso(id);
    });

    userInteractionHistory = [];
    actualizarBarraAccionesMasivas();
    showToast("🗑️ PDI seleccionados eliminados correctamente");

    poblarPanelResultados();

    if (currentNominatimElements.length === 0) {
        ocultarPanelDetalleMapa();
        const existingToolbar = document.getElementById("poi-map-toolbar");
        if (existingToolbar) existingToolbar.remove();
        volverAPanelBusqueda();
    }
}

function eliminarPoiSilencioso(id) {
    currentNominatimElements = currentNominatimElements.filter(el => el.id !== id);
    selectedNodesMap.delete(id);
    userInteractionHistory = userInteractionHistory.filter(item => item !== id);

    const markerObj = activeMapMarkers.find(m => m.id === id);
    if (markerObj) {
        markerObj.marker.remove();
        activeMapMarkers = activeMapMarkers.filter(m => m.id !== id);
    }
}

// --- EXPORTAR A KML ---
function exportarPdiAKml() {
    if (!currentNominatimElements || currentNominatimElements.length === 0) {
        showToast("⚠️ No hay PDI para descargar");
        return;
    }

    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    kmlContent += `<kml xmlns="http://www.opengis.net/kml/2.2">\n`;
    kmlContent += `<Document>\n`;
    kmlContent += `  <name>Otromundo PDI Export</name>\n`;

    currentNominatimElements.forEach(el => {
        const name = el.tags && el.tags.name ? el.tags.name : "Punto sin nombre";
        kmlContent += `  <Placemark>\n`;
        kmlContent += `    <name>${escapeXml(name)}</name>\n`;
        kmlContent += `    <Point>\n`;
        kmlContent += `      <coordinates>${el.lon},${el.lat},0</coordinates>\n`;
        kmlContent += `    </Point>\n`;
        kmlContent += `  </Placemark>\n`;
    });

    kmlContent += `</Document>\n`;
    kmlContent += `</kml>`;

    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `otromundo_pdi_${new Date().toISOString().slice(0, 10)}.kml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("📥 Archivo KML descargado con éxito");
}

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

// --- 1. FUNCIÓN PRINCIPAL DE CONSULTA A NOMINATIM ---
async function ejecutarConsultaNominatim(lat, lon) {
    const checkboxes = document.querySelectorAll(".subcat-checkbox:checked");
    
    if (checkboxes.length === 0) {
        showToast("⚠️ Marca al menos una categoría");
        alert("Por favor, selecciona al menos una categoría o elemento.");
        return;
    }

    let acumularResultados = false;
    if (currentNominatimElements && currentNominatimElements.length > 0) {
        acumularResultados = confirm(
            "¿Deseas acumular estos nuevos PDI con los resultados de la búsqueda anterior?\n\n" +
            "• Aceptar: Sumar los nuevos puntos a los ya existentes.\n" +
            "• Cancelar: Borrar los anteriores y hacer una búsqueda limpia."
        );
    }

    if (!acumularResultados) {
        if (activeMapMarkers && activeMapMarkers.length > 0) {
            activeMapMarkers.forEach(markerObj => markerObj.marker.remove());
            activeMapMarkers = [];
        }
        currentNominatimElements = [];
        selectedNodesMap.clear();
    }

    showToast("Consultando Nominatim API...");

    const radiusSlider = document.getElementById("search-radius");
    const searchRadiusKm = radiusSlider ? parseFloat(radiusSlider.value) : 5.0;
    
    const latDelta = searchRadiusKm / 111.0;
    const lonDelta = searchRadiusKm / (111.0 * Math.cos(lat * (Math.PI / 180)));
    const viewbox = `${lon - lonDelta},${lat + latDelta},${lon + lonDelta},${lat - latDelta}`;

    let searchTerms = [];
    checkboxes.forEach(chk => {
        const val = chk.getAttribute("data-value") || chk.getAttribute("data-val");
        if (val) {
            const terms = val.split(/\||\//);
            terms.forEach(term => {
                let cleanTerm = term.trim();
                if (cleanTerm.includes('=')) {
                    cleanTerm = cleanTerm.split('=')[1].trim();
                }
                if (cleanTerm && !searchTerms.includes(cleanTerm)) {
                    searchTerms.push(cleanTerm);
                }
            });
        }
    });

    if (searchTerms.length === 0) {
        showToast("⚠️ Sin elementos válidos");
        return;
    }

    const totalSelections = searchTerms.length;
    let dynamicLimit = 40;
    if (totalSelections >= 4 && totalSelections <= 8) {
        dynamicLimit = 25;
    } else if (totalSelections > 8) {
        dynamicLimit = 15;
    }

    const maxConcurrent = 6;
    const uniqueTerms = searchTerms.slice(0, maxConcurrent);

    try {
        const promises = uniqueTerms.map(term => {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(term)}&viewbox=${viewbox}&bounded=1&limit=${dynamicLimit}`;
            
            return fetch(url, {
                headers: { 'User-Agent': 'EX-PDI-App/1.0' }
            })
            .then(res => res.json())
            .then(data => Array.isArray(data) ? data : [])
            .catch(err => {
                console.error("Error en fetch de Nominatim para:", term, err);
                return [];
            });
        });

        const resultsArrays = await Promise.all(promises);
        
        const uniqueElementsMap = new Map();
        
        if (acumularResultados && currentNominatimElements) {
            currentNominatimElements.forEach(el => uniqueElementsMap.set(el.id, el));
        }

        resultsArrays.forEach(arr => {
            arr.forEach(item => {
                if (!uniqueElementsMap.has(item.place_id)) {
                    let osmType = "node";
                    if (item.osm_type === "way") osmType = "way";
                    else if (item.osm_type === "relation") osmType = "relation";

                    uniqueElementsMap.set(item.place_id, {
                        id: item.osm_id || item.place_id,
                        osm_type: osmType,
                        type: osmType,
                        lat: parseFloat(item.lat),
                        lon: parseFloat(item.lon),
                        tags: {
                            name: item.display_name ? item.display_name.split(',')[0] : "Punto sin nombre",
                            [item.class || 'amenity']: item.type || 'yes',
                            display_full: item.display_name
                        }
                    });
                }
            });
        });

        let data = Array.from(uniqueElementsMap.values());
        
        if (data.length === 0) {
            showToast("⚠️ No se hallaron PDI en este radio con Nominatim");
            alert("No se han encontrado puntos de interés para los criterios seleccionados en este radio.");
            return;
        }

        currentNominatimElements = data;
        
        selectedNodesMap.clear();
        currentNominatimElements.forEach(el => selectedNodesMap.set(el.id, true));

        showToast(`¡Éxito! Total PDI en gestor: ${currentNominatimElements.length}`);
        mostrarPanelResultados();

    } catch (e) {
        console.error("Error Nominatim API:", e);
        showToast("❌ Error de conexión con Nominatim");
        alert("Ocurrió un error al conectar con la API de Nominatim.");
    }
}

// --- FUNCIÓN DE ENRIQUECIMIENTO DIRECTO DESDE LA API OFICIAL DE OSM ---
async function enriquecerPoiDesdeOSM(poi) {
    const osmType = poi.osm_type || poi.type || 'node';
    const osmId = poi.id;

    if (!osmId) {
        showToast("⚠️ El PDI no tiene un ID de OSM válido");
        return null;
    }

    showToast(`Consultando API oficial de OSM (${osmType}/${osmId})...`);

    const url = `https://api.openstreetmap.org/api/0.6/${osmType}/${osmId}.json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        if (!data.elements || data.elements.length === 0) {
            showToast("⚠️ No se encontraron datos en la API de OSM");
            return null;
        }

        const elementoOsm = data.elements[0];

        poi.tagsEnriquecidas = elementoOsm.tags || {};
        poi.enriquecido = true;

        if (elementoOsm.tags && elementoOsm.tags.name) {
            poi.tags.name = elementoOsm.tags.name;
        }

        if (elementoOsm.lat && elementoOsm.lon) {
            poi.lat = parseFloat(elementoOsm.lat);
            poi.lon = parseFloat(elementoOsm.lon);

            // --- CÁLCULO NATIVO DE PLUS CODE (GLOBAL CODE) ---
            try {
                poi.tagsEnriquecidas["plus_code"] = generarPlusCodeNativo(poi.lat, poi.lon);
            } catch (e) {
                console.error("Error generando Plus Code:", e);
            }
        }

        showToast("✅ Datos obtenidos directamente de OSM");
        return poi.tagsEnriquecidas;

    } catch (error) {
        console.error("Error al consultar la API de OSM:", error);
        showToast("❌ Error al conectar con la API de OSM");
        return null;
    }
}



// --- GESTIÓN DE VISTAS Y PANELES ---
function mostrarPanelResultados() {
    const resultsPanel = document.getElementById("results-panel");
    if (resultsPanel) {
        resultsPanel.style.display = "flex";
    }

    const poiPanel = document.getElementById("poi-fullscreen-panel");
    if (poiPanel) {
        Array.from(poiPanel.children).forEach(child => {
            if (child.id !== "results-panel") {
                child.dataset.originalDisplay = child.style.display;
                child.style.display = "none";
            }
        });
    }

    const badge = document.getElementById("results-badge");
    if (badge) badge.textContent = currentNominatimElements.length;

    poblarPanelResultados();
    initMapViewButton();
}

// --- 2. FUNCIÓN DE RETORNO ---
function volverAPanelBusqueda() {
    document.querySelectorAll(".subcat-checkbox").forEach(chk => chk.checked = false);
    showToast("🔄 Criterios limpios. Tus resultados anteriores siguen guardados.", 4000);

    const resultsPanel = document.getElementById("results-panel");
    if (resultsPanel) {
        resultsPanel.style.display = "none";
    }

    const poiPanel = document.getElementById("poi-fullscreen-panel");
    if (poiPanel) {
        Array.from(poiPanel.children).forEach(child => {
            if (child.id !== "results-panel") {
                child.style.display = child.dataset.originalDisplay || "";
            }
        });
    }
    ocultarPanelDetalleMapa();
    
    const existingToolbar = document.getElementById("poi-map-toolbar");
    if (existingToolbar) existingToolbar.remove();

    const bulkBar = document.getElementById("bulk-action-bar");
    if (bulkBar) bulkBar.style.display = "none";
}

function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// --- ASIGNACIÓN DE COLORES SEGÚN PALETA ORIGINAL DE OSM ---
function obtenerColorPorTag(tags) {
    if (!tags) return "#666666";

    if (tags.amenity === "hospital" || tags.amenity === "pharmacy" || tags.amenity === "clinic" || tags.amenity === "doctors" || tags.healthcare) {
        return "#BF0000";
    }
    if (tags.shop) {
        return "#ac39ac";
    }
    if (tags.aeroway || tags.aerodrome) {
        return "#8461C4";
    }
    if (tags.amenity === "bus_station" || tags.public_transport || tags.railway || tags.highway === "bus_stop") {
        return "#7981b0";
    }
    if (tags.harbour || tags.waterway === "dock" || tags.amenity === "ferry_terminal") {
        return "#576ddf";
    }
    if (tags.office) {
        return "#4863A0";
    }
    if (tags.natural === "water" || tags.amenity === "drinking_water" || tags.natural === "spring" || tags.waterway) {
        return "#4d80b3";
    }
    if (tags.tourism === "hotel" || tags.tourism === "guest_house" || tags.tourism === "hostel" || tags.tourism === "motel" || tags.amenity === "parking" || tags.highway === "services") {
        return "#0092da";
    }
    if (tags.leisure || tags.amenity === "park" || tags.landuse === "grass") {
        return "#0c8316";
    }
    if (tags.natural === "peak" || tags.mountain_pass || tags.geological) {
        return "#d08f55";
    }
    if (tags.amenity === "restaurant" || tags.amenity === "cafe" || tags.amenity === "bar" || tags.amenity === "pub" || tags.amenity === "fast_food" || tags.shop === "bakery" || tags.amenity === "fuel") {
        return "#C77400";
    }
    if (tags.amenity || tags.historic || tags.amenity === "place_of_worship") {
        return "#734a08";
    }
    if (tags.natural === "volcano") {
        return "#d40000";
    }
    if (tags.highway === "traffic_signals") {
        return "#545454";
    }
    if (tags.man_made || tags.advertising) {
        return "#666666";
    }

    return "#734a08";
}

const familiaTagsMap = {
    "amenity": { nombre: "Servicios y Equipamientos", color: "#734a08" },
    "tourism": { nombre: "Turismo y Alojamiento", color: "#0092da" },
    "shop": { nombre: "Comercios", color: "#ac39ac" },
    "natural": { nombre: "Naturaleza y Relieve", color: "#4d80b3" },
    "historic": { nombre: "Lugares Históricos", color: "#734a08" },
    "man_made": { nombre: "Estructuras Artificiales", color: "#666666" },
    "leisure": { nombre: "Ocio y Parques", color: "#0c8316" },
    "emergency": { nombre: "Emergencias", color: "#BF0000" },
    "highway": { nombre: "Vías y Tránsito", color: "#545454" }
};

// --- RENDERIZADO DE CHIPS AGRUPADOS POR FAMILIA MADRE (KEY) ---
function poblarPanelResultados() {
    const chipsContainer = document.getElementById("categories-chips-container");
    const nodesContainer = document.getElementById("nodes-container");
    if (!chipsContainer || !nodesContainer) return;

    chipsContainer.innerHTML = "";
    nodesContainer.innerHTML = "";

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

        const infoFamilia = familiaTagsMap[keyMadre] || { nombre: keyMadre.charAt(0).toUpperCase() + keyMadre.slice(1), color: "#666666" };
        
        if (!agrupacion[keyMadre]) {
            agrupacion[keyMadre] = {
                label: infoFamilia.nombre,
                color: infoFamilia.color,
                elementos: []
            };
        }
        agrupacion[keyMadre].elementos.push(el);
    });

    const familiasDisponibles = Object.keys(agrupacion);
    if (familiasDisponibles.length === 0) {
        nodesContainer.innerHTML = "<p style='padding: 15px; color: #999;'>No se pudieron clasificar los elementos.</p>";
        return;
    }

    activeCategoryName = familiasDisponibles[0];

    familiasDisponibles.forEach(keyMadre => {
        const datosFamilia = agrupacion[keyMadre];
        const nodosList = datosFamilia.elementos;
        const isActive = (keyMadre === activeCategoryName);

        const chip = document.createElement("div");
        chip.className = `category-chip ${isActive ? 'active' : ''}`;
        
        const hex = datosFamilia.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        chip.style.border = `2px solid ${datosFamilia.color}`;
        
        const alphaFondo = isActive ? '0.35' : '0.12';
        chip.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${alphaFondo})`;

        const labelSpan = document.createElement("span");
        labelSpan.textContent = `${datosFamilia.label} (${nodosList.length})`;
        labelSpan.addEventListener("click", () => {
            document.querySelectorAll(".category-chip").forEach(c => {
                c.classList.remove("active");
            });
            chip.classList.add("active");
            activeCategoryName = keyMadre;
            
            document.querySelectorAll(".category-chip").forEach(el => {
                el.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.12)`;
            });
            chip.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.35)`;

            renderizarNodosCategoria(agrupacion[activeCategoryName].elementos);
        });

        chip.appendChild(labelSpan);
        chipsContainer.appendChild(chip);
    });

    renderizarNodosCategoria(agrupacion[activeCategoryName].elementos);

    const btnBackResults = document.getElementById("btn-back-results");
    if (btnBackResults) {
        btnBackResults.onclick = () => volverAPanelBusqueda();
    }
}

// --- RENDERIZADO DE TARJETAS CON CHECKBOX, ACORDEÓN DINÁMICO OCULTO Y BOTONES DE ACCIÓN ---
function renderizarNodosCategoria(nodosList) {
    const nodesContainer = document.getElementById("nodes-container");
    if (!nodesContainer) return;
    nodesContainer.innerHTML = "";

    if (!nodosList || nodosList.length === 0) {
        nodesContainer.innerHTML = "<p style='padding: 15px; color: #999;'>No hay elementos en esta categoría.</p>";
        return;
    }

    const subAgrupacion = {};
    nodosList.forEach(node => {
        let subValor = "otros";
        const keysPrioritarias = ["amenity", "tourism", "shop", "natural", "historic", "man_made", "leisure", "emergency", "highway"];
        
        for (const k of keysPrioritarias) {
            if (node.tags && node.tags[k]) {
                subValor = node.tags[k];
                break;
            }
        }

        if (!subAgrupacion[subValor]) subAgrupacion[subValor] = [];
        subAgrupacion[subValor].push(node);
    });

    Object.keys(subAgrupacion).forEach(subValor => {
        const listaSub = subAgrupacion[subValor];
        
        const headerSub = document.createElement("div");
        headerSub.className = "nodes-subgroup-header";
        headerSub.style.cssText = "padding: 8px 12px; font-size: 0.85rem; font-weight: bold; color: var(--primary-cyan); text-transform: uppercase; background: rgba(0,229,255,0.05); border-bottom: 1px solid var(--border-color); margin-top: 8px;";
        headerSub.textContent = `${subValor.replace(/_/g, ' ')} (${listaSub.length})`;
        nodesContainer.appendChild(headerSub);

        listaSub.forEach(node => {
            const name = node.tags && node.tags.name ? node.tags.name : "Punto sin nombre";
            const ele = node.tags && node.tags.ele ? ` | Ele: ${node.tags.ele}m` : "";
            const distancia = calcularDistanciaKm(currentLat, currentLon, node.lat, node.lon).toFixed(1);
            const colorTag = obtenerColorPorTag(node.tags);

            let accordionHtml = "";
            let infoBtnHtml = "";

            if (node.enriquecido && node.tagsEnriquecidas) {
                const tags = node.tagsEnriquecidas;
                let details = [];
                const keysIgnorar = ["display_full", "normalized_name"];

                Object.keys(tags).forEach(key => {
                    if (keysIgnorar.includes(key)) return;
                    const val = tags[key];
                    if (!val) return;

                    if (key === "phone" || key.includes("contact:phone")) {
                        details.push(`📞 <b>${key}:</b> <a href="tel:${val}" style="color:var(--primary-cyan);">${val}</a>`);
                    } else if (key === "website" || val.toString().startsWith("http")) {
                        details.push(`🌐 <b>${key}:</b> <a href="${val}" target="_blank" style="color:var(--primary-cyan);">${val}</a>`);
                    } else {
                        details.push(`<code>${key}</code>: <b>${val}</b>`);
                    }
                });

                if (details.length === 0) {
                    details.push("ℹ️ Sin etiquetas adicionales en OSM.");
                }

                infoBtnHtml = `
                    <button class="action-btn btn-toggle-info" data-id="${node.id}" title="Ver etiquetas OSM" style="background: rgba(0,229,255,0.1); border: 1px solid var(--primary-cyan); padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px; color: var(--primary-cyan); font-size: 0.8rem;">
                        <img src="./ui-icons/fi-rr-info.svg" width="14" height="14" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%);" alt="Info">
                    </button>
                `;

                accordionHtml = `
                    <div id="info-accordion-${node.id}" class="poi-accordion hidden" style="display: none; background: rgba(0,0,0,0.6); border: 1px solid rgba(0,229,255,0.3); border-radius: 8px; padding: 10px; margin-top: 6px; font-size: 0.8rem; flex-direction: column; gap: 4px; font-family: monospace;">
                        ${details.map(d => `<div style="word-break: break-all;">${d}</div>`).join('')}
                    </div>
                `;
            }

            const card = document.createElement("div");
            card.className = "node-card";
            card.id = `poi-card-${node.id}`;
            card.style.cssText = `
                border-left: 4px solid ${colorTag};
                background: rgba(18,18,20,0.8);
                padding: 12px;
                margin: 8px 12px;
                border-radius: 10px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                transition: background 0.3s ease;
            `;

            card.innerHTML = `
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                        <input type="checkbox" class="poi-select-checkbox" data-id="${node.id}" style="width: 18px; height: 18px; accent-color: var(--primary-cyan); cursor: pointer;" title="Seleccionar para borrado masivo">
                        <div class="node-info" style="flex: 1;">
                            <div class="node-name" style="color: ${colorTag}; font-weight: bold; font-size: 0.95rem;">${name}</div>
                            <div class="node-meta" style="font-size: 0.8rem; color: #aaa; margin-top: 2px;">
                                OSM [<strong>${node.osm_type || node.type || 'node'}</strong>: ${node.id}] | Dist: ${distancia} km${ele}
                            </div>
                        </div>
                    </div>
                </div>
                ${accordionHtml}
                <!-- Botonera simétrica de acciones en la tarjeta -->
                <div style="display: flex; gap: 6px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                    ${infoBtnHtml}
                    <button class="action-btn btn-go-map" data-id="${node.id}" title="Ver en el mapa" style="background: rgba(0,229,255,0.15); border: 1px solid var(--primary-cyan); padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px; color: var(--primary-cyan); font-size: 0.8rem; font-weight: 600;">
                        <img src="./ui-icons/fi-rr-map.svg" width="14" height="14" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%);" alt="Mapa">
                        <span>Mapa</span>
                    </button>
                    <button class="action-btn btn-delete-poi" data-id="${node.id}" title="Eliminar PDI" style="background: rgba(231,76,60,0.15); border: 1px solid #e74c3c; padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px; color: #e74c3c; font-size: 0.8rem;">
                        <img src="./ui-icons/fi-rr-trash.svg" width="14" height="14" style="filter: brightness(0) saturate(100%) invert(43%) sepia(93%) saturate(1352%) hue-rotate(334deg) brightness(97%) contrast(92%);" alt="Borrar">
                    </button>
                    <button class="action-btn btn-options-poi" data-id="${node.id}" title="Más opciones" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px; color: #fff; font-size: 0.8rem;">
                        <img src="./ui-icons/fi-rr-menu-burger.svg" width="14" height="14" style="filter: brightness(0) saturate(100%) invert(100%);" alt="Opciones">
                    </button>
                </div>
            `;

            nodesContainer.appendChild(card);
        });
    });

    nodesContainer.querySelectorAll('.poi-select-checkbox').forEach(chk => {
        chk.addEventListener('change', () => {
            const id = parseInt(chk.getAttribute("data-id"));
            userInteractionHistory = userInteractionHistory.filter(item => item !== id);
            userInteractionHistory.push(id);
            actualizarBarraAccionesMasivas();
        });
    });

    nodesContainer.querySelectorAll('.btn-toggle-info').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            const accordion = document.getElementById(`info-accordion-${id}`);
            if (accordion) {
                const estaOculto = accordion.style.display === "none" || accordion.classList.contains("hidden");
                if (estaOculto) {
                    accordion.style.display = "flex";
                    accordion.classList.remove("hidden");
                } else {
                    accordion.style.display = "none";
                    accordion.classList.add("hidden");
                }
            }
        });
    });

    nodesContainer.querySelectorAll('.btn-go-map').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            centrarEnPoiYMostrarMapa(id);
        });
    });

    nodesContainer.querySelectorAll('.btn-delete-poi').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            eliminarPoi(id);
        });
    });

    nodesContainer.querySelectorAll('.btn-options-poi').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            mostrarOpcionesAvanzadas(id);
        });
    });
}

// --- MOSTRAR RESULTADOS EN EL MAPA PRINCIPAL ---
function mostrarResultadosEnMapa() {
    if (typeof map === 'undefined') return;

    if (!currentNominatimElements || currentNominatimElements.length === 0) {
        showToast("⚠️ No hay elementos para mostrar en el mapa");
        return;
    }

    activeMapMarkers.forEach(marker => marker.remove());
    activeMapMarkers = [];

    const bounds = new maplibregl.LngLatBounds();

    currentNominatimElements.forEach(el => {
        const colorPin = obtenerColorPorTag(el.tags);

        const marker = new maplibregl.Marker({ color: colorPin })
            .setLngLat([el.lon, el.lat])
            .addTo(map);

        marker.getElement().addEventListener('click', (e) => {
            e.stopPropagation();
            seleccionarPoiEnMapa(el);
        });

        activeMapMarkers.push({ id: el.id, marker: marker, data: el });
        bounds.extend([el.lon, el.lat]);
    });

    const poiFullscreenPanel = document.getElementById("poi-fullscreen-panel");
    if (poiFullscreenPanel) poiFullscreenPanel.classList.add("hidden");
    
    const resultsPanel = document.getElementById("results-panel");
    if (resultsPanel) resultsPanel.style.display = "none";

    const mapCursor = document.getElementById("map-center-cursor");
    if (mapCursor) mapCursor.style.display = "none";

    map.fitBounds(bounds, {
        padding: 80,
        maxZoom: 15,
        duration: 1200
    });

    showToast(`Mostrando ${currentNominatimElements.length} PDI en el mapa`);
    crearBotonFlotanteVolverResultados();
}

// --- NUEVA BARRA DE HERRAMIENTAS FLOTANTE EN EL MAPA ---
function crearBotonFlotanteVolverResultados() {
    let existingToolbar = document.getElementById("poi-map-toolbar");
    if (existingToolbar) {
        existingToolbar.remove();
    }

    const toolbar = document.createElement("div");
    toolbar.id = "poi-map-toolbar";
    toolbar.style.cssText = `
        position: fixed;
        bottom: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: #121212;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--primary-cyan);
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 8px 18px;
        border-radius: 36px;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    `;

    toolbar.innerHTML = `
        <button id="toolbar-btn-list" class="tool-btn" title="Volver al listado" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; padding: 4px;">
            <img src="./ui-icons/fi-rr-list.svg" alt="Listado" style="width: 20px; height: 20px; filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%);" />
        </button>
        <button id="toolbar-btn-map" class="tool-btn" title="Capas de Mapa" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; padding: 4px;">
            <img src="./ui-icons/fi-rr-map.svg" alt="Mapa" style="width: 20px; height: 20px; filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%);" />
        </button>
        <button id="toolbar-btn-zoomin" class="tool-btn" title="Acercar" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; padding: 4px;">
            <img src="./ui-icons/fi-rr-zoom-in.svg" alt="Acercar" style="width: 20px; height: 20px; filter: brightness(0) saturate(100%) invert(100%);" />
        </button>
        <button id="toolbar-btn-zoomout" class="tool-btn" title="Alejar" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; padding: 4px;">
            <img src="./ui-icons/fi-rr-zoom-out.svg" alt="Alejar" style="width: 20px; height: 20px; filter: brightness(0) saturate(100%) invert(100%);" />
        </button>
    `;

    document.body.appendChild(toolbar);

    document.getElementById("toolbar-btn-list").addEventListener("click", () => {
        toolbar.remove();
        ocultarPanelDetalleMapa();
        
        const poiPanel = document.getElementById("poi-fullscreen-panel");
        if (poiPanel) poiPanel.classList.remove("hidden");
        
        const resultsPanel = document.getElementById("results-panel");
        if (resultsPanel) resultsPanel.style.display = "flex";

        const mapCursor = document.getElementById("map-center-cursor");
        if (mapCursor) mapCursor.style.display = "block";

        initMapViewButton();
    });

    document.getElementById("toolbar-btn-map").addEventListener("click", () => {
        const layerModal = document.getElementById("layer-selector-modal");
        if (layerModal) layerModal.classList.add("active");
    });

    document.getElementById("toolbar-btn-zoomin").addEventListener("click", () => {
        if (typeof map !== 'undefined') map.zoomIn();
    });

    document.getElementById("toolbar-btn-zoomout").addEventListener("click", () => {
        if (typeof map !== 'undefined') map.zoomOut();
    });
}

// --- GESTIÓN DEL PANEL INFERIOR DE DETALLE EN EL MAPA ---
function seleccionarPoiEnMapa(poi) {
    selectedPoiId = poi.id;
    const panel = document.getElementById("map-poi-detail-panel");
    if (!panel) return;

    const name = poi.tags && poi.tags.name ? poi.tags.name : "Punto sin nombre";
    const distancia = calcularDistanciaKm(currentLat, currentLon, poi.lat, poi.lon).toFixed(1);
    
    let keyMadre = "general";
    const keysPrioritarias = ["amenity", "tourism", "shop", "natural", "historic", "man_made", "leisure", "emergency", "highway"];
    for (const k of keysPrioritarias) {
        if (poi.tags && poi.tags[k]) {
            keyMadre = k;
            break;
        }
    }
    const infoFamilia = familiaTagsMap[keyMadre] || { nombre: keyMadre };

    document.getElementById("detail-poi-category").textContent = infoFamilia.nombre;
    document.getElementById("detail-poi-title").textContent = name;
    document.getElementById("detail-poi-meta").textContent = `Distancia: ${distancia} km | Coordenadas: ${poi.lat.toFixed(4)}, ${poi.lon.toFixed(4)}`;

    // --- GESTIÓN DEL BOTÓN INFO Y ACORDEÓN EN LA BOTONERA DEL PANEL DEL MAPA ---
    const btnInfoMap = document.getElementById("detail-btn-info");
    let mapAccordion = document.getElementById("map-info-accordion");

    // Si no existe el acordeón en el panel del mapa todavía, lo creamos dinámicamente
    if (!mapAccordion) {
        mapAccordion = document.createElement("div");
        mapAccordion.id = "map-info-accordion";
        mapAccordion.className = "poi-accordion hidden";
        mapAccordion.style.cssText = "display: none; background: rgba(0,0,0,0.6); border: 1px solid rgba(0,229,255,0.3); border-radius: 8px; padding: 10px; max-height: 150px; overflow-y: auto; font-size: 0.8rem; flex-direction: column; gap: 4px; font-family: monospace; margin-top: 10px; width: 100%;";
        
        // Lo insertamos justo encima de la botonera del panel
        const metaEl = document.getElementById("detail-poi-meta");
        if (metaEl && metaEl.parentNode) {
            metaEl.parentNode.insertBefore(mapAccordion, metaEl.nextSibling);
        }
    }

    if (poi.enriquecido && poi.tagsEnriquecidas) {
        const tags = poi.tagsEnriquecidas;
        let details = [];
        const keysIgnorar = ["display_full", "normalized_name"];

        Object.keys(tags).forEach(key => {
            if (keysIgnorar.includes(key)) return;
            const val = tags[key];
            if (!val) return;

            if (key === "phone" || key.includes("contact:phone")) {
                details.push(`📞 <b>${key}:</b> <a href="tel:${val}" style="color:var(--primary-cyan);">${val}</a>`);
            } else if (key === "website" || val.toString().startsWith("http")) {
                details.push(`🌐 <b>${key}:</b> <a href="${val}" target="_blank" style="color:var(--primary-cyan);">${val}</a>`);
            } else {
                details.push(`<code>${key}</code>: <b>${val}</b>`);
            }
        });

        if (details.length === 0) {
            details.push("ℹ️ Sin etiquetas adicionales en OSM.");
        }

        mapAccordion.innerHTML = details.map(d => `<div style="word-break: break-all;">${d}</div>`).join('');
        
        if (btnInfoMap) {
            btnInfoMap.style.display = "flex";
            btnInfoMap.onclick = (e) => {
                e.stopPropagation();
                const estaOculto = mapAccordion.style.display === "none" || mapAccordion.classList.contains("hidden");
                if (estaOculto) {
                    mapAccordion.style.display = "flex";
                    mapAccordion.classList.remove("hidden");
                } else {
                    mapAccordion.style.display = "none";
                    mapAccordion.classList.add("hidden");
                }
            };
        }
    } else {
        if (btnInfoMap) btnInfoMap.style.display = "none";
        mapAccordion.style.display = "none";
        mapAccordion.classList.add("hidden");
        mapAccordion.innerHTML = "";
    }
    // --------------------------------------------------------------------------

    panel.style.display = "flex";

    const toolbar = document.getElementById("poi-map-toolbar");
    if (toolbar) toolbar.style.display = "none";

    map.flyTo({
        center: [poi.lon, poi.lat],
        zoom: 16,
        duration: 1000
    });
}

function ocultarPanelDetalleMapa() {
    const panel = document.getElementById("map-poi-detail-panel");
    if (panel) {
        panel.style.display = "none";
    }

    // Ocultar también el acordeón del mapa al cerrar el panel
    const mapAccordion = document.getElementById("map-info-accordion");
    if (mapAccordion) {
        mapAccordion.style.display = "none";
        mapAccordion.classList.add("hidden");
    }

    const toolbar = document.getElementById("poi-map-toolbar");
    if (toolbar && currentNominatimElements.length > 0) {
        const resultsPanel = document.getElementById("results-panel");
        if (resultsPanel && resultsPanel.style.display === "none") {
            toolbar.style.display = "flex";
        }
    } else if (!toolbar && currentNominatimElements.length > 0) {
        const resultsPanel = document.getElementById("results-panel");
        if (resultsPanel && resultsPanel.style.display === "none") {
            crearBotonFlotanteVolverResultados();
        }
    }
    
    selectedPoiId = null;
}

function initDetailPanelEvents() {
    const btnClose = document.getElementById("detail-btn-close");
    if (btnClose) {
        btnClose.addEventListener("click", () => {
            ocultarPanelDetalleMapa();
        });
    }

    const btnAction = document.getElementById("detail-btn-action");
    if (btnAction) {
        btnAction.addEventListener("click", () => {
            if (!selectedPoiId) return;
            const targetId = selectedPoiId;

            ocultarPanelDetalleMapa();
            const toolbar = document.getElementById("poi-map-toolbar");
            if (toolbar) toolbar.remove();

            const poiPanel = document.getElementById("poi-fullscreen-panel");
            if (poiPanel) poiPanel.classList.remove("hidden");
            
            const resultsPanel = document.getElementById("results-panel");
            if (resultsPanel) resultsPanel.style.display = "flex";

            const mapCursor = document.getElementById("map-center-cursor");
            if (mapCursor) mapCursor.style.display = "block";

            initMapViewButton();

            setTimeout(() => {
                const card = document.getElementById(`poi-card-${targetId}`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.style.background = 'rgba(0,229,255,0.25)';
                    setTimeout(() => {
                        card.style.background = 'rgba(18,18,20,0.8)';
                    }, 1500);
                }
            }, 200);
        });
    }

    const btnDelete = document.getElementById("detail-btn-delete");
    if (btnDelete) {
        btnDelete.addEventListener("click", () => {
            if (!selectedPoiId) return;
            eliminarPoi(selectedPoiId);
            ocultarPanelDetalleMapa();
        });
    }

    const btnOptions = document.getElementById("detail-btn-options");
    if (btnOptions) {
        btnOptions.addEventListener("click", () => {
            if (!selectedPoiId) return;
            mostrarOpcionesAvanzadas(selectedPoiId);
        });
    }
}

function centrarEnPoiYMostrarMapa(id) {
    const poi = currentNominatimElements.find(el => el.id === id);
    if (!poi) return;

    if (!activeMapMarkers || activeMapMarkers.length === 0) {
        if (typeof map !== 'undefined' && currentNominatimElements.length > 0) {
            activeMapMarkers = [];
            currentNominatimElements.forEach(el => {
                const colorPin = obtenerColorPorTag(el.tags);
                const marker = new maplibregl.Marker({ color: colorPin })
                    .setLngLat([el.lon, el.lat])
                    .addTo(map);

                marker.getElement().addEventListener('click', (e) => {
                    e.stopPropagation();
                    seleccionarPoiEnMapa(el);
                });

                activeMapMarkers.push({ id: el.id, marker: marker, data: el });
            });
        }
    }

    const resultsPanel = document.getElementById("results-panel");
    if (resultsPanel) resultsPanel.style.display = "none";

    const poiFullscreenPanel = document.getElementById("poi-fullscreen-panel");
    if (poiFullscreenPanel) poiFullscreenPanel.classList.add("hidden");

    const mapCursor = document.getElementById("map-center-cursor");
    if (mapCursor) mapCursor.style.display = "none";

    map.flyTo({
        center: [poi.lon, poi.lat],
        zoom: 16,
        duration: 1200
    });

    seleccionarPoiEnMapa(poi);
    crearBotonFlotanteVolverResultados();
    const toolbar = document.getElementById("poi-map-toolbar");
    if (toolbar) toolbar.style.display = "none";
}

function eliminarPoi(id) {
    currentNominatimElements = currentNominatimElements.filter(el => el.id !== id);
    selectedNodesMap.delete(id);
    userInteractionHistory = userInteractionHistory.filter(item => item !== id);

    const markerObj = activeMapMarkers.find(m => m.id === id);
    if (markerObj) {
        markerObj.marker.remove();
        activeMapMarkers = activeMapMarkers.filter(m => m.id !== id);
    }

    const card = document.getElementById(`poi-card-${id}`);
    if (card) card.remove();

    const badge = document.getElementById("results-badge");
    if (badge) badge.textContent = currentNominatimElements.length;

    actualizarBarraAccionesMasivas();
    showToast("🗑️ PDI eliminado correctamente");

    if (currentNominatimElements.length === 0) {
        ocultarPanelDetalleMapa();
        const toolbar = document.getElementById("poi-map-toolbar");
        if (toolbar) toolbar.remove();
        volverAPanelBusqueda();
    }
}

function initMapViewButton() {
    const btnShowMapView = document.getElementById("btn-show-map-view");
    if (btnShowMapView) {
        const nuevoBtn = btnShowMapView.cloneNode(true);
        btnShowMapView.parentNode.replaceChild(nuevoBtn, btnShowMapView);

        nuevoBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const existingToolbar = document.getElementById("poi-map-toolbar");
            if (existingToolbar) existingToolbar.remove();
            
            mostrarResultadosEnMapa();
        });
    }
}

// --- GESTIÓN DEL PANEL DE OPCIONES AVANZADAS Y ACCIONES DIRECTAS ---
let currentAdvancedPoiId = null;

// --- FUNCIÓN AUXILIAR INTELIGENTE PARA DETECTAR MONTAÑA / PANORÁMICA ---
function esPuntoDeMontanaOPanoramico(poi) {
    if (!poi || !poi.tags) return false;
    
    // 1. Relieve, picos, volcanes, cuevas, etc. (basado en 'Nature and Orography')
    const naturalTag = poi.tags.natural;
    const isNaturalPeakOrRelief = (
        naturalTag === 'peak' || 
        naturalTag === 'volcano' || 
        naturalTag === 'geyser' || 
        naturalTag === 'cave_entrance' || 
        naturalTag === 'cliff' ||
        naturalTag === 'rock' ||
        naturalTag === 'sinkhole' ||
        poi.tags.mountain_pass === 'yes' ||
        poi.tags['mountain_pass'] === true
    );

    // 2. Refugios de altura y miradores (basado en 'Tourism and Culture')
    const tourismTag = poi.tags.tourism;
    const isMountainTourism = (
        tourismTag === 'alpine_hut' || 
        tourismTag === 'wilderness_hut' || 
        tourismTag === 'viewpoint'
    );

    // 3. Vértices geodésicos (basado en 'Infrastructure and Man-Made')
    const manMadeTag = poi.tags.man_made;
    const isSurveyPoint = (manMadeTag === 'survey_point');

    return isNaturalPeakOrRelief || isMountainTourism || isSurveyPoint;
}

function mostrarOpcionesAvanzadas(id) {
    const poi = currentNominatimElements.find(el => el.id === id);
    if (!poi) return;
    currentAdvancedPoiId = id;

    const titleEl = document.getElementById("advanced-poi-title");
    if (titleEl) {
        const name = poi.tags && poi.tags.name ? poi.tags.name : "Punto sin nombre";
        titleEl.textContent = name;
    }

    // --- DETECCIÓN INTELIGENTE ---
    const usePeakFinder = esPuntoDeMontanaOPanoramico(poi);

    const btnStreetView = document.getElementById("adv-btn-streetview");
    if (btnStreetView) {
        const iconEl = btnStreetView.querySelector(".control-icon");
        const titleCardEl = btnStreetView.querySelector(".control-card-title");

        if (usePeakFinder) {
            btnStreetView.title = "Ver en PeakFinder";
            if (iconEl) iconEl.src = "./ui-icons/fi-rr-mountains.svg";
            if (titleCardEl) titleCardEl.textContent = "Abrir en PeakFinder";
        } else {
            btnStreetView.title = "Ver en Street View";
            if (iconEl) iconEl.src = "./ui-icons/fi-rr-street-view.svg";
            if (titleCardEl) titleCardEl.textContent = "Abrir en Street View (Google Maps)";
        }
    }

    const panel = document.getElementById("advanced-options-panel");
    if (panel) panel.classList.remove("hidden");
}

function initAdvancedOptionsEvents() {
    const btnClose = document.getElementById("btn-close-advanced");
    if (btnClose) {
        btnClose.addEventListener("click", () => {
            const panel = document.getElementById("advanced-options-panel");
            if (panel) panel.classList.add("hidden");
            currentAdvancedPoiId = null;
        });
    }

    const btnShare = document.getElementById("adv-btn-share");
    if (btnShare) {
        btnShare.addEventListener("click", () => {
            const poi = currentNominatimElements.find(el => el.id === currentAdvancedPoiId);
            if (!poi) return;
            
            const name = poi.tags && poi.tags.name ? poi.tags.name : "Punto de Interés";
            
            // Construir la descripción con los datos enriquecidos si los hay
            let descText = "";
            if (poi.enriquecido && poi.tagsEnriquecidas) {
                const keysIgnorar = ["display_full", "normalized_name"];
                const entries = [];
                Object.keys(poi.tagsEnriquecidas).forEach(key => {
                    if (keysIgnorar.includes(key)) return;
                    const val = poi.tagsEnriquecidas[key];
                    if (!val) return;
                    entries.push(`${key}: ${val}`);
                });
                if (entries.length > 0) {
                    descText = `Descripción del waypoint:\n${entries.join("\n")}\n\n`;
                }
            }

            // Enlaces de mapas
            const gmaps = `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lon}`;
            const amaps = `http://maps.apple.com/?q=${poi.lat},${poi.lon}`;
            const oruxmaps = `https://oruxmaps.com/position?q=${poi.lat},${poi.lon}`;
            const geoUri = `geo:${poi.lat},${poi.lon}?q=${poi.lat},${poi.lon}`;

            // Texto final estructurado
            const text = `Otro Mundo 🌎 posición compartida\n\n` +
                         `Nombre del waypoint: ${name}\n\n` +
                         descText +
                         `${geoUri}\n` +
                         `Google Maps: ${gmaps}\n` +
                         `Apple Maps: ${amaps}\n` +
                         `OruxMaps: ${oruxmaps}`;
            
            if (navigator.share) {
                navigator.share({ title: name, text: text }).catch(() => {});
            } else {
                navigator.clipboard.writeText(text);
                showToast("📋 Información copiada al portapapeles");
            }
        });
    }

    const btnNativeShare = document.getElementById("adv-btn-native-share");
    if (btnNativeShare) {
        btnNativeShare.addEventListener("click", () => {
            const poi = currentNominatimElements.find(el => el.id === currentAdvancedPoiId);
            if (!poi) return;
            window.location.href = `geo:${poi.lat},${poi.lon}?q=${poi.lat},${poi.lon}`;
        });
    }

    const btnStreetView = document.getElementById("adv-btn-streetview");
    if (btnStreetView) {
        btnStreetView.addEventListener("click", () => {
            const poi = currentNominatimElements.find(el => el.id === currentAdvancedPoiId);
            if (!poi) return;
            
            const usePeakFinder = esPuntoDeMontanaOPanoramico(poi);
            
            if (usePeakFinder) {
                let ele = 0;
                if (poi.tags && poi.tags.ele) {
                    ele = parseFloat(poi.tags.ele) || 0;
                } else if (poi.tagsEnriquecidas && poi.tagsEnriquecidas.ele) {
                    ele = parseFloat(poi.tagsEnriquecidas.ele) || 0;
                }
                
                const url = `https://www.peakfinder.org/es?lat=${poi.lat}&lng=${poi.lon}&ele=${ele}`;
                window.open(url, '_blank');
            } else {
                const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${poi.lat},${poi.lon}`;
                window.open(url, '_blank');
            }
        });
    }

    const btnEnrich = document.getElementById("adv-btn-enrich");
    if (btnEnrich) {
        btnEnrich.addEventListener("click", async () => {
            const poi = currentNominatimElements.find(el => el.id === currentAdvancedPoiId);
            if (!poi) return;
            
            const tagsEnriquecidas = await enriquecerPoiDesdeOSM(poi);
            if (tagsEnriquecidas) {
                const panel = document.getElementById("advanced-options-panel");
                if (panel) panel.classList.add("hidden");
                
                poblarPanelResultados();
                
                // Refrescar el panel inferior del mapa al instante si este PDI está seleccionado
                if (selectedPoiId === poi.id) {
                    seleccionarPoiEnMapa(poi);
                }
                
                setTimeout(() => {
                    const card = document.getElementById(`poi-card-${poi.id}`);
                    if (card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        card.style.background = 'rgba(0,229,255,0.2)';
                        setTimeout(() => { card.style.background = 'rgba(18,18,20,0.8)'; }, 1500);
                    }
                }, 200);
            }
        });
    }

    const btnViewOsm = document.getElementById("adv-btn-view-osm");
    if (btnViewOsm) {
        btnViewOsm.addEventListener("click", () => {
            const poi = currentNominatimElements.find(el => el.id === currentAdvancedPoiId);
            if (!poi) return;
            const elementType = poi.osm_type || poi.type || "node";
            const url = `https://www.openstreetmap.org/${elementType}/${poi.id}`;
            window.open(url, '_blank');
        });
    }

    const btnEdit = document.getElementById("adv-btn-edit");
    if (btnEdit) {
        btnEdit.addEventListener("click", () => {
            const poi = currentNominatimElements.find(el => el.id === currentAdvancedPoiId);
            if (!poi) return;
            const elementType = poi.osm_type || poi.type || "node";
            const url = `https://www.openstreetmap.org/edit?${elementType}=${poi.id}`;
            window.open(url, '_blank');
        });
    }

    const btnDownloadKml = document.getElementById("adv-btn-download-kml");
    if (btnDownloadKml) {
        btnDownloadKml.addEventListener("click", () => {
            const poi = currentNominatimElements.find(el => el.id === currentAdvancedPoiId);
            if (!poi) return;
            exportarPoiIndividualAKml(poi);
        });
    }
}



// --- EXPORTAR PDI INDIVIDUAL A KML (ESTILO ORUXMAPS) ---
function exportarPoiIndividualAKml(poi) {
    const name = poi.tags && poi.tags.name ? poi.tags.name : "Punto sin nombre";
    
    // Construir el bloque de descripción línea a línea con <br/>
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
        // Si no está enriquecido previamente, añadimos los datos básicos que tenemos
        descHtml = `osm_id: ${poi.id}<br/>\nname: ${name}`;
    }

    let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    kml += `<kml xmlns="http://earth.google.com/kml/2.2" xmlns:om="http://www.oruxmaps.com/oruxmapsextensions/1/0" xmlns:gx="http://www.google.com/kml/ext/2.2">\n`;
    kml += `<Document>\n`;
    kml += `  <name><![CDATA[${name}]]></name>\n`;
    kml += `  <Folder>\n`;
    kml += `    <name>Waypoints</name>\n`;
    kml += `    <Placemark>\n`;
    kml += `      <name><![CDATA[${name}]]></name>\n`;
    kml += `      <description><![CDATA[${descHtml}\n]]></description>\n`;
    kml += `      <Point>\n`;
    kml += `        <coordinates>${poi.lon},${poi.lat},0</coordinates>\n`;
    kml += `      </Point>\n`;
    kml += `    </Placemark>\n`;
    kml += `  </Folder>\n`;
    kml += `</Document>\n`;
    kml += `</kml>`;

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.kml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("📥 KML individual descargado");
}



// --- ALGORITMO NATIVO PARA GENERAR PLUS CODES (OPEN LOCATION CODE) ---
function generarPlusCodeNativo(lat, lon) {
    const CODE_ALPHABET = "23456789CFGHJMPQRVWX";
    let adjustedLat = Math.max(-90, Math.min(90, lat));
    let adjustedLon = ((lon + 180) % 360 + 360) % 360 - 180;

    adjustedLat += 90;
    adjustedLon += 180;

    let code = "";
    
    // Pares de alta resolución (dígitos globales)
    const latResolutions = [20, 1, 0.05, 0.0025, 0.000125];
    const lonResolutions = [20, 1, 0.05, 0.0025, 0.000125];

    let latVal = adjustedLat;
    let lonVal = adjustedLon;

    for (let i = 0; i < 5; i++) {
        let latDigit = Math.floor(latVal / latResolutions[i]);
        let lonDigit = Math.floor(lonVal / lonResolutions[i]);
        
        latVal -= latDigit * latResolutions[i];
        lonVal -= lonDigit * lonResolutions[i];

        code += CODE_ALPHABET[Math.min(latDigit, 19)] + CODE_ALPHABET[Math.min(lonDigit, 19)];
        
        if (i === 3) {
            code += "+";
        }
    }

    // Refinamiento por grilla (4x5)
    const gridRows = 4;
    const gridCols = 5;
    let latGridRes = 0.000125;
    let lonGridRes = 0.000125;

    let latDigitGrid = Math.floor(latVal / (latGridRes / gridRows));
    let lonDigitGrid = Math.floor(lonVal / (lonGridRes / gridCols));
    
    let gridIndex = latDigitGrid * gridCols + lonDigitGrid;
    code += CODE_ALPHABET[Math.min(gridIndex, 19)];

    return code;
}
