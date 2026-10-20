// nominatim-client.js (Lógica de búsqueda y sincronización bidireccional Listado ⇄ Mapa)

let currentNominatimElements = [];
let selectedNodesMap = new Map();
let activeCategoryName = "";
let activeMapMarkers = [];
let selectedPoiId = null; // Para llevar el control del PDI seleccionado actualmente

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
});

if (document.readyState === "interactive" || document.readyState === "complete") {
    initNominatimModule();
    initDetailPanelEvents();
    initMapViewButton();
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

// --- 1. FUNCIÓN PRINCIPAL DE CONSULTA A NOMINATIM (Actualizada con opción de acumular) ---
async function ejecutarConsultaNominatim(lat, lon) {
    const checkboxes = document.querySelectorAll(".subcat-checkbox:checked");
    
    if (checkboxes.length === 0) {
        showToast("⚠️ Marca al menos una categoría");
        alert("Por favor, selecciona al menos una categoría o elemento.");
        return;
    }

    // Comprobamos si ya existen resultados previos para preguntar al usuario
    let acumularResultados = false;
    if (currentNominatimElements && currentNominatimElements.length > 0) {
        acumularResultados = confirm(
            "¿Deseas acumular estos nuevos PDI con los resultados de la búsqueda anterior?\n\n" +
            "• Aceptar: Sumar los nuevos puntos a los ya existentes.\n" +
            "• Cancelar: Borrar los anteriores y hacer una búsqueda limpia."
        );
    }

    // Si el usuario decide NO acumular, limpiamos los datos y marcadores viejos del mapa
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
        
        // Mapa para fusionar o almacenar resultados evitando duplicados (place_id)
        const uniqueElementsMap = new Map();
        
        // Si decidió acumular, reinsertamos los elementos que ya teníamos en memoria
        if (acumularResultados && currentNominatimElements) {
            currentNominatimElements.forEach(el => uniqueElementsMap.set(el.id, el));
        }

        // Añadimos los nuevos resultados obtenidos de la API
        resultsArrays.forEach(arr => {
            arr.forEach(item => {
                if (!uniqueElementsMap.has(item.place_id)) {
                    uniqueElementsMap.set(item.place_id, {
                        id: item.place_id,
                        type: "node",
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
        alert("Ocurrió un error al conectar con la API de Nominatim. Prueba a reducir el radio.");
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
    initMapViewButton(); // Aseguramos que el botón superior responda siempre
}

// --- 2. FUNCIÓN DE RETORNO (Actualizada con limpieza automática de checkboxes) ---
function volverAPanelBusqueda() {
    // Desmarcamos automáticamente todos los checkboxes para dejar limpia la interfaz
    document.querySelectorAll(".subcat-checkbox").forEach(chk => chk.checked = false);
    
    // Informamos al usuario de forma visual
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

// --- RENDERIZADO DE TARJETAS CON LOS 3 BOTONES DE ACCIÓN ---
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
                <div class="node-info">
                    <div class="node-name" style="color: ${colorTag}; font-weight: bold; font-size: 0.95rem;">${name}</div>
                    <div class="node-meta" style="font-size: 0.8rem; color: #aaa; margin-top: 2px;">Dist: ${distancia} km${ele} | Lat/Lon: ${node.lat.toFixed(4)}, ${node.lon.toFixed(4)}</div>
                </div>
                <!-- Botonera simétrica de 3 acciones en la tarjeta -->
                <div style="display: flex; gap: 6px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
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

    // Vincular eventos de los botones de cada tarjeta
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

    // --- ACCIONES DE LOS BOTONES DE LA BARRA ---
    document.getElementById("toolbar-btn-list").addEventListener("click", () => {
        toolbar.remove();
        ocultarPanelDetalleMapa();
        
        const poiPanel = document.getElementById("poi-fullscreen-panel");
        if (poiPanel) poiPanel.classList.remove("hidden");
        
        const resultsPanel = document.getElementById("results-panel");
        if (resultsPanel) resultsPanel.style.display = "flex";

        const mapCursor = document.getElementById("map-center-cursor");
        if (mapCursor) mapCursor.style.display = "block";

        // Re-vinculamos el botón general para que nunca pierda interactividad al volver
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

// Inicializar eventos de los botones del panel inferior de detalle en el mapa
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

            // Re-vinculamos el botón general también al volver desde el detalle
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

// --- CONEXIÓN BIDIRECCIONAL: CENTRAR DESDE LA LISTA ---
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

// --- ELIMINAR PDI ---
function eliminarPoi(id) {
    currentNominatimElements = currentNominatimElements.filter(el => el.id !== id);
    selectedNodesMap.delete(id);

    const markerObj = activeMapMarkers.find(m => m.id === id);
    if (markerObj) {
        markerObj.marker.remove();
        activeMapMarkers = activeMapMarkers.filter(m => m.id !== id);
    }

    const card = document.getElementById(`poi-card-${id}`);
    if (card) card.remove();

    const badge = document.getElementById("results-badge");
    if (badge) badge.textContent = currentNominatimElements.length;

    showToast("🗑️ PDI eliminado correctamente");

    if (currentNominatimElements.length === 0) {
        ocultarPanelDetalleMapa();
        const toolbar = document.getElementById("poi-map-toolbar");
        if (toolbar) toolbar.remove();
        volverAPanelBusqueda();
    }
}

// --- MENÚ DE MÁS OPCIONES ---
function mostrarOpcionesAvanzadas(id) {
    const poi = currentNominatimElements.find(el => el.id === id);
    if (!poi) return;
    const name = poi.tags && poi.tags.name ? poi.tags.name : "Punto";
    alert(`Opciones avanzadas para: ${name}\nCoordenadas: ${poi.lat.toFixed(5)}, ${poi.lon.toFixed(5)}`);
}

// --- VINCULACIÓN ROBUSTA DEL BOTÓN DE MAPA EN EL PANEL DE RESULTADOS ---
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
