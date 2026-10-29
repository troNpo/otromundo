// ==========================================
// PLANIFICADOR DE RUTAS AVANZADO (route-planner.js)
// ==========================================

const RoutePlanner = {
    profile: "hiking-mountain", 
    points: [],          // Array de objetos: [{ coords: [lon, lat], name: "Punto 1" }]
    markers: [],         
    currentRouteData: null,
    isLeftHanded: false,
    isGraphOpen: false,
    isListOpen: false,

    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // 1. Abrir planificador desde el Centro de Control
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
        if (btnGraph) {
            btnGraph.addEventListener("click", () => {
                this.toggleGraph();
            });
        }

        // 4. Botón Listado de Puntos (Toggle)
        const btnList = document.getElementById("btn-planner-list");
        if (btnList) {
            btnList.addEventListener("click", () => {
                this.toggleList();
            });
        }

        // 5. Botón Mapas
        const btnPlannerMap = document.getElementById("planner-btn-map");
        if (btnPlannerMap) {
            btnPlannerMap.addEventListener("click", () => {
                const modalSelector = document.getElementById('layer-selector-modal');
                if (modalSelector) {
                    modalSelector.classList.add('active');
                    
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

        // 6. Interceptar el cierre del selector de mapas para volver al planificador si estaba abierto
        const btnBackLayer = document.getElementById("btn-back");
        if (btnBackLayer) {
            btnBackLayer.addEventListener("click", () => {
                if (window._isPlannerOpen) {
                    const plannerPanel = document.getElementById("route-planner-bottom-panel");
                    if (plannerPanel) plannerPanel.style.display = "flex";

                    const zoomControls = document.getElementById("planner-zoom-controls");
                    if (zoomControls) {
                        zoomControls.classList.remove("hidden");
                        zoomControls.style.setProperty("display", "flex", "important");
                    }
                }
            });
        }

        document.querySelectorAll('input[name="basemap"]').forEach(radio => {
            radio.addEventListener("change", () => {
                if (window._isPlannerOpen) {
                    const modalSelector = document.getElementById('layer-selector-modal');
                    if (modalSelector) modalSelector.classList.remove('active');

                    const plannerPanel = document.getElementById("route-planner-bottom-panel");
                    if (plannerPanel) plannerPanel.style.display = "flex";

                    const zoomControls = document.getElementById("planner-zoom-controls");
                    if (zoomControls) {
                        zoomControls.classList.remove("hidden");
                        zoomControls.style.setProperty("display", "flex", "important");
                    }
                }
            });
        });

        // 7. Botón Activar GPS
        const btnPlannerGps = document.getElementById("planner-btn-gps");
        if (btnPlannerGps) {
            btnPlannerGps.addEventListener("click", () => {
                if (typeof geolocateControl !== 'undefined' && geolocateControl) {
                    geolocateControl.trigger();
                }
            });
        }

        // 8. Botón Añadir punto
        const btnAdd = document.getElementById("planner-btn-add");
        if (btnAdd) {
            btnAdd.addEventListener("click", () => {
                if (typeof map === 'undefined' || !map) return;

                const center = map.getCenter();
                const lngLat = [center.lng, center.lat];
                
                this.addPoint(lngLat);
            });
        }

        // 9. Botón Quitar punto
        const btnRemove = document.getElementById("planner-btn-remove");
        if (btnRemove) {
            btnRemove.addEventListener("click", () => {
                if (this.points.length > 0) {
                    this.removePoint(this.points.length - 1);
                }
            });
        }

        // 10. Perfiles y Menú opciones
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
                    this.addPoint(lngLat);
                });
                map.hasRouteClickListener = true;
            }
        }
    },

    addPoint(lngLat) {
        const pointNumber = this.points.length + 1;
        this.points.push({
            coords: lngLat,
            name: `Punto ${pointNumber}`
        });

        this.renderMarkers();
        this.renderPointsList();

        if (typeof showToast === 'function') {
            showToast(`📍 Punto ${pointNumber} añadido`);
        }

        if (this.points.length >= 2) {
            this.calcularRutaBRouter();
        }
    },

    removePoint(index) {
        if (index >= 0 && index < this.points.length) {
            this.points.splice(index, 1);
            this.renderMarkers();
            this.renderPointsList();

            if (this.points.length >= 2) {
                this.calcularRutaBRouter();
            } else {
                this.clearRoutePolyline();
                this.updateStats("--", "--", "--", "--");
                this.hideContainer();
            }
            if (typeof showToast === 'function') showToast("Punto eliminado");
        }
    },

    toggleGraph() {
        this.isGraphOpen = !this.isGraphOpen;
        if (this.isGraphOpen) this.isListOpen = false;
        this.updateContainerVisibility();

        if (this.isGraphOpen && this.currentRouteData && this.currentRouteData.coordinates) {
            this.renderElevationGraph(this.currentRouteData.coordinates);
        }
    },

    toggleList() {
        this.isListOpen = !this.isListOpen;
        if (this.isListOpen) this.isGraphOpen = false;
        this.updateContainerVisibility();

        if (this.isListOpen) {
            this.renderPointsList();
        }
    },

    updateContainerVisibility() {
        const graphContainer = document.getElementById("planner-graph-container");
        const elevationView = document.getElementById("planner-elevation-view");
        const listView = document.getElementById("planner-points-list-view");
        const zoomControls = document.getElementById("planner-zoom-controls");

        const btnGraph = document.getElementById("btn-planner-graph");
        const btnList = document.getElementById("btn-planner-list");

        const isAnyOpen = this.isGraphOpen || this.isListOpen;

        if (graphContainer) {
            graphContainer.style.display = isAnyOpen ? "flex" : "none";
        }
        if (elevationView) {
            elevationView.style.display = this.isGraphOpen ? "flex" : "none";
        }
        if (listView) {
            listView.style.display = this.isListOpen ? "flex" : "none";
        }

        if (zoomControls) {
            zoomControls.style.bottom = isAnyOpen ? "340px" : "135px";
        }

        // Estilos para botón Gráfica
        if (btnGraph) {
            btnGraph.style.background = this.isGraphOpen ? "var(--primary-cyan)" : "rgba(18, 18, 20, 0.85)";
            const img = btnGraph.querySelector("img");
            if (img) {
                img.style.filter = this.isGraphOpen ? "brightness(0)" : "brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%)";
            }
        }

        // Estilos para botón Listado
        if (btnList) {
            btnList.style.background = this.isListOpen ? "var(--primary-cyan)" : "rgba(18, 18, 20, 0.85)";
            const img = btnList.querySelector("img");
            if (img) {
                img.style.filter = this.isListOpen ? "brightness(0)" : "brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%)";
            }
        }
    },

    hideContainer() {
        this.isGraphOpen = false;
        this.isListOpen = false;
        this.updateContainerVisibility();
    },

    renderPointsList() {
        const listContainer = document.getElementById("planner-points-items-container");
        const pointsCount = document.getElementById("planner-points-count");
        if (!listContainer) return;

        if (pointsCount) pointsCount.innerText = `${this.points.length} Punto${this.points.length !== 1 ? 's' : ''}`;

        listContainer.innerHTML = "";

        if (this.points.length === 0) {
            listContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 12px;">No hay puntos añadidos</div>`;
            return;
        }

        this.points.forEach((point, index) => {
            const itemRow = document.createElement("div");
            itemRow.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px;
                padding: 6px 10px;
                gap: 8px;
            `;

            // Badge numérico
            const badge = document.createElement("div");
            badge.style.cssText = `
                background: #121212;
                color: #00e5ff;
                border: 1.5px solid #00e5ff;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 0.75rem;
                flex-shrink: 0;
            `;
            badge.innerText = index + 1;

            // Input editable para el nombre del punto (con eventos protegidos contra fugas táctiles)
            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = point.name;
            nameInput.style.cssText = `
                background: transparent;
                border: none;
                border-bottom: 1px dashed rgba(255,255,255,0.2);
                color: #fff;
                font-size: 0.85rem;
                flex: 1;
                padding: 2px 4px;
                outline: none;
            `;

            // Bloquear propagación para que al tocar el input no dispare elementos de debajo
            ['click', 'focus', 'touchstart', 'pointerdown'].forEach(evt => {
                nameInput.addEventListener(evt, (e) => e.stopPropagation());
            });

            nameInput.addEventListener("input", (e) => {
                this.points[index].name = e.target.value;
            });

            // Botón ir al punto
            const btnFocus = document.createElement("button");
            btnFocus.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 4px;";
            btnFocus.innerHTML = `<img src="./ui-icons/fi-rr-location-crosshairs.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%);" alt="Ir">`;
            btnFocus.title = "Centrar punto en el mapa";
            btnFocus.addEventListener("click", () => {
                if (typeof map !== 'undefined' && map) {
                    map.flyTo({ center: point.coords, zoom: 15 });
                }
            });

            // Botón eliminar punto
            const btnDelete = document.createElement("button");
            btnDelete.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 4px;";
            btnDelete.innerHTML = `<img src="./ui-icons/fi-rr-trash.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(43%) sepia(93%) saturate(1352%) hue-rotate(334deg) brightness(97%) contrast(92%);" alt="Borrar">`;
            btnDelete.title = "Eliminar este punto";
            btnDelete.addEventListener("click", () => {
                this.removePoint(index);
            });

            itemRow.appendChild(badge);
            itemRow.appendChild(nameInput);
            itemRow.appendChild(btnFocus);
            itemRow.appendChild(btnDelete);

            listContainer.appendChild(itemRow);
        });
    },

    renderMarkers() {
        if (typeof map === 'undefined' && map) return;
        if (typeof map === 'undefined') return;

        this.markers.forEach(m => m.remove());
        this.markers = [];

        this.points.forEach((point, index) => {
            const el = document.createElement('div');
            el.className = 'planner-numbered-marker';
            el.style.cssText = `
                background-color: #121212;
                color: #00e5ff;
                border: 2px solid #00e5ff;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 13px;
                font-family: sans-serif;
                box-shadow: 0 3px 8px rgba(0,0,0,0.6);
                cursor: pointer;
            `;
            el.innerText = index + 1;

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat(point.coords)
                .addTo(map);

            this.markers.push(marker);
        });
    },

    async calcularRutaBRouter() {
        if (this.points.length < 2) return;

        if (typeof showToast === 'function') showToast(`Calculando ruta (${this.profile})...`);

        const lonLatsParam = this.points.map(p => `${p.coords[0]},${p.coords[1]}`).join("|");
        const url = `https://brouter.de/brouter?lonlats=${lonLatsParam}&profile=${this.profile}&alternativeidx=0&format=geojson`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                const feature = data.features[0];
                const coords = feature.geometry.coordinates;

                let totalDistanceMeters = 0;
                let ascent = 0;
                let descent = 0;

                for (let i = 0; i < coords.length - 1; i++) {
                    const p1 = coords[i];
                    const p2 = coords[i + 1];
                    
                    totalDistanceMeters += this.calculateHaversineDistance(p1[1], p1[0], p2[1], p2[0]);

                    const ele1 = p1[2] !== undefined ? p1[2] : 0;
                    const ele2 = p2[2] !== undefined ? p2[2] : 0;
                    const diff = ele2 - ele1;
                    if (diff > 0) {
                        ascent += diff;
                    } else {
                        descent += Math.abs(diff);
                    }
                }

                const distanceKm = (totalDistanceMeters / 1000).toFixed(2);
                const totalSeconds = totalDistanceMeters / 1.16; 
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.round((totalSeconds % 3600) / 60);
                const timeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

                const finalAscent = Math.round(ascent);
                const finalDescent = Math.round(descent);

                this.currentRouteData = { 
                    coordinates: coords, 
                    distance: distanceKm, 
                    time: timeFormatted,
                    ascent: finalAscent,
                    descent: finalDescent
                };

                this.updateStats(distanceKm, timeFormatted, finalAscent, finalDescent);
                this.paintPlannedRouteOnMap(coords);

                if (this.isGraphOpen) {
                    this.renderElevationGraph(coords);
                }
            }
        } catch (error) {
            console.error("Error al calcular ruta con BRouter:", error);
            if (typeof showToast === 'function') showToast("❌ Error al calcular la ruta");
        }
    },

    calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    updateStats(dist, time, ascent, descent) {
        const elDist = document.getElementById("planner-stat-dist");
        const elTime = document.getElementById("planner-stat-time");
        const elAscent = document.getElementById("planner-stat-ascent");
        const elDescent = document.getElementById("planner-stat-descent");

        if (elDist) elDist.innerText = `${dist} km`;
        if (elTime) elTime.innerText = time;
        if (elAscent) elAscent.innerText = `+${ascent} m`;
        if (elDescent) elDescent.innerText = `-${descent} m`;
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
                'line-color': '#121212',
                'line-width': 7.5,
                'line-opacity': 0.85
            }
        });

        map.addLayer({
            id: 'planned-route-dashed',
            type: 'line',
            source: 'planned-route-source',
            paint: {
                'line-color': '#00e5ff',
                'line-width': 4.5,
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
        this.hideContainer();
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
