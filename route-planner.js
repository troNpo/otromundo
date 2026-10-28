// ==========================================
// PLANIFICADOR DE RUTAS AVANZADO (route-planner.js)
// ==========================================

const RoutePlanner = {
    profile: "hiking-mountain", // Perfil corregido para senderismo y montaña
    points: [],          
    markers: [],         
    currentRouteData: null,
    isLeftHanded: false,

    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // 1. Abrir planificador desde la tarjeta del Centro de Control
        const btnCard = document.getElementById("btn-route-planner-card");
        if (btnCard) {
            btnCard.addEventListener("click", () => {
                window._isPlannerOpen = true; // <-- ACTIVAMOS LA BANDERA GLOBAL
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

        // 3. Botón Mapas (Abre el selector general de mapas y oculta la barra del planificador)
        const btnPlannerMap = document.getElementById("planner-btn-map");
        if (btnPlannerMap) {
            btnPlannerMap.addEventListener("click", () => {
                const modalSelector = document.getElementById('layer-selector-modal');
                if (modalSelector) {
                    modalSelector.classList.add('active');
                    
                    // Ocultar barra inferior y controles de zoom del planificador temporalmente
                    const plannerPanel = document.getElementById("route-planner-bottom-panel");
                    if (plannerPanel) plannerPanel.style.display = "none";

                    const zoomControls = document.getElementById("planner-zoom-controls");
                    if (zoomControls) {
                        zoomControls.classList.add("hidden");
                        zoomControls.style.setProperty("display", "none", "important");
                    }
                }
            });
        }

        // 4. Botón Activar GPS
        const btnPlannerGps = document.getElementById("planner-btn-gps");
        if (btnPlannerGps) {
            btnPlannerGps.addEventListener("click", () => {
                if (typeof geolocateControl !== 'undefined' && geolocateControl) {
                    geolocateControl.trigger();
                }
            });
        }

        // 5. Botón Añadir punto desde el centro del mapa
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

                document.getElementById("planner-stat-points").innerText = this.points.length;

                if (typeof showToast === 'function') {
                    showToast(`📍 Punto ${this.points.length} añadido`);
                }

                if (this.points.length >= 2) {
                    this.calcularRutaBRouter();
                }
            });
        }

        // 6. Botón Quitar punto
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

        // 7. Botón Abrir Modal de Perfiles
        const btnProfiles = document.getElementById("planner-btn-profiles");
        const profileModal = document.getElementById("planner-profile-modal");
        const btnCloseProfile = document.getElementById("btn-close-planner-profile");

        if (btnProfiles && profileModal) {
            btnProfiles.addEventListener("click", () => {
                profileModal.classList.remove("hidden");
            });
        }

        if (btnCloseProfile && profileModal) {
            btnCloseProfile.addEventListener("click", () => {
                profileModal.classList.add("hidden");
            });
        }

        // 8. Botón Abrir Menú de Opciones Avanzadas
        const btnMenu = document.getElementById("planner-btn-menu");
        if (btnMenu) {
            btnMenu.addEventListener("click", () => {
                document.getElementById("planner-options-modal").classList.remove("hidden");
            });
        }

        // 9. Cerrar Menú de Opciones Avanzadas
        const btnCloseOptions = document.getElementById("btn-close-planner-options");
        if (btnCloseOptions) {
            btnCloseOptions.addEventListener("click", () => {
                document.getElementById("planner-options-modal").classList.add("hidden");
            });
        }

        // 10. Control Modo Zurdos
        const optLefty = document.getElementById("opt-btn-lefty");
        const toggleLefty = document.getElementById("toggle-lefty-mode");
        if (optLefty && toggleLefty) {
            optLefty.addEventListener("click", () => {
                this.isLeftHanded = !this.isLeftHanded;
                toggleLefty.checked = this.isLeftHanded;
                
                const zoomControls = document.getElementById("planner-zoom-controls");
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

        // 11. Selector de Perfiles BRouter Operativo
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

        // 12. Centrar GPS (desde opciones avanzadas)
        const optGps = document.getElementById("opt-btn-gps");
        if (optGps) {
            optGps.addEventListener("click", () => {
                if (typeof geolocateControl !== 'undefined' && geolocateControl) {
                    geolocateControl.trigger();
                    document.getElementById("planner-options-modal").classList.add("hidden");
                }
            });
        }

        // 13. Borrar ruta
        const optClear = document.getElementById("opt-btn-clear");
        if (optClear) {
            optClear.addEventListener("click", () => {
                this.clearAllPoints();
                document.getElementById("planner-options-modal").classList.add("hidden");
            });
        }

        // 14. Guardar en capas
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

        // 15. Botones de Zoom
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

                    document.getElementById("planner-stat-points").innerText = this.points.length;

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
                const coords = feature.geometry.coordinates;
                const props = feature.properties || {};

                const distanceKm = props.track_length ? (props.track_length / 1000).toFixed(2) : "0";
                const timeMin = props.total_time ? Math.round(props.total_time / 60) : 0;

                this.currentRouteData = { coordinates: coords, distance: distanceKm, time: timeMin };

                this.updateStats(distanceKm, timeMin);
                this.paintPlannedRouteOnMap(coords);
            }
        } catch (error) {
            console.error("Error al calcular ruta con BRouter:", error);
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

        if (map.getLayer('planned-route-casing')) map.removeLayer('planned-route-casing');
        if (map.getLayer('planned-route-dashed')) map.removeLayer('planned-route-dashed');
        if (map.getSource('planned-route-source')) map.removeSource('planned-route-source');

        map.addSource('planned-route-source', { type: 'geojson', data: geojson });

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
        this.updateStats("--", "--");
        document.getElementById("planner-stat-points").innerText = "0";
        if (typeof showToast === 'function') showToast("🧹 Puntos limpios");
    },

    closePlanner() {
        window._isPlannerOpen = false; // <-- DESACTIVAMOS LA BANDERA GLOBAL AL CERRAR
        
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
