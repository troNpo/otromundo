// ==========================================
// APLICACIÓN UNIFICADA: PLANIFICADOR + GRÁFICA + LISTA LATERAL + MAPAS + PERFILES + ZURDOS
// ==========================================

const savedStyle = localStorage.getItem('otromundo_style') || 'styles/osm.json';

const map = new maplibregl.Map({
    container: 'map',
    style: savedStyle,
    center: [-5.9304, 37.3414], // Montequinto / Sevilla
    zoom: 12,
    attributionControl: false
});

const geolocateControl = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserLocation: true
});
map.addControl(geolocateControl);

const RoutePlanner = {
    profile: "hiking-mountain",
    points: [],
    markers: [],
    currentRouteData: null,
    isGraphOpen: false,
    isLeftHanded: false,

    init() {
        this.setupEvents();
        this.activateMapClick();
        
        // Forzar redibujado para garantizar visibilidad del mapa
        setTimeout(() => {
            if (map) map.resize();
        }, 150);

        // Escuchar la recarga del estilo del mapa para restaurar ruta, flechas y marcadores de forma persistente
        if (map) {
            map.on('style.load', () => {
                setTimeout(() => {
                    if (this.currentRouteData && this.currentRouteData.coordinates) {
                        this.paintRoute(this.currentRouteData.coordinates);
                    }
                    if (this.points && this.points.length > 0) {
                        this.renderMarkers();
                    }
                }, 150);
            });
        }
    },

    setupEvents() {
        // 1. Selector de Mapas (Panel Lateral)
        const btnMap = document.getElementById("planner-btn-map");
        const mapsDrawer = document.getElementById("side-panel-maps");
        const closeMaps = document.getElementById("btn-close-maps-drawer");

        btnMap?.addEventListener("click", () => mapsDrawer?.classList.add("active"));
        closeMaps?.addEventListener("click", () => mapsDrawer?.classList.remove("active"));

        document.querySelectorAll('input[name="basemap"]').forEach(radio => {
            radio.addEventListener("change", (e) => {
                map.setStyle(e.target.value);
                localStorage.setItem('otromundo_style', e.target.value);
                mapsDrawer?.classList.remove("active");
            });
        });

        // 2. Selector de Perfiles BRouter (Panel Lateral)
        const btnProfiles = document.getElementById("planner-btn-profiles");
        const profilesDrawer = document.getElementById("side-panel-profiles");
        const closeProfiles = document.getElementById("btn-close-profiles-drawer");

        btnProfiles?.addEventListener("click", () => profilesDrawer?.classList.add("active"));
        closeProfiles?.addEventListener("click", () => profilesDrawer?.classList.remove("active"));

        document.querySelectorAll('input[name="brouter-profile"]').forEach(radio => {
            radio.addEventListener("change", (e) => {
                this.profile = e.target.value;
                profilesDrawer?.classList.remove("active");
                if (this.points.length >= 2) this.calcularRutaBRouter();
            });
        });

        // 3. Menú de Opciones del Planificador (Panel Lateral)
        const btnOptions = document.getElementById("planner-btn-options");
        const optionsDrawer = document.getElementById("side-panel-planner-options");
        const closeOptions = document.getElementById("btn-close-planner-options-drawer");

        btnOptions?.addEventListener("click", () => optionsDrawer?.classList.add("active"));
        closeOptions?.addEventListener("click", () => optionsDrawer?.classList.remove("active"));

        // 4. Listado de Puntos de Ruta (Panel Lateral dedicado)
        const btnList = document.getElementById("btn-planner-list");
        const pointsDrawer = document.getElementById("side-panel-points-list");
        const closePoints = document.getElementById("btn-close-points-drawer");

        btnList?.addEventListener("click", () => {
            pointsDrawer?.classList.add("active");
            this.renderPointsListDrawer();
        });
        closePoints?.addEventListener("click", () => pointsDrawer?.classList.remove("active"));

        // Modo Zurdos Toggle
        const optLefty = document.getElementById("opt-btn-lefty");
        const toggleLefty = document.getElementById("toggle-lefty-mode");
        optLefty?.addEventListener("click", () => {
            this.isLeftHanded = !this.isLeftHanded;
            if (toggleLefty) toggleLefty.checked = this.isLeftHanded;
            document.body.className = this.isLeftHanded ? "left-handed" : "right-handed";
        });

        // 5. Botones de Acción de Puntos y GPS
        document.getElementById("planner-btn-add")?.addEventListener("click", () => {
            const center = map.getCenter();
            this.addPoint([center.lng, center.lat]);
        });

        document.getElementById("planner-btn-remove")?.addEventListener("click", () => {
            if (this.points.length > 0) this.removePoint(this.points.length - 1);
        });

        document.getElementById("planner-btn-clear")?.addEventListener("click", () => this.clearAllPoints());
        document.getElementById("planner-btn-cancel")?.addEventListener("click", () => this.clearAllPoints());
        document.getElementById("planner-btn-gps")?.addEventListener("click", () => geolocateControl.trigger());

        // 6. Botón Gráfica de Altitud (Toggle inferior)
        document.getElementById("btn-planner-graph")?.addEventListener("click", () => this.toggleGraph());

        // Zoom
        document.getElementById("btn-planner-zoomin")?.addEventListener("click", () => map.zoomIn());
        document.getElementById("btn-planner-zoomout")?.addEventListener("click", () => map.zoomOut());
    },

    activateMapClick() {
        map.on('click', (e) => {
            const panel = document.getElementById("route-planner-bottom-panel");
            if (!panel || panel.style.display === "none") return;
            this.addPoint([e.lngLat.lng, e.lngLat.lat]);
        });
    },

    addPoint(lngLat) {
        const idx = this.points.length + 1;
        this.points.push({ coords: lngLat, name: `Punto ${idx}` });
        
        this.renderMarkers();
        this.renderPointsListDrawer();

        if (this.points.length >= 2) this.calcularRutaBRouter();
    },

    removePoint(index) {
        if (this.points.length > 0 && index >= 0) {
            this.points.splice(index, 1);
            this.renderMarkers();
            this.renderPointsListDrawer();

            if (this.points.length >= 2) {
                this.calcularRutaBRouter();
            } else {
                this.clearRoute();
                this.updateStats("--", "--", "--", "--");
                this.hideGraph();
            }
        }
    },

    async calcularRutaBRouter() {
        const lonLats = this.points.map(p => `${p.coords[0]},${p.coords[1]}`).join("|");
        const url = `https://brouter.de/brouter?lonlats=${lonLats}&profile=${this.profile}&alternativeidx=0&format=geojson`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.features && data.features.length > 0) {
                const coords = data.features[0].geometry.coordinates;
                let distM = 0, ascent = 0, descent = 0;

                for (let i = 0; i < coords.length - 1; i++) {
                    const p1 = coords[i], p2 = coords[i + 1];
                    distM += this.haversine(p1[1], p1[0], p2[1], p2[0]);
                    const diff = (p2[2] || 0) - (p1[2] || 0);
                    if (diff > 0) ascent += diff; else descent += Math.abs(diff);
                }

                const distKm = (distM / 1000).toFixed(2);
                const mins = Math.round((distM / 1.16) / 60);
                const timeStr = mins > 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`;

                this.updateStats(distKm, timeStr, Math.round(ascent), Math.round(descent));
                this.currentRouteData = { coordinates: coords };
                this.paintRoute(coords);

                if (this.isGraphOpen) this.renderElevationGraph(coords);
            }
        } catch (e) {
            console.error("Error BRouter:", e);
        }
    },

    haversine(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    },

    updateStats(dist, time, asc, desc) {
        document.getElementById("planner-stat-dist").innerText = `${dist} km`;
        document.getElementById("planner-stat-time").innerText = time;
        document.getElementById("planner-stat-ascent").innerText = `+${asc} m`;
        document.getElementById("planner-stat-descent").innerText = `-${desc} m`;
    },

    paintRoute(coords) {
        if (!map) return;
        const geojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };

        // 1. Limpiar capas y fuentes previas si existen
        this.clearRoute();

        // 2. Función interna para añadir la capa una vez que el icono SVG esté listo
        const addRouteLayers = () => {
            if (map.getSource('planned-route-source')) return;

            map.addSource('planned-route-source', { type: 'geojson', data: geojson });
            
            // Capa inferior: Borde oscuro para contraste
            map.addLayer({
                id: 'planned-route-casing', type: 'line', source: 'planned-route-source',
                paint: { 'line-color': '#121212', 'line-width': 7.5, 'line-opacity': 0.85 }
            });
            
            // Capa principal: Línea sólida continua (sin discontinuidad)
            map.addLayer({
                id: 'planned-route-solid', type: 'line', source: 'planned-route-source',
                paint: { 'line-color': '#00e5ff', 'line-width': 4.5 }
            });

            // Capa superior: Flechas sólidas repetidas a lo largo de la traza
            map.addLayer({
                id: 'planned-route-arrows',
                type: 'symbol',
                source: 'planned-route-source',
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 70, // Repetición frecuente de flechas
                    'icon-image': 'route-svg-arrow',
                    'icon-size': 0.05,     // Tamaño proporcional óptimo
                    'icon-allow-overlap': true,
                    'icon-rotation-alignment': 'map'
                }
            });
        };

        // 3. Registrar el icono SVG sólido apuntando a la derecha
        if (!map.hasImage('route-svg-arrow')) {
            const svgString = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512">
                    <path fill="#00e5ff" stroke="#121212" stroke-width="1.5" stroke-linejoin="round" d="M14,22.03c-.39,0-.78-.08-1.16-.23-1.13-.47-1.84-1.52-1.85-2.75v-2.06H3.97c-2.19,0-3.97-1.8-3.97-4.01v-1.98c0-2.21,1.78-4.01,3.97-4.01h7.03v-2.06c0-1.23,.71-2.28,1.85-2.75,1.13-.47,2.38-.22,3.24,.65l6.72,6.33,.02,.02c1.55,1.55,1.55,4.07,0,5.62l-6.77,6.37c-.56,.56-1.3,.86-2.06,.86ZM3.97,8.99c-1.09,0-1.97,.9-1.97,2.01v1.98c0,1.11,.89,2.01,1.97,2.01H12c.55,0,1,.45,1,1v3.06c0,.6,.47,.84,.61,.9,.14,.06,.64,.22,1.07-.21l6.77-6.37c-.74-.74,.75-1.99-.01-2.76l-6.73-6.33c-.45-.45-.95-.29-1.09-.24-.14,.06-.61,.3-.61,.9v3.05c0,.55-.45,1-1,1H3.97Z"/>
                </svg>`;
            
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const URL = window.URL || window.webkitURL || window;
            const blobURL = URL.createObjectURL(blob);
            
            const img = new Image();
            img.onload = () => {
                if (!map.hasImage('route-svg-arrow')) {
                    map.addImage('route-svg-arrow', img);
                }
                addRouteLayers();
            };
            img.src = blobURL;
        } else {
            addRouteLayers();
        }
    },

    clearRoute() {
        if (!map) return;
        if (map.getLayer('planned-route-arrows')) map.removeLayer('planned-route-arrows');
        if (map.getLayer('planned-route-casing')) map.removeLayer('planned-route-casing');
        if (map.getLayer('planned-route-solid')) map.removeLayer('planned-route-solid');
        if (map.getSource('planned-route-source')) map.removeSource('planned-route-source');
    },

    clearAllPoints() {
        this.points = [];
        this.markers.forEach(m => m.remove());
        this.markers = [];
        this.currentRouteData = null;
        this.clearRoute();
        this.updateStats("--", "--", "--", "--");
        this.renderPointsListDrawer();
        this.hideGraph();
    },

    toggleGraph() {
        this.isGraphOpen = !this.isGraphOpen;
        const graphContainer = document.getElementById("planner-graph-container");
        const zoomControls = document.getElementById("planner-zoom-controls");
        const btnGraph = document.getElementById("btn-planner-graph");

        if (graphContainer) graphContainer.style.display = this.isGraphOpen ? "flex" : "none";
        if (zoomControls) zoomControls.style.bottom = this.isGraphOpen ? "320px" : "140px";

        if (btnGraph) {
            btnGraph.style.background = this.isGraphOpen ? "var(--primary-cyan)" : "rgba(18, 18, 20, 0.9)";
            const img = btnGraph.querySelector("img");
            if (img) img.style.filter = this.isGraphOpen ? "brightness(0)" : "brightness(0) saturate(100%) invert(77%)";
        }

        if (this.isGraphOpen && this.currentRouteData) {
            this.renderElevationGraph(this.currentRouteData.coordinates);
        }
    },

    hideGraph() {
        this.isGraphOpen = false;
        const graphContainer = document.getElementById("planner-graph-container");
        if (graphContainer) graphContainer.style.display = "none";
        const zoomControls = document.getElementById("planner-zoom-controls");
        if (zoomControls) zoomControls.style.bottom = "140px";
    },

    renderMarkers() {
        if (!map) return;
        this.markers.forEach(m => m.remove());
        this.markers = [];

        this.points.forEach((point, index) => {
            const el = document.createElement('div');
            el.className = 'planner-numbered-marker';
            el.style.cssText = `
                background-color: #121212; color: #00e5ff; border: 2px solid #00e5ff;
                border-radius: 50%; width: 30px; height: 30px; display: flex;
                align-items: center; justify-content: center; font-weight: bold;
                font-size: 13px; font-family: sans-serif; box-shadow: none !important; cursor: pointer;
            `;
            el.innerText = index + 1;

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat(point.coords)
                .addTo(map);
            this.markers.push(marker);
        });
    },

    renderPointsListDrawer() {
        const container = document.getElementById("planner-points-items-container");
        const countLabel = document.getElementById("planner-points-count");
        if (!container) return;

        if (countLabel) countLabel.innerText = `(${this.points.length})`;
        container.innerHTML = "";

        if (this.points.length === 0) {
            container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 20px;">No hay puntos añadidos</div>`;
            return;
        }

        this.points.forEach((point, index) => {
            const itemRow = document.createElement("div");
            itemRow.style.cssText = `
                display: flex; align-items: center; justify-content: space-between;
                background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px; padding: 8px 10px; gap: 8px; width: 100%; box-sizing: border-box;
            `;

            // Círculo numerado
            const badge = document.createElement("div");
            badge.style.cssText = `
                background: #121212; color: #00e5ff; border: 1.5px solid #00e5ff;
                border-radius: 50%; width: 24px; height: 24px; display: flex;
                align-items: center; justify-content: center; font-weight: bold; font-size: 0.75rem; flex-shrink: 0;
            `;
            badge.innerText = index + 1;

            // Input para renombrar
            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = point.name;
            nameInput.style.cssText = `
                background: transparent; border: none; border-bottom: 1px dashed rgba(255,255,255,0.2);
                color: #fff; font-size: 0.85rem; flex: 1; min-width: 0; padding: 2px 4px; outline: none;
            `;
            ['click', 'focus', 'touchstart', 'pointerdown', 'keydown'].forEach(evt => {
                nameInput.addEventListener(evt, (e) => e.stopPropagation());
            });
            nameInput.addEventListener("input", (e) => {
                this.points[index].name = e.target.value;
            });

            // Contenedor agrupado para los botones de la derecha
            const actionsDiv = document.createElement("div");
            actionsDiv.style.cssText = `
                display: flex; align-items: center; gap: 4px; flex-shrink: 0;
            `;

            // Botón centrar mapa
            const btnFocus = document.createElement("button");
            btnFocus.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center;";
            btnFocus.innerHTML = `<img src="./ui-icons/fi-rr-location-crosshairs.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(77%);" alt="Ir">`;
            btnFocus.addEventListener("click", (e) => {
                e.stopPropagation();
                if (map) map.flyTo({ center: point.coords, zoom: 15 });
            });

            // Botón eliminar
            const btnDelete = document.createElement("button");
            btnDelete.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center;";
            btnDelete.innerHTML = `<img src="./ui-icons/fi-rr-trash.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(43%) sepia(93%) saturate(1352%) hue-rotate(334deg);" alt="Borrar">`;
            btnDelete.addEventListener("click", (e) => {
                e.stopPropagation();
                this.removePoint(index);
                this.renderPointsListDrawer();
            });

            actionsDiv.appendChild(btnFocus);
            actionsDiv.appendChild(btnDelete);

            itemRow.appendChild(badge);
            itemRow.appendChild(nameInput);
            itemRow.appendChild(actionsDiv);
            container.appendChild(itemRow);
        });
    },

    renderElevationGraph(coordinates) {
        const wrapper = document.getElementById("elevation-svg-wrapper");
        const rangeLabel = document.getElementById("graph-elevation-range");
        if (!wrapper) return;

        const elevations = coordinates.map(c => c[2] !== undefined ? c[2] : 0);
        if (elevations.length === 0) return;

        const minEle = Math.min(...elevations);
        const maxEle = Math.max(...elevations);
        if (rangeLabel) rangeLabel.innerText = `${Math.round(minEle)} m / ${Math.round(maxEle)} m`;

        const width = wrapper.clientWidth || 300;
        const height = 110;
        const padding = 10;
        const effectiveHeight = height - padding * 2;
        const effectiveWidth = width - padding * 2;
        const rangeEle = maxEle - minEle || 1;

        let points = `${padding},${height - padding} `;
        coordinates.forEach((c, i) => {
            const x = padding + (i / (coordinates.length - 1)) * effectiveWidth;
            const ele = c[2] !== undefined ? c[2] : minEle;
            const y = (height - padding) - ((ele - minEle) / rangeEle) * effectiveHeight;
            points += `${x},${y} `;
        });
        points += `${width - padding},${height - padding}`;

        let linePoints = "";
        coordinates.forEach((c, i) => {
            const x = padding + (i / (coordinates.length - 1)) * effectiveWidth;
            const ele = c[2] !== undefined ? c[2] : minEle;
            const y = (height - padding) - ((ele - minEle) / rangeEle) * effectiveHeight;
            linePoints += `${x},${y} `;
        });

        wrapper.innerHTML = `
            <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">
                <defs>
                    <linearGradient id="elevation-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.4"/>
                        <stop offset="100%" stop-color="#00e5ff" stop-opacity="0.0"/>
                    </linearGradient>
                </defs>
                <polygon points="${points}" fill="url(#elevation-gradient)" />
                <polyline points="${linePoints}" fill="none" stroke="#00e5ff" stroke-width="2" />
            </svg>
        `;
    }
};

// Exponer globalmente y ejecutar al cargar el DOM
window.RoutePlanner = RoutePlanner;
document.addEventListener("DOMContentLoaded", () => RoutePlanner.init());
