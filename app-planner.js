// ==========================================
// APLICACIÓN UNIFICADA: PLANIFICADOR + GRÁFICA + LISTA LATERAL + MAPAS + PERFILES + ZURDOS + REORDENAMIENTO + DESTINOS Y PUNTOS DE PASO + GUÍA RÁPIDA JSON
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
    maxAlternatives: 0,
    points: [],
    markers: [],
    routesList: [],
    currentRouteIndex: 0,
    currentRouteData: null,
    isGraphOpen: false,
    isLeftHanded: false,
    activeTab: 'points',    // 'points' o 'segments'
    segments: [],           // Almacena [{ name: "Tramo 1", color: "#00e5ff" }, ...]
    isDraggingMarker: false, // Bandera para evitar clics fantasma al soltar un marcador arrastrado

    init() {
        this.setupEvents();
        this.activateMapInteractions();
        this.setupGuideModalEvents(); // Inicializa los eventos del Manual Rápido
        this.updateDefaultProfileStatus(); // Establece el perfil inicial en el banner superior
        
        setTimeout(() => {
            if (map) map.resize();
        }, 150);

        if (map) {
            map.on('style.load', () => {
                setTimeout(() => {
                    // Forzamos la recarga de la imagen de flecha antes de repintar
                    if (map.hasImage('route-svg-arrow')) {
                        map.removeImage('route-svg-arrow');
                    }
                    if (this.routesList.length > 0) {
                        this.paintAllRoutes();
                    }
                    if (this.points && this.points.length > 0) {
                        this.renderMarkers();
                    }
                }, 200);
            });
        }
    },

    setupEvents() {
        // 1. Selector de Mapas
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

        // 2. Selector de Perfiles BRouter
        const btnProfiles = document.getElementById("planner-btn-profiles");
        const profilesDrawer = document.getElementById("side-panel-profiles");
        const closeProfiles = document.getElementById("btn-close-profiles-drawer");

        btnProfiles?.addEventListener("click", () => profilesDrawer?.classList.add("active"));
        closeProfiles?.addEventListener("click", () => profilesDrawer?.classList.remove("active"));

        document.querySelectorAll('input[name="brouter-profile"]').forEach(radio => {
            radio.addEventListener("change", (e) => {
                this.profile = e.target.value;
                this.updateDefaultProfileStatus();
                profilesDrawer?.classList.remove("active");
                if (this.points.length >= 2) this.calcularRutaBRouter();
            });
        });

        document.querySelectorAll('input[name="brouter-alternatives"]').forEach(radio => {
            radio.addEventListener("change", (e) => {
                this.maxAlternatives = parseInt(e.target.value, 10);
                if (this.points.length >= 2) this.calcularRutaBRouter();
            });
        });

        // 3. Menú de Opciones
        const btnOptions = document.getElementById("planner-btn-options");
        const optionsDrawer = document.getElementById("side-panel-planner-options");
        const closeOptions = document.getElementById("btn-close-planner-options-drawer");

        btnOptions?.addEventListener("click", () => optionsDrawer?.classList.add("active"));
        closeOptions?.addEventListener("click", () => optionsDrawer?.classList.remove("active"));

        // 4. Listado de Puntos y Segmentos (Panel Lateral dedicado)
        const btnList = document.getElementById("btn-planner-list");
        const pointsDrawer = document.getElementById("side-panel-points-list");
        const closePoints = document.getElementById("btn-close-points-drawer");

        btnList?.addEventListener("click", () => {
            pointsDrawer?.classList.add("active");
            this.renderActiveDrawerTab();
        });
        closePoints?.addEventListener("click", () => pointsDrawer?.classList.remove("active"));

        // Pestañas del Panel (Puntos / Segmentos)
        const tabPointsBtn = document.getElementById("tab-btn-points");
        const tabSegmentsBtn = document.getElementById("tab-btn-segments");

        tabPointsBtn?.addEventListener("click", () => {
            this.activeTab = 'points';
            tabPointsBtn.style.background = "#00e5ff";
            tabPointsBtn.style.color = "#121212";
            tabSegmentsBtn.style.background = "transparent";
            tabSegmentsBtn.style.color = "#aaa";
            this.renderPointsListDrawer();
        });

        tabSegmentsBtn?.addEventListener("click", () => {
            this.activeTab = 'segments';
            tabSegmentsBtn.style.background = "#00e5ff";
            tabSegmentsBtn.style.color = "#121212";
            tabPointsBtn.style.background = "transparent";
            tabPointsBtn.style.color = "#aaa";
            this.renderSegmentsListDrawer();
        });

        // Modo Zurdos Toggle
        const optLefty = document.getElementById("opt-btn-lefty");
        const toggleLefty = document.getElementById("toggle-lefty-mode");
        optLefty?.addEventListener("click", () => {
            this.isLeftHanded = !this.isLeftHanded;
            if (toggleLefty) toggleLefty.checked = this.isLeftHanded;
            document.body.className = this.isLeftHanded ? "left-handed" : "right-handed";
        });

        const btnAltSwitcher = document.getElementById("planner-alt-switcher");
        btnAltSwitcher?.addEventListener("click", () => this.cycleAlternativeRoute());

        // 5. Botones de Acción
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

        document.getElementById("btn-planner-graph")?.addEventListener("click", () => this.toggleGraph());

        document.getElementById("btn-planner-zoomin")?.addEventListener("click", () => map.zoomIn());
        document.getElementById("btn-planner-zoomout")?.addEventListener("click", () => map.zoomOut());
    },

    setupGuideModalEvents() {
        const card = document.getElementById("planner-quick-guide-card");
        const modal = document.getElementById("planner-guide-modal");
        const closeBtn = document.getElementById("btn-close-guide-modal");
        const optionsDrawer = document.getElementById("side-panel-planner-options");

        card?.addEventListener("click", () => {
            this.loadGuideContent();
            if (modal) modal.style.display = "flex";
            if (optionsDrawer) optionsDrawer.classList.remove("active");
        });

        closeBtn?.addEventListener("click", () => {
            if (modal) modal.style.display = "none";
        });

        modal?.addEventListener("click", (e) => {
            if (e.target === modal) modal.style.display = "none";
        });
    },

    loadGuideContent() {
        const contentContainer = document.getElementById("guide-modal-content");
        const titleEl = document.getElementById("guide-modal-title");
        if (!contentContainer) return;

        if (contentContainer.dataset.loaded === "true") return;

        const data = window.PLANNER_GUIDE_DATA;
        if (!data) {
            contentContainer.innerHTML = `<div style="text-align: center; color: #ff5252; padding: 20px;">No se encontró la guía de uso.</div>`;
            return;
        }

        if (titleEl && data.title) {
            titleEl.innerText = data.title;
        }

        contentContainer.innerHTML = "";
        data.sections.forEach(sec => {
            const item = document.createElement("div");

            if (sec.isHeader) {
                item.style.cssText = `
                    font-weight: bold; color: #00e5ff; font-size: 0.95rem; 
                    margin-top: 14px; margin-bottom: -2px; padding-bottom: 6px;
                    border-bottom: 1px solid rgba(0,229,255,0.3); font-family: sans-serif;
                    display: flex; align-items: center; gap: 8px;
                `;
                item.innerHTML = `
                    <img src="${sec.icon}" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(77%) sepia(93%) saturate(1352%) hue-rotate(130deg);" alt="${sec.title}">
                    <span>${sec.title}</span>
                `;
            } else {
                item.style.cssText = `
                    display: flex; gap: 14px; align-items: flex-start;
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px; padding: 12px;
                `;
                item.innerHTML = `
                    <div style="background: rgba(0,229,255,0.1); border-radius: 8px; padding: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <img src="${sec.icon}" width="20" height="20" style="filter: brightness(0) saturate(100%) invert(77%) sepia(93%) saturate(1352%) hue-rotate(130deg);" alt="${sec.title}">
                    </div>
                    <div>
                        <div style="font-weight: bold; color: #00e5ff; margin-bottom: 4px; font-size: 0.9rem;">${sec.title}</div>
                        <div style="color: #ccc; font-size: 0.82rem; line-height: 1.4;">${sec.desc}</div>
                    </div>
                `;
            }
            contentContainer.appendChild(item);
        });

        contentContainer.dataset.loaded = "true";
    },

    activateMapInteractions() {
        map.on('click', (e) => {
            if (this.isDraggingMarker) return;

            const panel = document.getElementById("route-planner-bottom-panel");
            if (!panel || panel.style.display === "none") return;
            this.addPoint([e.lngLat.lng, e.lngLat.lat], "Destino");
        });

        map.on('contextmenu', (e) => {
            const panel = document.getElementById("route-planner-bottom-panel");
            if (!panel || panel.style.display === "none") return;
            this.insertIntermediatePoint(e.lngLat);
        });

        const mapContainer = map.getContainer();
        let touchTimer = null;
        let startTouchCoord = null;

        mapContainer.addEventListener('touchstart', (e) => {
            const panel = document.getElementById("route-planner-bottom-panel");
            if (!panel || panel.style.display === "none" || e.touches.length !== 1) return;

            const touch = e.touches[0];
            startTouchCoord = { x: touch.clientX, y: touch.clientY };

            clearTimeout(touchTimer);
            touchTimer = setTimeout(() => {
                const rect = mapContainer.getBoundingClientRect();
                const point = [startTouchCoord.x - rect.left, startTouchCoord.y - rect.top];
                const lngLat = map.unproject(point);

                if (navigator.vibrate) navigator.vibrate(50);
                this.insertIntermediatePoint(lngLat);
                startTouchCoord = null;
            }, 600);
        }, { passive: true });

        mapContainer.addEventListener('touchmove', (e) => {
            if (!startTouchCoord || e.touches.length !== 1) return;
            const touch = e.touches[0];
            const dx = touch.clientX - startTouchCoord.x;
            const dy = touch.clientY - startTouchCoord.y;
            if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
                clearTimeout(touchTimer);
                startTouchCoord = null;
            }
        }, { passive: true });

        mapContainer.addEventListener('touchend', () => {
            clearTimeout(touchTimer);
            startTouchCoord = null;
        }, { passive: true });
    },

    insertIntermediatePoint(lngLat) {
        if (this.points.length < 2) {
            this.addPoint([lngLat.lng, lngLat.lat], "Inicio/Fin");
            return;
        }

        let insertIndex = 1;
        let minDst = Infinity;

        for (let i = 0; i < this.points.length - 1; i++) {
            const pA = this.points[i].coords;
            const pB = this.points[i + 1].coords;
            const midLat = (pA[1] + pB[1]) / 2;
            const midLng = (pA[0] + pB[0]) / 2;
            const d = this.haversine(lngLat.lat, lngLat.lng, midLat, midLng);

            if (d < minDst) {
                minDst = d;
                insertIndex = i + 1;
            }
        }

        this.showToast("Insertando punto");
        this.points.splice(insertIndex, 0, {
            coords: [lngLat.lng, lngLat.lat],
            name: "Paso"
        });

        this.syncSegmentsArray();
        this.renderActiveDrawerTab();
        this.calcularRutaBRouter();
    },

    syncSegmentsArray() {
        const expectedCount = Math.max(0, this.points.length - 1);
        
        while (this.segments.length < expectedCount) {
            const idx = this.segments.length + 1;
            const lastColor = this.segments.length > 0 ? this.segments[this.segments.length - 1].color : '#00e5ff';
            this.segments.push({
                name: `Tramo ${idx}`,
                color: lastColor
            });
        }
        
        if (this.segments.length > expectedCount) {
            this.segments = this.segments.slice(0, expectedCount);
        }
    },

    addPoint(lngLat, defaultName = "Punto") {
        const idx = this.points.length + 1;
        this.points.push({ coords: lngLat, name: `${defaultName} ${idx}` });
        this.syncSegmentsArray();
        
        this.renderMarkers();
        this.renderActiveDrawerTab();

        if (this.points.length >= 2) {
            this.showToast("Calculando ");
            this.calcularRutaBRouter();
        } else {
            this.showToast("Punto inicial fijado.");
        }
    },

    removePoint(index) {
        if (this.points.length > 0 && index >= 0) {
            this.points.splice(index, 1);
            this.syncSegmentsArray();
            this.renderActiveDrawerTab();

            if (this.points.length >= 2) {
                this.showToast("Actualizando ruta...");
                this.calcularRutaBRouter();
                this.renderMarkers();
            } else {
                this.clearRoute();
                this.routesList = [];
                this.currentRouteIndex = 0;
                this.currentRouteData = null;
                this.renderMarkers();
                this.updateStats("--", "--", "--", "--");
                this.hideGraph();
                this.updateAltButtonVisibility();
                this.showToast("Punto eliminado.");
            }
        }
    },

    movePoint(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.points.length) return;

        const temp = this.points[index];
        this.points[index] = this.points[newIndex];
        this.points[newIndex] = temp;

        this.renderMarkers();
        this.renderActiveDrawerTab();
        if (this.points.length >= 2) {
            this.showToast("Reordenando tramos...");
            this.calcularRutaBRouter();
        }
    },

    renderActiveDrawerTab() {
        if (this.activeTab === 'points') {
            this.renderPointsListDrawer();
        } else {
            this.renderSegmentsListDrawer();
        }
    },

    async calcularRutaBRouter() {
        const lonLats = this.points.map(p => `${p.coords[0]},${p.coords[1]}`).join("|");
        const totalCount = this.maxAlternatives + 1;
        const altIndices = Array.from({ length: totalCount }, (_, i) => i);
        
        try {
            const promises = altIndices.map(idx => 
                fetch(`https://brouter.de/brouter?lonlats=${lonLats}&profile=${this.profile}&alternativeidx=${idx}&format=geojson`)
                    .then(res => res.json())
                    .catch(() => null)
            );

            const results = await Promise.all(promises);
            this.routesList = [];

            results.forEach((data, idx) => {
                if (data && data.features && data.features.length > 0) {
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

                    this.routesList.push({
                        index: idx,
                        coordinates: coords,
                        distKm,
                        timeStr,
                        ascent: Math.round(ascent),
                        descent: Math.round(descent)
                    });
                }
            });

            if (this.routesList.length > 0) {
                if (this.currentRouteIndex >= this.routesList.length) {
                    this.currentRouteIndex = 0;
                }
                this.activateRouteVariant(this.currentRouteIndex);
                this.updateAltButtonVisibility();
            }
        } catch (e) {
            console.error("Error BRouter:", e);
        }
    },

    cycleAlternativeRoute() {
        if (this.routesList.length <= 1) return;
        this.currentRouteIndex = (this.currentRouteIndex + 1) % this.routesList.length;
        this.activateRouteVariant(this.currentRouteIndex);
    },

    activateRouteVariant(index) {
        this.currentRouteIndex = index;
        const activeRoute = this.routesList[index];
        if (!activeRoute) return;

        this.currentRouteData = { coordinates: activeRoute.coordinates };

        this.updateStats(activeRoute.distKm, activeRoute.timeStr, activeRoute.ascent, activeRoute.descent);
        this.paintAllRoutes();
        this.renderMarkers();

        if (this.isGraphOpen) {
            this.renderElevationGraph(activeRoute.coordinates);
        }

        const counter = document.getElementById("alt-counter");
        if (counter) {
            counter.innerText = `${index + 1}/${this.routesList.length}`;
        }
    },

    updateAltButtonVisibility() {
        const btn = document.getElementById("planner-alt-switcher");
        if (btn) {
            btn.style.display = this.routesList.length > 1 ? "flex" : "none";
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

    paintAllRoutes() {
        if (!map) return;
        this.clearRoute();

        if (!map.hasImage('route-svg-arrow')) {
            const svgString = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 580" width="580" height="580">
                    <path d="m 30,261 286,0 0,-72.5 234,101.85 -234,101.15 0,-72.5 -286,0 z" fill="#ffffff" stroke="#121212" stroke-width="28" stroke-linejoin="round"/>
                </svg>`;
            
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const URL = window.URL || window.webkitURL || window;
            const blobURL = URL.createObjectURL(blob);
            
            const img = new Image();
            img.onload = () => {
                if (!map.hasImage('route-svg-arrow')) {
                    map.addImage('route-svg-arrow', img);
                }
                this._executeLayerPainting();
            };
            img.src = blobURL;
        } else {
            this._executeLayerPainting();
        }
    },

    _executeLayerPainting() {
        if (!map || this.routesList.length === 0) return;

        this.clearRoute();

        const altColors = ['#3498db', '#e74c3c', '#9b59b6', '#f39c12'];

        this.routesList.forEach((route, idx) => {
            if (idx === this.currentRouteIndex) return;

            const sourceId = `alt-route-source-${idx}`;
            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, {
                    type: 'geojson',
                    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: route.coordinates } }
                });
            }

            const strokeColor = altColors[(idx - 1) % altColors.length] || '#7f8c8d';

            if (!map.getLayer(`alt-route-casing-${idx}`)) {
                map.addLayer({
                    id: `alt-route-casing-${idx}`,
                    type: 'line',
                    source: sourceId,
                    paint: { 'line-color': '#121212', 'line-width': 5, 'line-opacity': 0.4 }
                });
            }

            if (!map.getLayer(`alt-route-solid-${idx}`)) {
                map.addLayer({
                    id: `alt-route-solid-${idx}`,
                    type: 'line',
                    source: sourceId,
                    paint: { 'line-color': strokeColor, 'line-width': 3.5, 'line-opacity': 0.7 }
                });
            }
        });

        const activeRoute = this.routesList[this.currentRouteIndex];
        this.syncSegmentsArray();
        
        if (this.segments.length > 0 && this.points.length >= 2) {
            let coordIndex = 0;
            
            this.segments.forEach((seg, sIdx) => {
                const nextPoint = this.points[sIdx + 1];
                if (!nextPoint) return;

                const subCoords = [];
                while (coordIndex < activeRoute.coordinates.length) {
                    const pt = activeRoute.coordinates[coordIndex];
                    subCoords.push(pt);
                    
                    const distToNext = this.haversine(pt[1], pt[0], nextPoint.coords[1], nextPoint.coords[0]);
                    coordIndex++;
                    
                    if (distToNext < 40 && sIdx < this.segments.length - 1) {
                        break;
                    }
                }
                
                if (sIdx === this.segments.length - 1) {
                    while (coordIndex < activeRoute.coordinates.length) {
                        subCoords.push(activeRoute.coordinates[activeRoute.coordinates.length - 1]);
                        coordIndex++;
                    }
                }

                if (subCoords.length < 2 && activeRoute.coordinates.length >= 2) {
                    subCoords.push(activeRoute.coordinates[activeRoute.coordinates.length - 1]);
                }

                const segSourceId = `active-segment-source-${sIdx}`;
                if (!map.getSource(segSourceId)) {
                    map.addSource(segSourceId, {
                        type: 'geojson',
                        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: subCoords } }
                    });
                }

                if (!map.getLayer(`active-segment-casing-${sIdx}`)) {
                    map.addLayer({
                        id: `active-segment-casing-${sIdx}`,
                        type: 'line',
                        source: segSourceId,
                        paint: { 'line-color': '#121212', 'line-width': 7.5, 'line-opacity': 0.85 }
                    });
                }

                if (!map.getLayer(`active-segment-solid-${sIdx}`)) {
                    map.addLayer({
                        id: `active-segment-solid-${sIdx}`,
                        type: 'line',
                        source: segSourceId,
                        paint: { 'line-color': seg.color || '#00e5ff', 'line-width': 4.5 }
                    });
                }
            });
        } else {
            const activeGeojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: activeRoute.coordinates } };

            if (!map.getSource('planned-route-source')) {
                map.addSource('planned-route-source', { type: 'geojson', data: activeGeojson });
            }

            if (!map.getLayer('planned-route-active-casing')) {
                map.addLayer({
                    id: 'planned-route-active-casing',
                    type: 'line',
                    source: 'planned-route-source',
                    paint: { 'line-color': '#121212', 'line-width': 7.5, 'line-opacity': 0.85 }
                });
            }

            if (!map.getLayer('planned-route-active-solid')) {
                map.addLayer({
                    id: 'planned-route-active-solid',
                    type: 'line',
                    source: 'planned-route-source',
                    paint: { 'line-color': this.segments[0]?.color || '#00e5ff', 'line-width': 4.5 }
                });
            }
        }

        const fullGeojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: activeRoute.coordinates } };
        if (!map.getSource('planned-route-arrows-source')) {
            map.addSource('planned-route-arrows-source', { type: 'geojson', data: fullGeojson });
        } else {
            map.getSource('planned-route-arrows-source').setData(fullGeojson);
        }

        if (!map.getLayer('planned-route-arrows')) {
            map.addLayer({
                id: 'planned-route-arrows',
                type: 'symbol',
                source: 'planned-route-arrows-source',
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 70,
                    'icon-image': 'route-svg-arrow',
                    'icon-size': 0.05,
                    'icon-allow-overlap': true,
                    'icon-rotation-alignment': 'map'
                }
            });
        }
    },

    clearRoute() {
        if (!map) return;
        try {
            if (map.getLayer('planned-route-arrows')) map.removeLayer('planned-route-arrows');
            if (map.getSource('planned-route-arrows-source')) map.removeSource('planned-route-arrows-source');
            
            if (map.getLayer('planned-route-active-solid')) map.removeLayer('planned-route-active-solid');
            if (map.getLayer('planned-route-active-casing')) map.removeLayer('planned-route-active-casing');
            if (map.getSource('planned-route-source')) map.removeSource('planned-route-source');

            for (let i = 0; i < 20; i++) {
                if (map.getLayer(`active-segment-solid-${i}`)) map.removeLayer(`active-segment-solid-${i}`);
                if (map.getLayer(`active-segment-casing-${i}`)) map.removeLayer(`active-segment-casing-${i}`);
                if (map.getSource(`active-segment-source-${i}`)) map.removeSource(`active-segment-source-${i}`);
            }

            this.routesList.forEach((_, idx) => {
                if (map.getLayer(`alt-route-casing-${idx}`)) map.removeLayer(`alt-route-casing-${idx}`);
                if (map.getLayer(`alt-route-solid-${idx}`)) map.removeLayer(`alt-route-solid-${idx}`);
                if (map.getSource(`alt-route-source-${idx}`)) map.removeSource(`alt-route-source-${idx}`);
            });
        } catch (e) {
            // Evita interrupciones
        }
    },

    clearAllPoints() {
        this.points = [];
        this.segments = [];
        this.markers.forEach(m => m.remove());
        this.markers = [];
        this.routesList = [];
        this.currentRouteIndex = 0;
        this.currentRouteData = null;
        this.clearRoute();
        this.updateStats("--", "--", "--", "--");
        this.renderActiveDrawerTab();
        this.hideGraph();
        this.updateAltButtonVisibility();
        this.showToast("Planificación limpia.");
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

    showToast(message) {
        const statusTextEl = document.getElementById("banner-status-text");
        if (!statusTextEl) return;

        // Elimina cualquier emoji del mensaje para mantener la estética sobria
        const cleanMessage = message.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, '').trim();

        statusTextEl.innerText = cleanMessage;
        statusTextEl.style.color = "#ffffff";

        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            this.updateDefaultProfileStatus();
        }, 2800);
    },

    updateDefaultProfileStatus() {
        const statusTextEl = document.getElementById("banner-status-text");
        if (!statusTextEl) return;

        const profileNames = {
            "hiking-mountain": "Senderismo",
            "trekking": "Trekking",
            "mtb": "MTB",
            "gravel": "Gravel",
            "fastbike": "Carretera"
        };

        statusTextEl.innerText = profileNames[this.profile] || "Planificador";
        statusTextEl.style.color = "var(--primary-cyan)";
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
                font-size: 13px; font-family: sans-serif; cursor: grab;
                position: absolute; transform: translate(-50%, -50%) translateZ(0);
                will-change: transform; pointer-events: auto;
            `;
            el.innerText = index + 1;

            const marker = new maplibregl.Marker({ 
                element: el, 
                draggable: true,
                offset: [0, 0]
            })
                .setLngLat(point.coords)
                .addTo(map);

            marker.on('dragstart', () => {
                this.isDraggingMarker = true;
                el.style.transform = "translate(-50%, -50%) scale(1.35) translateZ(0)";
                this.showToast(`Moviendo punto ${index + 1}...`);
            });

            marker.on('dragend', () => {
                el.style.transform = "translate(-50%, -50%) scale(1) translateZ(0)";
                const lngLat = marker.getLngLat();
                this.points[index].coords = [lngLat.lng, lngLat.lat];
                
                if (this.points.length >= 2) {
                    this.showToast("Recalculando ruta ");
                    this.calcularRutaBRouter();
                } else {
                    this.clearRoute();
                    this.routesList = [];
                    this.currentRouteIndex = 0;
                    this.currentRouteData = null;
                    this.renderMarkers();
                    this.updateStats("--", "--", "--", "--");
                    this.hideGraph();
                    this.updateAltButtonVisibility();
                }

                setTimeout(() => {
                    this.isDraggingMarker = false;
                }, 300);
            });

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

            const badge = document.createElement("div");
            badge.style.cssText = `
                background: #121212; color: #00e5ff; border: 1.5px solid #00e5ff;
                border-radius: 50%; width: 24px; height: 24px; display: flex;
                align-items: center; justify-content: center; font-weight: bold; font-size: 0.75rem; flex-shrink: 0;
            `;
            badge.innerText = index + 1;

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

            const actionsDiv = document.createElement("div");
            actionsDiv.style.cssText = `display: flex; align-items: center; gap: 4px; flex-shrink: 0;`;

            const btnUp = document.createElement("button");
            btnUp.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 2px; display: flex; align-items: center;";
            btnUp.innerHTML = `<span style="font-size: 14px; color: ${index === 0 ? '#444' : '#00e5ff'};">▲</span>`;
            btnUp.disabled = index === 0;
            btnUp.addEventListener("click", (e) => {
                e.stopPropagation();
                this.movePoint(index, -1);
            });

            const btnDown = document.createElement("button");
            btnDown.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 2px; display: flex; align-items: center;";
            btnDown.innerHTML = `<span style="font-size: 14px; color: ${index === this.points.length - 1 ? '#444' : '#00e5ff'};">▼</span>`;
            btnDown.disabled = index === this.points.length - 1;
            btnDown.addEventListener("click", (e) => {
                e.stopPropagation();
                this.movePoint(index, 1);
            });

            const btnFocus = document.createElement("button");
            btnFocus.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center;";
            btnFocus.innerHTML = `<img src="./ui-icons/fi-rr-location-crosshairs.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(77%);" alt="Ir">`;
            btnFocus.addEventListener("click", (e) => {
                e.stopPropagation();
                if (map) map.flyTo({ center: point.coords, zoom: 15 });
            });

            const btnDelete = document.createElement("button");
            btnDelete.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center;";
            btnDelete.innerHTML = `<img src="./ui-icons/fi-rr-trash.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(43%) sepia(93%) saturate(1352%) hue-rotate(334deg);" alt="Borrar">`;
            btnDelete.addEventListener("click", (e) => {
                e.stopPropagation();
                this.removePoint(index);
            });

            actionsDiv.appendChild(btnUp);
            actionsDiv.appendChild(btnDown);
            actionsDiv.appendChild(btnFocus);
            actionsDiv.appendChild(btnDelete);

            itemRow.appendChild(badge);
            itemRow.appendChild(nameInput);
            itemRow.appendChild(actionsDiv);
            container.appendChild(itemRow);
        });
    },

    renderSegmentsListDrawer() {
        const container = document.getElementById("planner-points-items-container");
        const countLabel = document.getElementById("planner-points-count");
        if (!container) return;

        this.syncSegmentsArray();
        if (countLabel) countLabel.innerText = `(${this.segments.length})`;
        container.innerHTML = "";

        if (this.segments.length === 0) {
            container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 20px;">Se necesitan al menos 2 puntos para generar segmentos</div>`;
            return;
        }

        this.segments.forEach((seg, index) => {
            const itemRow = document.createElement("div");
            itemRow.style.cssText = `
                display: flex; align-items: center; justify-content: space-between;
                background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px; padding: 8px 10px; gap: 8px; width: 100%; box-sizing: border-box;
            `;

            const badge = document.createElement("div");
            badge.style.cssText = `
                background: #121212; color: #00e5ff; border: 1.5px solid #00e5ff;
                border-radius: 6px; width: 26px; height: 26px; display: flex;
                align-items: center; justify-content: center; font-weight: bold; font-size: 0.7rem; flex-shrink: 0;
            `;
            badge.innerText = `S${index + 1}`;

            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = seg.name;
            nameInput.style.cssText = `
                background: transparent; border: none; border-bottom: 1px dashed rgba(255,255,255,0.2);
                color: #fff; font-size: 0.85rem; flex: 1; min-width: 0; padding: 2px 4px; outline: none;
            `;
            ['click', 'focus', 'touchstart', 'pointerdown', 'keydown'].forEach(evt => {
                nameInput.addEventListener(evt, (e) => e.stopPropagation());
            });
            nameInput.addEventListener("input", (e) => {
                this.segments[index].name = e.target.value;
            });

            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.value = seg.color || "#00e5ff";
            colorInput.style.cssText = `
                width: 26px; height: 26px; border: none; border-radius: 50%;
                background: transparent; cursor: pointer; padding: 0; flex-shrink: 0;
            `;
            colorInput.addEventListener("click", (e) => e.stopPropagation());
            colorInput.addEventListener("input", (e) => {
                this.segments[index].color = e.target.value;
                if (this.currentRouteData) {
                    this.paintAllRoutes();
                }
            });

            itemRow.appendChild(badge);
            itemRow.appendChild(nameInput);
            itemRow.appendChild(colorInput);
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

window.RoutePlanner = RoutePlanner;
document.addEventListener("DOMContentLoaded", () => RoutePlanner.init());
