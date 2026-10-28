// ==========================================
// PLANIFICADOR DE RUTAS AVANZADO (route-planner.js)
// ==========================================

const RoutePlanner = {
    profile: "hiking-mountain", 
    points: [],          
    markers: [],         
    currentRouteData: null,
    isLeftHanded: false,
    isGraphOpen: false,

    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // 1. Abrir planificador desde la tarjeta del Centro de Control
        const btnCard = document.getElementById("btn-route-planner-card");
        if (btnCard) {
            btnCard.addEventListener("click", () => {
                window._isPlannerOpen = true; 
                document.getElementById("control-center-panel").classList.add("hidden");
                const bottomToolbar = document.getElementById("bottom-toolbar");
                if (bottomToolbar) bottomToolbar.classList.add("hidden");
                
                const plannerPanel = document.getElementById("route-planner-bottom-panel");
                if (plannerPanel) plannerPanel.style.display = "flex";

                const zoomControls = document.getElementById("planner-zoom-controls");
                if (zoomControls) {
                    zoomControls.classList.remove("hidden");
                    zoomControls.style.setProperty("display", "flex", "important");
                }
                
                this.activateMapSelectionMode(true);
                if (typeof showToast === 'function') showToast("🗺️ Toca el mapa o pulsa [+] para fijar puntos");
            });
        }

        // 2. Botón Cancelar / Cerrar
        const btnCancel = document.getElementById("planner-btn-cancel");
        if (btnCancel) {
            btnCancel.addEventListener("click", () => {
                this.closePlanner();
            });
        }

        // 3. Botón Gráfica de Altitud (Toggle)
        const btnGraph = document.getElementById("btn-planner-graph");
        const graphContainer = document.getElementById("planner-graph-container");
        const zoomControls = document.getElementById("planner-zoom-controls");

        if (btnGraph && graphContainer) {
            btnGraph.addEventListener("click", () => {
                this.isGraphOpen = !this.isGraphOpen;
                graphContainer.style.display = this.isGraphOpen ? "flex" : "none";
                
                // Elevar los controles flotantes si la gráfica está abierta para que no choquen
                if (zoomControls) {
                    zoomControls.style.bottom = this.isGraphOpen ? "275px" : "135px";
                }

                // Cambiar color del botón si está activo
                btnGraph.style.background = this.isGraphOpen ? "var(--primary-cyan)" : "rgba(18, 18, 20, 0.85)";
                const img = btnGraph.querySelector("img");
                if (img) {
                    img.style.filter = this.isGraphOpen ? "brightness(0)" : "brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%)";
                }

                if (this.isGraphOpen && this.currentRouteData && this.currentRouteData.coordinates) {
                    this.renderElevationGraph(this.currentRouteData.coordinates);
                }
            });
        }

        // 4. Botón Mapas
        const btnPlannerMap = document.getElementById("planner-btn-map");
        if (btnPlannerMap) {
            btnPlannerMap.addEventListener("click", () => {
                const modalSelector = document.getElementById('layer-selector-modal');
                if (modalSelector) {
                    modalSelector.classList.add('active');
                    
                    const plannerPanel = document.getElementById("route-planner-bottom-panel");
                    if (plannerPanel) plannerPanel.style.display = "none";

                    if (zoomControls) {
                        zoomControls.classList.add("hidden");
                        zoomControls.style.setProperty("display", "none", "important");
                    }
                }
            });
        }

        // 5. Botón Activar GPS
        const btnPlannerGps = document.getElementById("planner-btn-gps");
        if (btnPlannerGps) {
            btnPlannerGps.addEventListener("click", () => {
                if (typeof geolocateControl !== 'undefined' && geolocateControl) {
                    geolocateControl.trigger();
                }
            });
        }

        // 6. Botón Añadir punto
        const btnAdd = document.getElementById("planner-btn-add");
        if (btnAdd) {
            btnAdd.addEventListener("click", () => {
                if (typeof map === 'undefined' || !map) return;

                const center = map.getCenter();
                const lngLat = [center.lng, center.lat];
                
                this.points.push(lngLat);

                const marker = new maplibregl.Marker({ color: "#00e5ff" })
                    .setLngLat(lngLat)
                    .addTo(map);
                this.markers.push(marker);

                if (typeof showToast === 'function') {
                    showToast(`📍 Punto ${this.points.length} añadido`);
                }

                if (this.points.length >= 2) {
                    this.calcularRutaBRouter();
                }
            });
        }

        // 7. Botón Quitar punto
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
                        this.updateStats("0", "0m", 0, 0);
                        this.hideGraph();
                    }
                    if (typeof showToast === 'function') showToast("Punto eliminado");
                }
            });
        }

        // 8. Perfiles y Menú opciones
        const btnProfiles = document.getElementById("planner-btn-profiles");
        const profileModal = document.getElementById("planner-profile-modal");
        const btnCloseProfile = document.getElementById("btn-close-planner-profile");

        if (btnProfiles && profileModal) {
            btnProfiles.addEventListener("click", () => profileModal.classList.remove("hidden"));
        }
        if (btnCloseProfile && profileModal) {
            btnCloseProfile.addEventListener("click", () => profileModal.classList.add("hidden"));
        }

        const btnMenu = document.getElementById("planner-btn-menu");
        if (btnMenu) {
            btnMenu.addEventListener("click", () => document.getElementById("planner-options-modal").classList.remove("hidden"));
        }

        const btnCloseOptions = document.getElementById("btn-close-planner-options");
        if (btnCloseOptions) {
            btnCloseOptions.addEventListener("click", () => document.getElementById("planner-options-modal").classList.add("hidden"));
        }

        // Modo Zurdos
        const optLefty = document.getElementById("opt-btn-lefty");
        const toggleLefty = document.getElementById("toggle-lefty-mode");
        if (optLefty && toggleLefty) {
            optLefty.addEventListener("click", () => {
                this.isLeftHanded = !this.isLeftHanded;
                toggleLefty.checked = this.isLeftHanded;
                
                if (zoomControls) {
                    if (this.isLeftHanded) {
                        zoomControls.style.right = "auto";
                        zoomControls.style.left = "16px";
                    } else {
                        zoomControls.style.left = "auto";
                        zoomControls.style.right = "16px";
                    }
                }
            });
        }

        // Selector de Perfiles BRouter
        document.querySelectorAll('input[name="brouter-profile"]').forEach(radio => {
            radio.addEventListener("change", (e) => {
                this.profile = e.target.value;
                if (profileModal) profileModal.classList.add("hidden");

                if (this.points.length >= 2) {
                    this.calcularRutaBRouter();
                }
                if (typeof showToast === 'function') showToast(`⚙️ Perfil BRouter: ${this.profile.toUpperCase()}`);
            });
        });

        // Borrar & Guardar Ruta
        const optClear = document.getElementById("opt-btn-clear");
        if (optClear) {
            optClear.addEventListener("click", () => {
                this.clearAllPoints();
                document.getElementById("planner-options-modal").classList.add("hidden");
            });
        }

        const optSave = document.getElementById("opt-btn-save-route");
        if (optSave) {
            optSave.addEventListener("click", () => {
                if (this.currentRouteData && typeof LayerManager !== 'undefined') {
                    LayerManager.activeLayers.externalTracks.push({
                        id: `planned_route_${Date.now()}`,
                        nombre: `Ruta (${this.profile.toUpperCase()})`,
                        categoria: `Ruta ${this.profile.toUpperCase()}`,
                        coordinates: this.currentRouteData.coordinates
                    });
                    LayerManager.renderLayerManagerPanel();
                    LayerManager.paintTracksOnMap();

                    document.getElementById("planner-options-modal").classList.add("hidden");
                    this.closePlanner();
                    document.getElementById("layer-manager-panel").classList.remove("hidden");
                    LayerManager.renderLayerManagerPanel();
                    if (typeof showToast === 'function') showToast("✨ Ruta guardada en Capas");
                } else {
                    alert("Calcula una ruta válida antes de guardar.");
                }
            });
        }

        document.getElementById("btn-planner-zoomin")?.addEventListener("click", () => {
            if (typeof map !== 'undefined' && map) map.zoomIn({ duration: 300 });
        });

        document.getElementById("btn-planner-zoomout")?.addEventListener("click", () => {
            if (typeof map !== 'undefined' && map) map.zoomOut({ duration: 300 });
        });
    },

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

                    if (this.points.length >= 2) {
                        this.calcularRutaBRouter();
                    }
                });
                map.hasRouteClickListener = true;
            }
        }
    },

    async calcularRutaBRouter() {
        if (this.points.length < 2) return;

        if (typeof showToast === 'function') showToast(`Calculando ruta (${this.profile})...`);

        const lonLatsParam = this.points.map(p => `${p[0]},${p[1]}`).join("|");
        const url = `https://brouter.de/brouter?lonlats=${lonLatsParam}&profile=${this.profile}&alternativeidx=0&format=geojson`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                const feature = data.features[0];
                const coords = feature.geometry.coordinates; // [lon, lat, ele]
                const props = feature.properties || {};

                const distanceKm = props.track_length ? (props.track_length / 1000).toFixed(2) : "0";
                const totalSeconds = props.total_time || 0;
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.round((totalSeconds % 3600) / 60);
                const timeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

                const ascent = props.ascent ? Math.round(props.ascent) : 0;
                const descent = props.descent ? Math.round(props.descent) : 0;

                this.currentRouteData = { 
                    coordinates: coords, 
                    distance: distanceKm, 
                    time: timeFormatted,
                    ascent: ascent,
                    descent: descent
                };

                this.updateStats(distanceKm, timeFormatted, ascent, descent);
                this.paintPlannedRouteOnMap(coords);

                if (this.isGraphOpen) {
                    this.renderElevationGraph(coords);
                }
            }
        } catch (error) {
            console.error("Error al calcular ruta con BRouter:", error);
        }
    },

    updateStats(dist, time, ascent, descent) {
        document.getElementById("planner-stat-dist").innerText = `${dist} km`;
        document.getElementById("planner-stat-time").innerText = time;
        document.getElementById("planner-stat-ascent").innerText = `+${ascent} m`;
        document.getElementById("planner-stat-descent").innerText = `-${descent} m`;
    },

    paintPlannedRouteOnMap(coordinates) {
        if (typeof map === 'undefined' || !map) return;

        const geojson = {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coordinates }
        };

        if (map.getLayer('planned-route-casing')) map.removeLayer('planned-route-casing');
        if (map.getLayer('planned-route-dashed')) map.removeLayer('planned-route-dashed');
        if (map.getSource('planned-route-source')) map.removeSource('planned-route-source');

        map.addSource('planned-route-source', { type: 'geojson', data: geojson });

        // Línea de fondo blanca para contraste
        map.addLayer({
            id: 'planned-route-casing',
            type: 'line',
            source: 'planned-route-source',
            paint: {
                'line-color': '#ffffff',
                'line-width': 7,
                'line-opacity': 0.8
            }
        });

        // Línea discontinua principal
        map.addLayer({
            id: 'planned-route-dashed',
            type: 'line',
            source: 'planned-route-source',
            paint: {
                'line-color': '#1040b0',
                'line-width': 5,
                'line-dasharray': [2, 1.5]
            }
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
        const height = 120;
        const padding = 10;

        const effectiveHeight = height - padding * 2;
        const effectiveWidth = width - padding * 2;

        const minX = padding;
        const maxX = width - padding;
        const minY = padding;
        const maxY = height - padding;

        const rangeEle = maxEle - minEle || 1;

        let points = `${minX},${maxY} `;
        coordinates.forEach((c, i) => {
            const x = minX + (i / (coordinates.length - 1)) * effectiveWidth;
            const ele = c[2] !== undefined ? c[2] : minEle;
            const y = maxY - ((ele - minEle) / rangeEle) * effectiveHeight;
            points += `${x},${y} `;
        });
        points += `${maxX},${maxY}`;

        let linePoints = "";
        coordinates.forEach((c, i) => {
            const x = minX + (i / (coordinates.length - 1)) * effectiveWidth;
            const ele = c[2] !== undefined ? c[2] : minEle;
            const y = maxY - ((ele - minEle) / rangeEle) * effectiveHeight;
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
                <line x1="${minX}" y1="${minY}" x2="${maxX}" y2="${minY}" stroke="rgba(255,255,255,0.1)" stroke-dasharray="3,3" />
                <line x1="${minX}" y1="${(minY + maxY) / 2}" x2="${maxX}" y2="${(minY + maxY) / 2}" stroke="rgba(255,255,255,0.1)" stroke-dasharray="3,3" />
                <line x1="${minX}" y1="${maxY}" x2="${maxX}" y2="${maxY}" stroke="rgba(255,255,255,0.2)" />
                <polygon points="${points}" fill="url(#elevation-gradient)" />
                <polyline points="${linePoints}" fill="none" stroke="#00e5ff" stroke-width="2" />
            </svg>
        `;
    },

    hideGraph() {
        this.isGraphOpen = false;
        const graphContainer = document.getElementById("planner-graph-container");
        if (graphContainer) graphContainer.style.display = "none";
        
        const zoomControls = document.getElementById("planner-zoom-controls");
        if (zoomControls) zoomControls.style.bottom = "135px"; // Restaurar posición normal de los botones

        const btnGraph = document.getElementById("btn-planner-graph");
        if (btnGraph) {
            btnGraph.style.background = "rgba(18, 18, 20, 0.85)";
            const img = btnGraph.querySelector("img");
            if (img) img.style.filter = "brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%)";
        }
    },

    clearRoutePolyline() {
        if (typeof map !== 'undefined' && map) {
            if (map.getLayer('planned-route-casing')) map.removeLayer('planned-route-casing');
            if (map.getLayer('planned-route-dashed')) map.removeLayer('planned-route-dashed');
            if (map.getSource('planned-route-source')) map.removeSource('planned-route-source');
        }
    },

    clearAllPoints() {
        this.points = [];
        this.markers.forEach(m => m.remove());
        this.markers = [];
        this.currentRouteData = null;
        this.clearRoutePolyline();
        this.updateStats("--", "--", "--", "--");
        this.hideGraph();
        if (typeof showToast === 'function') showToast("🧹 Puntos limpios");
    },

    closePlanner() {
        window._isPlannerOpen = false; 
        
        const panel = document.getElementById("route-planner-bottom-panel");
        if (panel) panel.style.display = "none";
        
        const zoomControls = document.getElementById("planner-zoom-controls");
        if (zoomControls) {
            zoomControls.classList.add("hidden");
            zoomControls.style.setProperty("display", "none", "important");
        }

        const bottomToolbar = document.getElementById("bottom-toolbar");
        if (bottomToolbar) bottomToolbar.classList.remove("hidden");

        this.clearAllPoints();

        if (typeof map !== 'undefined' && map) setTimeout(() => map.resize(), 50);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    RoutePlanner.init();
});
