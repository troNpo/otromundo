// ==========================================
// PLANIFICADOR DE RUTAS CON BROUTER (route-planner.js)
// ==========================================

const RoutePlanner = {
    profile: "trekking", // 'trekking' para senderismo, 'mtb' para ciclismo
    points: [],          // Array de coordenadas [ [lon, lat], ... ]
    markers: [],         // Pines visuales en el mapa
    currentRouteData: null,

    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // 1. Abrir panel inferior desde la tarjeta del Centro de Control
        const btnCard = document.getElementById("btn-route-planner-card");
        if (btnCard) {
            btnCard.addEventListener("click", () => {
                document.getElementById("control-center-panel").classList.add("hidden");
                const bottomToolbar = document.getElementById("bottom-toolbar");
                if (bottomToolbar) bottomToolbar.classList.add("hidden");
                
                const plannerPanel = document.getElementById("route-planner-bottom-panel");
                if (plannerPanel) {
                    plannerPanel.style.display = "flex";
                }
                
                this.activateMapSelectionMode(true);
                if (typeof showToast === 'function') showToast("🗺️ Toca el mapa o usa el botón [+] para fijar puntos");
            });
        }

        // 2. Botón Cancelar (fi-rr-square-x.svg)
        const btnCancel = document.getElementById("planner-btn-cancel");
        if (btnCancel) {
            btnCancel.addEventListener("click", () => {
                this.closePlanner();
            });
        }

        // 3. Botón Quitar último punto (fi-rr-square-minus.svg)
        const btnRemove = document.getElementById("planner-btn-remove");
        if (btnRemove) {
            btnRemove.addEventListener("click", () => {
                if (this.points.length > 0) {
                    this.points.pop();
                    const lastMarker = this.markers.pop();
                    if (lastMarker) lastMarker.remove();

                    if (this.points.length >= 2) {
                        this.calcularRutaBRouter();
                    } else {
                        this.clearRoutePolyline();
                        this.updateStats(0, 0);
                    }
                    if (typeof showToast === 'function') showToast("Punto eliminado");
                }
            });
        }

        // 4. Botón Añadir punto desde el CENTRO DEL MAPA (fi-rr-square-plus.svg)
        const btnAdd = document.getElementById("planner-btn-add");
        if (btnAdd) {
            btnAdd.addEventListener("click", () => {
                if (typeof map === 'undefined' || !map) return;

                // Obtener el centro exacto del mapa
                const center = map.getCenter();
                const lngLat = [center.lng, center.lat];
                
                this.points.push(lngLat);

                // Añadir marcador visual en el mapa
                const marker = new maplibregl.Marker({ color: "#00e5ff" })
                    .setLngLat(lngLat)
                    .addTo(map);
                this.markers.push(marker);

                document.getElementById("planner-stat-points").innerText = this.points.length;

                if (typeof showToast === 'function') {
                    showToast(`📍 Punto ${this.points.length} añadido desde el centro`);
                }

                // Si hay 2 o más puntos, calcular ruta automáticamente
                if (this.points.length >= 2) {
                    this.calcularRutaBRouter();
                }
            });
        }

        // 5. Enviar ruta al Gestor de Capas
        const btnSend = document.getElementById("planner-btn-send");
        if (btnSend) {
            btnSend.addEventListener("click", () => {
                if (this.currentRouteData && typeof LayerManager !== 'undefined') {
                    LayerManager.activeLayers.externalTracks.push({
                        id: `planned_route_${Date.now()}`,
                        nombre: `Ruta Planificada (${this.profile.toUpperCase()})`,
                        categoria: `Ruta ${this.profile.toUpperCase()}`,
                        coordinates: this.currentRouteData.coordinates
                    });
                    LayerManager.renderLayerManagerPanel();
                    LayerManager.paintTracksOnMap();

                    this.closePlanner();
                    document.getElementById("layer-manager-panel").classList.remove("hidden");
                    LayerManager.renderLayerManagerPanel();
                    if (typeof showToast === 'function') showToast("✨ Ruta guardada en Capas");
                } else {
                    alert("Calcula una ruta válida antes de guardar.");
                }
            });
        }
    },

    // Activar clics directos en el mapa como método alternativo
    activateMapSelectionMode(activate) {
        if (typeof map === 'undefined' || !map) return;

        if (activate) {
            if (!map.hasRouteClickListener) {
                map.on('click', (e) => {
                    const panel = document.getElementById("route-planner-bottom-panel");
                    if (!panel || panel.style.display === "none") return;

                    const lngLat = [e.lngLat.lng, e.lngLat.lat];
                    this.points.push(lngLat);

                    const marker = new maplibregl.Marker({ color: "#00e5ff" })
                        .setLngLat(lngLat)
                        .addTo(map);
                    this.markers.push(marker);

                    document.getElementById("planner-stat-points").innerText = this.points.length;

                    if (this.points.length >= 2) {
                        this.calcularRutaBRouter();
                    }
                });
                map.hasRouteClickListener = true;
            }
        }
    },

    // Petición a BRouter soportando múltiples puntos de paso
    async calcularRutaBRouter() {
        if (this.points.length < 2) return;

        if (typeof showToast === 'function') showToast("Calculando ruta con BRouter...");

        const lonLatsParam = this.points.map(p => `${p[0]},${p[1]}`).join("|");
        const url = `https://brouter.de/brouter?lonlats=${lonLatsParam}&profile=${this.profile}&alternativeidx=0&format=geojson`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                const feature = data.features[0];
                const coords = feature.geometry.coordinates;
                const props = feature.properties || {};

                const distanceKm = props.track_length ? (props.track_length / 1000).toFixed(2) : "0";
                const timeMin = props.total_time ? Math.round(props.total_time / 60) : 0;

                this.currentRouteData = { coordinates: coords, distance: distanceKm, time: timeMin };

                this.updateStats(distanceKm, timeMin);
                this.paintPlannedRouteOnMap(coords);
                if (typeof showToast === 'function') showToast("✅ Ruta calculada con éxito");
            }
        } catch (error) {
            console.error("Error al calcular ruta con BRouter:", error);
            alert("Error de conexión con el servidor de BRouter.");
        }
    },

    updateStats(dist, time) {
        document.getElementById("planner-stat-dist").innerText = `${dist} km`;
        document.getElementById("planner-stat-time").innerText = `${time} min`;
        document.getElementById("planner-stat-points").innerText = this.points.length;
    },

    paintPlannedRouteOnMap(coordinates) {
        if (typeof map === 'undefined' || !map) return;

        const geojson = {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coordinates }
        };

        if (map.getLayer('planned-route-layer')) map.removeLayer('planned-route-layer');
        if (map.getSource('planned-route-source')) map.removeSource('planned-route-source');

        map.addSource('planned-route-source', { type: 'geojson', data: geojson });
        map.addLayer({
            id: 'planned-route-layer',
            type: 'line',
            source: 'planned-route-source',
            paint: { 'line-color': '#00e5ff', 'line-width': 5, 'line-opacity': 0.9 }
        });
    },

    clearRoutePolyline() {
        if (typeof map !== 'undefined' && map) {
            if (map.getLayer('planned-route-layer')) map.removeLayer('planned-route-layer');
            if (map.getSource('planned-route-source')) map.removeSource('planned-route-source');
        }
    },

    closePlanner() {
        const panel = document.getElementById("route-planner-bottom-panel");
        if (panel) panel.style.display = "none";
        
        const bottomToolbar = document.getElementById("bottom-toolbar");
        if (bottomToolbar) bottomToolbar.classList.remove("hidden");

        this.points = [];
        this.markers.forEach(m => m.remove());
        this.markers = [];
        this.currentRouteData = null;
        this.clearRoutePolyline();
        
        this.updateStats("--", "--");
        document.getElementById("planner-stat-points").innerText = "0";

        if (typeof map !== 'undefined' && map) setTimeout(() => map.resize(), 50);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    RoutePlanner.init();
});
