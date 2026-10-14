// overpass-client.js

let currentOverpassElements = [];
let selectedNodesMap = new Map();
let activeCategoryName = "";

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
    initOverpassModule();
});

if (document.readyState === "interactive" || document.readyState === "complete") {
    initOverpassModule();
}

function initOverpassModule() {
    const btnSearch = document.getElementById("btn-search");

    if (btnSearch) {
        btnSearch.onclick = null;
        
        btnSearch.addEventListener("click", (e) => {
            e.preventDefault();
            
            const latToUse = typeof currentLat !== 'undefined' ? currentLat : 37.3414;
            const lonToUse = typeof currentLon !== 'undefined' ? currentLon : -5.9304;

            ejecutarConsultaOverpass(latToUse, lonToUse);
        });
    } else {
        showToast("Error: No se encontró el botón de búsqueda", 5000);
    }
}

// --- FUNCIÓN OVERPASS OPTIMIZADA CON KEY=VALUE DIRECTO (Nodos y Vías) ---
async function ejecutarConsultaOverpass(lat, lon) {
    showToast("Consultando Overpass API...");

    const radiusSlider = document.getElementById("search-radius");
    const radiusKm = radiusSlider ? parseInt(radiusSlider.value, 10) : 5;
    const radiusMeters = Math.min(radiusKm * 1000, 15000);

    const checkboxes = document.querySelectorAll(".subcat-checkbox:checked");
    
    if (checkboxes.length === 0) {
        showToast("⚠️ Marca al menos una categoría");
        alert("Por favor, selecciona al menos una categoría o elemento.");
        return;
    }

    let unionParts = [];
    checkboxes.forEach(chk => {
        const key = chk.getAttribute("data-key");
        const value = chk.getAttribute("data-value");
        
        if (key && value) {
            unionParts.push(`node(around:${radiusMeters}, ${lat}, ${lon})["${key}"="${value}"];`);
            unionParts.push(`way(around:${radiusMeters}, ${lat}, ${lon})["${key}"="${value}"];`);
        }
    });

    if (unionParts.length === 0) {
        showToast("⚠️ Sin etiquetas de mapeo válidas");
        alert("Los elementos seleccionados no tienen etiquetas de mapeo válidas.");
        return;
    }

    const overpassQuery = `
        [out:json][timeout:25];
        (
            ${unionParts.join("\n")}
        );
        out body center;
    `;

    try {
        const res = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: overpassQuery
        });

        if (!res.ok) {
            throw new Error(`Error HTTP: ${res.status}`);
        }

        const data = await res.json();
        
        if (!data.elements || data.elements.length === 0) {
            showToast("⚠️ No se hallaron PDI en este radio");
            alert("No se han encontrado puntos de interés para los criterios seleccionados en este radio.");
            return;
        }

        currentOverpassElements = data.elements.filter(el => 
            (el.type === "node" && el.lat && el.lon) || 
            (el.type === "way" && el.center && el.center.lat && el.center.lon)
        ).map(el => {
            if (el.type === "way" && el.center) {
                return { ...el, lat: el.center.lat, lon: el.center.lon };
            }
            return el;
        });
        
        selectedNodesMap.clear();
        currentOverpassElements.forEach(el => selectedNodesMap.set(el.id, true));

        showToast(`¡Éxito! ${currentOverpassElements.length} PDI encontrados`);
        mostrarPanelResultados();

    } catch (e) {
        console.error("Error en Overpass API:", e);
        showToast("❌ Error de conexión con Overpass");
        alert("Ocurrió un error al conectar con la API de Overpass. Prueba a reducir el radio o desmarcar algunas categorías.");
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
    if (badge) badge.textContent = currentOverpassElements.length;

    poblarPanelResultados();
}

function volverAPanelBusqueda() {
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

// Diccionario de traducción para las "Keys" madre principales de OSM
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
    
    currentOverpassElements.forEach(el => {
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
        
        // Convertimos el color HEX de la familia a RGBA para darle la transparencia
        const hex = datosFamilia.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // Borde completo con el color de la familia
        chip.style.border = `2px solid ${datosFamilia.color}`;
        
        // Fondo translúcido dinámico según si está activo o no
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
            
            // Actualizamos los fondos de todos los chips al hacer clic
            document.querySelectorAll(".category-chip").forEach(el => {
                // Buscamos su color original o aplicamos fondo base
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


// --- RENDERIZADO CON SUB-BLOQUES / ENCABEZADOS POR VALOR (Nombre original restaurado) ---
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
            card.style.borderLeft = `4px solid ${colorTag}`;
            card.innerHTML = `
                <div class="node-info">
                    <div class="node-name" style="color: ${colorTag};">${name}</div>
                    <div class="node-meta">Dist: ${distancia} km${ele} | Lat/Lon: ${node.lat.toFixed(4)}, ${node.lon.toFixed(4)}</div>
                </div>
            `;
            nodesContainer.appendChild(card);
        });
    });
}
