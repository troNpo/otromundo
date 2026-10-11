// app.js

let miniMap = null;
let currentLat = 40.4168;
let currentLon = -3.7038;
let currentAreaValue = 78.5;

document.addEventListener("DOMContentLoaded", async () => {
    // Coordenadas iniciales desde URL si existen
    const urlParams = new URLSearchParams(window.location.search);
    currentLat = parseFloat(urlParams.get("lat")) || 40.4168;
    currentLon = parseFloat(urlParams.get("lon")) || -3.7038;

    // Inicializar mapa de vista previa
    try {
        inicializarMiniMapa();
    } catch (e) {
        console.error("Error al inicializar MapLibre:", e);
    }

    // Cargar perfil por defecto inicial (Senderismo)
    cargarPerfilJSON("hiking");

    // Gestión de pestañas de perfiles
    const tabs = document.querySelectorAll(".profile-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const perfil = tab.getAttribute("data-profile");
            cargarPerfilJSON(perfil);
        });
    });

    // Acordeón del mapa
    const btnToggleMap = document.getElementById("btn-toggle-map");
    const mapContainerCollapse = document.getElementById("map-container-collapse");
    if (btnToggleMap && mapContainerCollapse) {
        btnToggleMap.addEventListener("click", () => {
            const isHidden = mapContainerCollapse.style.display === "none" || mapContainerCollapse.style.display === "";
            mapContainerCollapse.style.display = isHidden ? "block" : "none";
            btnToggleMap.classList.toggle("active", isHidden);
            
            if (isHidden && miniMap) {
                setTimeout(() => {
                    miniMap.resize();
                    miniMap.jumpTo({ center: [currentLon, currentLat] });
                }, 100);
            }
        });
    }

    // Control de radio y superficie
    const radiusSlider = document.getElementById("search-radius");
    const radiusValueSpan = document.getElementById("radius-value");
    const infoArea = document.getElementById("info-area");

    function actualizarCalculosRadio(r) {
        const radioNum = parseFloat(r) || 0;
        if (radiusValueSpan) radiusValueSpan.innerText = radioNum;
        currentAreaValue = Math.PI * Math.pow(radioNum, 2);
        if (infoArea) infoArea.innerText = `Superficie del área: ${currentAreaValue.toFixed(1)} km²`;
        actualizarCirculoRadioMapa(radioNum);
    }

    if (radiusSlider) {
        actualizarCalculosRadio(radiusSlider.value);
        radiusSlider.addEventListener("input", (e) => {
            actualizarCalculosRadio(e.target.value);
        });
    }

    // Expandir / colapsar todo
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

    // Botón limpiar selecciones
    const btnClear = document.getElementById("btn-clear");
    if (btnClear) {
        btnClear.addEventListener("click", () => {
            document.querySelectorAll("input[type='checkbox']").forEach(chk => chk.checked = false);
            if (toggleExpandAll) toggleExpandAll.checked = false;
        });
    }
});

function inicializarMiniMapa() {
    const mapContainer = document.getElementById('mini-map');
    if (!mapContainer) return;

    miniMap = new maplibregl.Map({
        container: 'mini-map',
        style: {
            version: 8,
            sources: {
                'osm-raster': {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '&copy; OpenStreetMap Contributors'
                }
            },
            layers: [{
                id: 'osm-layer',
                type: 'raster',
                source: 'osm-raster',
                minzoom: 0,
                maxzoom: 19
            }]
        },
        center: [currentLon, currentLat],
        zoom: 11,
        interactive: false
    });

    miniMap.on('load', () => {
        const radiusSlider = document.getElementById("search-radius");
        const currentRadius = radiusSlider ? parseFloat(radiusSlider.value) || 5 : 5;
        agregarCapaRadioAlMapa(currentRadius);
    });
}

function crearGeoJsonCirculo(centerLon, centerLat, radiusKm, points = 64) {
    const coords = { latitude: centerLat, longitude: centerLon };
    const ret = [];
    const distanceX = radiusKm / (111.320 * Math.cos(centerLat * Math.PI / 180));
    const distanceY = radiusKm / 110.574;

    for (let i = 0; i < points; i++) {
        const theta = (i / points) * (2 * Math.PI);
        const x = coords.longitude + (distanceX * Math.cos(theta));
        const y = coords.latitude + (distanceY * Math.sin(theta));
        ret.push([x, y]);
    }
    ret.push(ret[0]);

    return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ret] }
    };
}

function agregarCapaRadioAlMapa(radiusKm) {
    if (!miniMap) return;
    const geojsonData = crearGeoJsonCirculo(currentLon, currentLat, radiusKm);

    if (miniMap.getSource('search-radius-source')) {
        miniMap.getSource('search-radius-source').setData(geojsonData);
    } else {
        miniMap.addSource('search-radius-source', { type: 'geojson', data: geojsonData });
        miniMap.addLayer({
            id: 'radius-fill', type: 'fill', source: 'search-radius-source',
            paint: { 'fill-color': '#b71c1c', 'fill-opacity': 0.2 }
        });
        miniMap.addLayer({
            id: 'radius-stroke', type: 'line', source: 'search-radius-source',
            paint: { 'line-color': '#ff5252', 'line-width': 2 }
        });

        const markerEl = document.createElement('div');
        markerEl.style.width = '14px';
        markerEl.style.height = '14px';
        markerEl.style.backgroundColor = '#b71c1c';
        markerEl.style.border = '2px solid white';
        markerEl.style.borderRadius = '50%';
        markerEl.style.boxShadow = '0 0 6px rgba(0,0,0,0.5)';

        new maplibregl.Marker({ element: markerEl })
            .setLngLat([currentLon, currentLat])
            .addTo(miniMap);
    }
}

function actualizarCirculoRadioMapa(radiusKm) {
    if (!miniMap || !miniMap.getSource('search-radius-source')) return;
    const geojsonData = crearGeoJsonCirculo(currentLon, currentLat, radiusKm);
    miniMap.getSource('search-radius-source').setData(geojsonData);
    const zoomLevel = Math.max(8, Math.min(14, 12 - Math.log2(radiusKm)));
    miniMap.jumpTo({ center: [currentLon, currentLat], zoom: zoomLevel });
}
