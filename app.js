// app.js - Gestión de POIs y control flotante de radio sobre mapa principal

let currentLat = 37.3414; 
let currentLon = -5.9304;
let currentAreaValue = 78.5;

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Coordenadas iniciales desde URL si existen
    const urlParams = new URLSearchParams(window.location.search);
    currentLat = parseFloat(urlParams.get("lat")) || 37.3414;
    currentLon = parseFloat(urlParams.get("lon")) || -5.9304;

    // 2. Cargar perfil inicial de categorías (Senderismo)
    if (typeof cargarPerfilJSON === 'function') {
        cargarPerfilJSON("hiking");
    }

        // 3. Pestañas de perfiles
    const tabs = document.querySelectorAll(".profile-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            // Restablecer el interruptor de expandir al cambiar de perfil
            const toggleExpandAll = document.getElementById("toggle-expand-all");
            if (toggleExpandAll) toggleExpandAll.checked = false;

            const perfil = tab.getAttribute("data-profile");
            if (typeof cargarPerfilJSON === 'function') {
                cargarPerfilJSON(perfil);
            }
        });
    });


    // 4. Lógica de la ventana flotante inferior de ajuste espacial
    const btnOpenModal = document.getElementById("btn-open-spatial-modal");
    const spatialModal = document.getElementById("spatial-adjustment-modal");
    const btnCloseModal = document.getElementById("btn-close-spatial-modal");
    const btnConfirmSpatial = document.getElementById("btn-confirm-spatial");
    
    const modalRadiusSlider = document.getElementById("modal-search-radius");
    const modalRadiusValueSpan = document.getElementById("modal-radius-value");
    const modalInfoArea = document.getElementById("modal-info-area");
    
    // Elementos de la interfaz principal a ocultar durante el ajuste
    const mapCursor = document.getElementById("map-center-cursor");
    const topLeftBanner = document.getElementById("top-left-banner");

    // Mantener sincronizado el valor del input oculto principal por si Overpass lo lee
    let hiddenRadiusInput = document.getElementById("search-radius");
    if (!hiddenRadiusInput) {
        hiddenRadiusInput = document.createElement("input");
        hiddenRadiusInput.type = "hidden";
        hiddenRadiusInput.id = "search-radius";
        hiddenRadiusInput.value = "5";
        document.body.appendChild(hiddenRadiusInput);
    }

    function actualizarCalculosModal(r, ajustarZoom = false) {
        const radioNum = parseFloat(r) || 5;
        if (modalRadiusValueSpan) modalRadiusValueSpan.innerText = radioNum;
        currentAreaValue = Math.PI * Math.pow(radioNum, 2);
        if (modalInfoArea) modalInfoArea.innerText = `Superficie: ${currentAreaValue.toFixed(1)} km²`;
        
        hiddenRadiusInput.value = radioNum;

        // Actualizar círculo y encuadre en el mapa principal
        if (typeof map !== 'undefined') {
            actualizarCirculoRadioEnMapaPrincipal(radioNum, ajustarZoom);
        }
    }

    if (modalRadiusSlider) {
        modalRadiusSlider.addEventListener("input", (e) => {
            actualizarCalculosModal(e.target.value, true);
        });
    }

    if (btnOpenModal && spatialModal) {
        btnOpenModal.addEventListener("click", () => {
            const poiPanel = document.getElementById("poi-fullscreen-panel");
            if (poiPanel) poiPanel.classList.add("hidden"); // Ocultar panel POIs
            spatialModal.classList.remove("hidden"); // Mostrar panel inferior flotante

            // Ocultar cursor central y banner superior para limpiar la vista
            if (mapCursor) mapCursor.style.display = "none";
            if (topLeftBanner) topLeftBanner.style.display = "none";

            // Capturar la posición actual real del mapa principal
            if (typeof map !== 'undefined') {
                const center = map.getCenter();
                currentLat = center.lat;
                currentLon = center.lng;
            }

            const radiusKm = modalRadiusSlider ? parseFloat(modalRadiusSlider.value) : 5;
            actualizarCalculosModal(radiusKm, true);
        });
    }

    const cerrarModalEspacial = () => {
        if (spatialModal) spatialModal.classList.add("hidden");
        const poiPanel = document.getElementById("poi-fullscreen-panel");
        if (poiPanel) poiPanel.classList.remove("hidden"); // Regresar al panel de POIs
        
        // Volver a mostrar el cursor central y el banner superior
        if (mapCursor) mapCursor.style.display = "block";
        if (topLeftBanner) topLeftBanner.style.display = "flex";

        // Quitar el padding del mapa y ocultar la capa de radio al salir
        if (typeof map !== 'undefined') {
            map.easeTo({ padding: { bottom: 0, top: 0, left: 0, right: 0 }, duration: 300 });
            if (map.getLayer('main-radius-fill')) {
                map.setLayoutProperty('main-radius-fill', 'visibility', 'none');
                map.setLayoutProperty('main-radius-stroke', 'visibility', 'none');
            }
        }
    };

    if (btnCloseModal) btnCloseModal.addEventListener("click", cerrarModalEspacial);
    if (btnConfirmSpatial) btnConfirmSpatial.addEventListener("click", cerrarModalEspacial);

    // 5. Expandir / colapsar todo el árbol
    const toggleExpandAll = document.getElementById("toggle-expand-all");
    if (toggleExpandAll) {
        toggleExpandAll.addEventListener("change", (e) => {
            const nodes = document.querySelectorAll(".category-node");
            nodes.forEach(node => {
                if (e.target.checked) node.classList.add("active");
                else node.classList.remove("active");
            });
        });
    }

    // 6. Botón limpiar selecciones
    const btnClear = document.getElementById("btn-clear");
    if (btnClear) {
        btnClear.addEventListener("click", () => {
            document.querySelectorAll("#category-container input[type='checkbox']").forEach(chk => chk.checked = false);
            if (toggleExpandAll) toggleExpandAll.checked = false;
        });
    }
});

// --- GEOMETRÍA DE RADIO Y ENCUADRE EN EL MAPA PRINCIPAL ---
function crearGeoJsonCirculo(centerLon, centerLat, radiusKm, points = 64) {
    const ret = [];
    const distanceX = radiusKm / (111.320 * Math.cos(centerLat * Math.PI / 180));
    const distanceY = radiusKm / 110.574;

    for (let i = 0; i < points; i++) {
        const theta = (i / points) * (2 * Math.PI);
        const x = centerLon + (distanceX * Math.cos(theta));
        const y = centerLat + (distanceY * Math.sin(theta));
        ret.push([x, y]);
    }
    ret.push(ret[0]);

    return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ret] }
    };
}

function actualizarCirculoRadioEnMapaPrincipal(radiusKm, ajustarZoom = false) {
    if (typeof map === 'undefined') return;
    const geojsonData = crearGeoJsonCirculo(currentLon, currentLat, radiusKm);

    if (map.getSource('main-search-radius-source')) {
        map.getSource('main-search-radius-source').setData(geojsonData);
        if (map.getLayer('main-radius-fill')) {
            map.setLayoutProperty('main-radius-fill', 'visibility', 'visible');
            map.setLayoutProperty('main-radius-stroke', 'visibility', 'visible');
        }
    } else {
        if (!map.isStyleLoaded()) {
            map.on('load', () => { agregarCapaRadioAlMapa(geojsonData); });
        } else {
            agregarCapaRadioAlMapa(geojsonData);
        }
    }

    if (ajustarZoom) {
        const zoomLevel = Math.max(7, Math.min(13.5, 12.8 - Math.log2(radiusKm)));
        
        map.flyTo({
            center: [currentLon, currentLat],
            zoom: zoomLevel,
            padding: { bottom: 220, top: 40, left: 40, right: 40 }, // Ajusta el encuadre respetando el panel inferior
            duration: 600
        });
    }
}

function agregarCapaRadioAlMapa(geojsonData) {
    if (map.getSource('main-search-radius-source')) return;
    
    map.addSource('main-search-radius-source', { type: 'geojson', data: geojsonData });
    map.addLayer({
        id: 'main-radius-fill', type: 'fill', source: 'main-search-radius-source',
        paint: { 'fill-color': '#00e5ff', 'fill-opacity': 0.15 }
    });
    map.addLayer({
        id: 'main-radius-stroke', type: 'line', source: 'main-search-radius-source',
        paint: { 'line-color': '#00e5ff', 'line-width': 2 }
    });
}
