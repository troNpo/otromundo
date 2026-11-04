// ==========================================
// APLICACIÓN UNIFICADA: PLANIFICADOR + GRÁFICA + LISTA LATERAL + MAPAS + PERFILES + ZURDOS + REORDENAMIENTO + DESTINOS Y PUNTOS DE PASO + GUÍA RÁPIDA + ATRIBUCIONES
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
    applyOnlyToFuture: false, // Control para aplicar el nuevo perfil solo a los siguientes puntos
    points: [],
    markers: [],
    routesList: [],
    currentRouteIndex: 0,
    currentRouteData: null,
    isGraphOpen: false,
    isLeftHanded: false,
    isTouchAddEnabled: false, // Estado inicial: Bloqueado por defecto para evitar puntos fantasma
    activeTab: 'points',    // 'points' o 'segments'
    segments: [],           // Almacena [{ name: "Tramo 1", color: "#00e5ff", profile: "..." }, ...]
    isDraggingMarker: false, // Bandera para evitar clics fantasma al soltar un marcador arrastrado
    _cursorMarker: null,     // Marcador HTML flotante para la distancia al centro
    _segmentMarkers: [],     // Marcadores HTML flotantes para las medidas de cada tramo
    _minMaxMarkers: [],      // Marcadores HTML flotantes para cota máxima y mínima

    init() {
        this.setupEvents();
        this.activateMapInteractions();
        this.setupGuideModalEvents();       // Inicializa los eventos del Manual Rápido
        this.setupAttributionsModalEvents(); // Inicializa los eventos del Modal de Atribuciones
        this.updateDefaultProfileStatus();  // Establece el perfil inicial en el banner superior
        
        setTimeout(() => {
            if (map) map.resize();
        }, 150);

        if (map) {
            map.on('style.load', () => {
                setTimeout(() => {
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

            map.on('move', () => {
                this.updateDynamicCursorLine();
            });
            map.on('moveend', () => {
                this.updateDynamicCursorLine();
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
                const newProfile = e.target.value;

                if (this.applyOnlyToFuture) {
                    this.profile = newProfile;
                    this.updateDefaultProfileStatus();
                    this.showToast(`Próximo tramo: ${newProfile}`);
                } else {
                    this.profile = newProfile;
                    this.updateDefaultProfileStatus();
                    this.segments.forEach(seg => {
                        seg.profile = this.profile;
                    });
                    if (this.points.length >= 2) this.calcularRutaBRouter();
                }

                profilesDrawer?.classList.remove("active");
            });
        });

        // Evento para el interruptor de "Aplicar solo a nuevos puntos"
        const optFuture = document.getElementById("opt-btn-apply-future");
        const toggleFuture = document.getElementById("toggle-apply-future-mode");
        optFuture?.addEventListener("click", () => {
            this.applyOnlyToFuture = !this.applyOnlyToFuture;
            if (toggleFuture) toggleFuture.checked = this.applyOnlyToFuture;
            this.showToast(this.applyOnlyToFuture ? "Perfil futuro activado" : "Perfil global activado");
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

        // 4. Listado de Puntos y Segmentos
        const btnList = document.getElementById("btn-planner-list");
        const pointsDrawer = document.getElementById("side-panel-points-list");
        const closePoints = document.getElementById("btn-close-points-drawer");

        btnList?.addEventListener("click", () => {
            pointsDrawer?.classList.add("active");
            this.renderActiveDrawerTab();
        });
        closePoints?.addEventListener("click", () => pointsDrawer?.classList.remove("active"));

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

        // 6. Botón de Bloqueo / Desbloqueo Táctil
        const btnTouchLock = document.getElementById("planner-btn-touch-lock");
        const lockIcon = document.getElementById("planner-lock-icon");

        btnTouchLock?.addEventListener("click", () => {
            this.isTouchAddEnabled = !this.isTouchAddEnabled;

            if (this.isTouchAddEnabled) {
                if (lockIcon) lockIcon.src = "ui-icons/fi-rr-lock-open-alt.svg";
                btnTouchLock.style.background = "rgba(18, 18, 20, 0.9)";
                btnTouchLock.style.borderColor = "#00e5ff";
                this.showToast("Pantalla desbloqueada: toques activados");
            } else {
                if (lockIcon) lockIcon.src = "ui-icons/fi-rr-lock.svg";
                btnTouchLock.style.background = "rgba(18, 18, 20, 0.9)";
                btnTouchLock.style.borderColor = "#00e5ff";
                this.showToast("Pantalla bloqueada para navegación");
            }
        });
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

    setupAttributionsModalEvents() {
        const modal = document.getElementById("planner-attributions-modal");
        const openBtn = document.getElementById("btn-open-attributions");
        const closeBtn = document.getElementById("btn-close-attributions-modal");
        const optionsDrawer = document.getElementById("side-panel-planner-options");

        openBtn?.addEventListener("click", () => {
            this.loadAttributionsContent();
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

    loadAttributionsContent() {
        const contentContainer = document.getElementById("attributions-modal-content");
        const titleEl = document.getElementById("attributions-modal-title");
        if (!contentContainer) return;

        if (contentContainer.dataset.loaded === "true") return;

        const data = window.PLANNER_ATTRIBUTIONS_DATA;
        if (!data) {
            contentContainer.innerHTML = `<div style="text-align: center; color: #ff5252; padding: 20px;">No se encontraron los datos de atribución.</div>`;
            return;
        }

        if (titleEl && data.title) {
            titleEl.innerText = data.title;
        }

        contentContainer.innerHTML = "";
        data.sections.forEach(sec => {
            const item = document.createElement("div");
            item.style.cssText = `
                display: flex; gap: 14px; align-items: flex-start;
                background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                border-radius: 10px; padding: 12px;
            `;

            let linkHtml = "";
            if (sec.link && sec.linkText) {
                linkHtml = `<div style="margin-top: 6px;"><a href="${sec.link}" target="_blank" rel="noopener noreferrer" style="color: #00e5ff; font-size: 0.78rem; text-decoration: underline;">${sec.linkText}</a></div>`;
            }

            item.innerHTML = `
                <div style="background: rgba(0,229,255,0.1); border-radius: 8px; padding: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <img src="${sec.icon}" width="20" height="20" style="filter: brightness(0) saturate(100%) invert(77%) sepia(93%) saturate(1352%) hue-rotate(130deg);" alt="${sec.title}">
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: bold; color: #00e5ff; margin-bottom: 4px; font-size: 0.9rem;">${sec.title}</div>
                    <div style="color: #ccc; font-size: 0.82rem; line-height: 1.4;">${sec.desc}</div>
                    ${linkHtml}
                </div>
            `;
            contentContainer.appendChild(item);
        });

        contentContainer.dataset.loaded = "true";
    },

    activateMapInteractions() {
        map.on('click', (e) => {
            if (this.isDraggingMarker) return;
            if (!this.isTouchAddEnabled) return;

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
            if (!this.isTouchAddEnabled) return;

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
                color: lastColor,
                profile: this.profile // Hereda el perfil activo actual
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
            this.showToast("Calculando...");
            this.calcularRutaBRouter();
        } else {
            this.showToast("Punto inicial fijado.");
        }
        this.updateDynamicCursorLine();
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

                // 🧹 LIMPIEZA EXPLICITA DE MARCADORES DE MÁX/MÍN Y TRAMOS
                if (this._minMaxMarkers && Array.isArray(this._minMaxMarkers)) {
                    this._minMaxMarkers.forEach(m => m.remove());
                    this._minMaxMarkers = [];
                }
                if (this._segmentMarkers && Array.isArray(this._segmentMarkers)) {
                    this._segmentMarkers.forEach(m => m.remove());
                    this._segmentMarkers = [];
                }

                this.showToast("Punto eliminado.");
            }
            this.updateDynamicCursorLine();
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

    // Convierte segundos totales en formato legible (ej: "2h 15m" o "45m")
    formatBRouterTime(totalSeconds) {
        if (!totalSeconds || isNaN(totalSeconds)) return "1m";
        const mins = Math.round(totalSeconds / 60);
        if (mins >= 60) {
            const hours = Math.floor(mins / 60);
            const remainingMins = mins % 60;
            return `${hours}h ${remainingMins}m`;
        } else {
            return `${Math.max(1, mins)}m`;
        }
    },

    async calcularRutaBRouter() {
        if (this.points.length < 2) return;
        this.syncSegmentsArray();

        try {
            const segmentFetchPromises = [];

            for (let i = 0; i < this.points.length - 1; i++) {
                const p1 = this.points[i].coords;
                const p2 = this.points[i + 1].coords;
                const segProfile = this.segments[i]?.profile || this.profile;

                // SI EL PERFIL ES MANUAL (LÍNEA RECTA PUNTO A PUNTO SIN BROUTER)
                if (segProfile === "manual-straight") {
                    const straightCoords = [];
                    const distanceMeters = this.haversine(p1[1], p1[0], p2[1], p2[0]);
                    const steps = Math.max(2, Math.floor(distanceMeters / 100)); // Puntos intermedios cada ~100m
                    
                    for (let s = 0; s <= steps; s++) {
                        const t = s / steps;
                        const lng = p1[0] + (p2[0] - p1[0]) * t;
                        const lat = p1[1] + (p2[1] - p1[1]) * t;
                        const ele1 = p1[2] !== undefined ? p1[2] : 0;
                        const ele2 = p2[2] !== undefined ? p2[2] : 0;
                        const ele = ele1 + (ele2 - ele1) * t;
                        
                        straightCoords.push([lng, lat, ele]);
                    }

                    // Estimación para tramos manuales rectos (a ~14.4 km/h)
                    const manualSeconds = distanceMeters / 4.0;

                    segmentFetchPromises.push(
                        Promise.resolve({
                            coordinates: straightCoords,
                            travelTime: manualSeconds,
                            profile: segProfile
                        })
                    );
                } else {
                    // LLAMADA NORMAL A BROUTER
                    const url = `https://brouter.de/brouter?lonlats=${p1[0]},${p1[1]}|${p2[0]},${p2[1]}&profile=${segProfile}&alternativeidx=0&format=geojson`;
                    
                    segmentFetchPromises.push(
                        fetch(url)
                            .then(res => res.json())
                            .then(data => {
                                const feature = data?.features?.[0];
                                const coords = feature?.geometry?.coordinates || [p1, p2];
                                // BRouter devuelve el tiempo en segundos dentro de properties['total-time'] o properties.time
                                const travelTime = feature?.properties?.['total-time'] || feature?.properties?.time || 0;
                                
                                return {
                                    coordinates: coords,
                                    travelTime: travelTime,
                                    profile: segProfile
                                };
                            })
                            .catch(() => ({
                                coordinates: [p1, p2],
                                travelTime: 0,
                                profile: segProfile
                            }))
                    );
                }
            }

            const segmentResults = await Promise.all(segmentFetchPromises);

            let combinedCoordinates = [];
            let totalDistM = 0;
            let totalAscent = 0;
            let totalDescent = 0;
            let totalSeconds = 0;

            segmentResults.forEach((segRes, idx) => {
                const coords = segRes.coordinates;
                totalSeconds += segRes.travelTime;

                if (idx > 0 && combinedCoordinates.length > 0) {
                    combinedCoordinates.push(...coords.slice(1));
                } else {
                    combinedCoordinates.push(...coords);
                }

                for (let j = 0; j < coords.length - 1; j++) {
                    const c1 = coords[j], c2 = coords[j + 1];
                    totalDistM += this.haversine(c1[1], c1[0], c2[1], c2[0]);
                    const diff = (c2[2] || 0) - (c1[2] || 0);
                    if (diff > 0) totalAscent += diff; else totalDescent += Math.abs(diff);
                }
            });

            const distKm = (totalDistM / 1000).toFixed(2);
            // Usamos el tiempo directo de BRouter formateado
            const timeStr = this.formatBRouterTime(totalSeconds);

            this.routesList = [{
                index: 0,
                coordinates: combinedCoordinates,
                distKm,
                timeStr,
                ascent: Math.round(totalAscent),
                descent: Math.round(totalDescent)
            }];

            this.currentRouteIndex = 0;
            this.activateRouteVariant(0);
            this.updateAltButtonVisibility();

        } catch (e) {
            console.error("Error al calcular la ruta:", e);
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
        this.updateSegmentLabels();
        this.renderMinMaxMarkers();

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

    updateDynamicCursorLine() {
        const sourceId = 'cursor-helper-source';
        const lineLayerId = 'cursor-helper-layer';

        if (!this.points || this.points.length === 0) {
            if (map && map.getSource(sourceId)) {
                if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
                map.removeSource(sourceId);
            }
            if (this._cursorMarker) {
                this._cursorMarker.remove();
                this._cursorMarker = null;
            }
            return;
        }

        const lastPoint = this.points[this.points.length - 1].coords;
        const center = map.getCenter();
        const centerCoord = [center.lng, center.lat];

        const distM = this.haversine(lastPoint[1], lastPoint[0], center.lat, center.lng);
        const distStr = distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(2).replace('.', ',')} km`;

        const geojson = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [lastPoint, centerCoord]
            }
        };

        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, { type: 'geojson', data: geojson });
            map.addLayer({
                id: lineLayerId,
                type: 'line',
                source: sourceId,
                paint: {
                    'line-color': '#000000',
                    'line-width': 2.5,
                    'line-dasharray': [3, 3],
                    'line-opacity': 0.85
                }
            });
        } else {
            map.getSource(sourceId).setData(geojson);
        }

        if (!this._cursorMarker) {
            const el = document.createElement('div');
            el.style.cssText = `
                background: transparent; color: #ffffff; font-size: 11px; font-family: sans-serif;
                font-weight: bold; text-shadow: -1px -1px 0 #121212, 1px -1px 0 #121212, -1px 1px 0 #121212, 1px 1px 0 #121212, 0 0 3px #121212;
                white-space: nowrap; pointer-events: none;
            `;
            el.innerText = distStr;

            this._cursorMarker = new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, 20] })
                .setLngLat(centerCoord)
                .addTo(map);
        } else {
            this._cursorMarker.setLngLat(centerCoord);
            const el = this._cursorMarker.getElement();
            if (el) el.innerText = distStr;
        }
    },

    updateSegmentLabels() {
        if (this._segmentMarkers && Array.isArray(this._segmentMarkers)) {
            this._segmentMarkers.forEach(m => m.remove());
        }
        this._segmentMarkers = [];

        if (!this.points || this.points.length < 2 || !this.currentRouteData || !this.currentRouteData.coordinates) {
            return;
        }

        const coords = this.currentRouteData.coordinates;
        
        for (let i = 0; i < this.points.length - 1; i++) {
            const pStart = this.points[i].coords;
            const pEnd = this.points[i+1].coords;

            const midTargetLng = (pStart[0] + pEnd[0]) / 2;
            const midTargetLat = (pStart[1] + pEnd[1]) / 2;

            let closestCoord = coords[0];
            let minDist = Infinity;
            let segmentDistM = 0;
            let subCoords = [];
            let isCollecting = false;

            for (let j = 0; j < coords.length; j++) {
                const c = coords[j];
                
                if (!isCollecting && this.haversine(c[1], c[0], pStart[1], pStart[0]) < 50) {
                    isCollecting = true;
                }

                if (isCollecting) {
                    subCoords.push(c);
                    if (subCoords.length > 1) {
                        const prev = subCoords[subCoords.length - 2];
                        segmentDistM += this.haversine(prev[1], prev[0], c[1], c[0]);
                    }
                }

                if (isCollecting && this.haversine(c[1], c[0], pEnd[1], pEnd[0]) < 50) {
                    break;
                }

                const dToMidTarget = this.haversine(c[1], c[0], midTargetLat, midTargetLng);
                if (dToMidTarget < minDist) {
                    minDist = dToMidTarget;
                    closestCoord = c;
                }
            }

            if (segmentDistM === 0) {
                segmentDistM = this.haversine(pStart[1], pStart[0], pEnd[1], pEnd[0]);
            }

            const distStr = segmentDistM < 1000 ? `${Math.round(segmentDistM)} m` : `${(segmentDistM / 1000).toFixed(2).replace('.', ',')} km`;

            const el = document.createElement('div');
            el.style.cssText = `
                background: transparent; color: #ffffff; font-size: 10px; font-family: sans-serif;
                font-weight: bold; text-shadow: -1px -1px 0 #121212, 1px -1px 0 #121212, -1px 1px 0 #121212, 1px 1px 0 #121212, 0 0 3px #121212;
                white-space: nowrap; pointer-events: none; transform: translate(-50%, -50%);
            `;
            el.innerText = distStr;

            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat(closestCoord)
                .addTo(map);

            this._segmentMarkers.push(marker);
        }
    },

    renderMinMaxMarkers() {
        if (this._minMaxMarkers && Array.isArray(this._minMaxMarkers)) {
            this._minMaxMarkers.forEach(m => m.remove());
        }
        this._minMaxMarkers = [];

        if (!this.currentRouteData || !this.currentRouteData.coordinates || this.currentRouteData.coordinates.length === 0) {
            return;
        }

        const coords = this.currentRouteData.coordinates;
        let maxPt = coords[0];
        let minPt = coords[0];

        coords.forEach(pt => {
            const ele = pt[2] !== undefined ? pt[2] : 0;
            if (ele > (maxPt[2] !== undefined ? maxPt[2] : -Infinity)) maxPt = pt;
            if (ele < (minPt[2] !== undefined ? minPt[2] : Infinity)) minPt = pt;
        });

        const targets = [
            { pt: maxPt, type: 'max', color: '#00e5ff', prefix: '▲ ' },
            { pt: minPt, type: 'min', color: '#ff7043', prefix: '▼ ' }
        ];

        targets.forEach(item => {
            if (item.pt[2] === undefined) return;

            const eleStr = `${item.prefix}${Math.round(item.pt[2])} m`;

            const container = document.createElement('div');
            container.style.cssText = `
                display: flex; flex-direction: column; align-items: center; pointer-events: none; transform: translate(-50%, -50%);
            `;

            const badge = document.createElement('div');
            badge.style.cssText = `
                background-color: #121212; color: ${item.color}; border: 2px solid ${item.color};
                border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
                box-shadow: 0 2px 6px rgba(0,0,0,0.6);
            `;

            const iconImg = document.createElement('img');
            iconImg.src = 'ui-icons/fi-rr-mountains.svg';
            iconImg.width = 16;
            iconImg.height = 16;
            iconImg.style.filter = item.type === 'max'
                ? 'brightness(0) saturate(100%) invert(77%) sepia(93%) saturate(1352%) hue-rotate(130deg)'
                : 'brightness(0) saturate(100%) invert(56%) sepia(85%) saturate(1480%) hue-rotate(338deg)';

            badge.appendChild(iconImg);

            const label = document.createElement('div');
            label.style.cssText = `
                background: transparent; color: ${item.color}; font-size: 10px; font-family: sans-serif;
                font-weight: bold; text-shadow: -1px -1px 0 #121212, 1px -1px 0 #121212, -1px 1px 0 #121212, 1px 1px 0 #121212, 0 0 3px #121212;
                white-space: nowrap; margin-top: 3px;
            `;
            label.innerText = eleStr;

            container.appendChild(badge);
            container.appendChild(label);

            const marker = new maplibregl.Marker({ element: container, anchor: 'center' })
                .setLngLat([item.pt[0], item.pt[1]])
                .addTo(map);

            this._minMaxMarkers.push(marker);
        });
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
                        subCoords.push(activeRoute.coordinates[coordIndex]);
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

                // Detectar si el tramo es manual para aplicar línea intermitente
                const isManual = seg.profile === "manual-straight";

                if (!map.getLayer(`active-segment-solid-${sIdx}`)) {
                    map.addLayer({
                        id: `active-segment-solid-${sIdx}`,
                        type: 'line',
                        source: segSourceId,
                        paint: { 
                            'line-color': seg.color || '#00e5ff', 
                            'line-width': 4.5,
                            ...(isManual ? { 'line-dasharray': [2, 2] } : {})
                        }
                    });
                }
            });
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
        } catch (e) {
            // Ignorar errores de capas ausentes
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
        
        const sourceId = 'cursor-helper-source';
        const layerId = 'cursor-helper-layer';
        if (map && map.getSource(sourceId)) {
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            map.removeSource(sourceId);
        }
        if (this._cursorMarker) {
            this._cursorMarker.remove();
            this._cursorMarker = null;
        }
        if (this._segmentMarkers && Array.isArray(this._segmentMarkers)) {
            this._segmentMarkers.forEach(m => m.remove());
            this._segmentMarkers = [];
        }
        if (this._minMaxMarkers && Array.isArray(this._minMaxMarkers)) {
            this._minMaxMarkers.forEach(m => m.remove());
            this._minMaxMarkers = [];
        }

        this.showToast("Planificación limpia.");
    },

    toggleGraph() {
        this.isGraphOpen = !this.isGraphOpen;
        const graphContainer = document.getElementById("planner-graph-container");
        const zoomControls = document.getElementById("planner-zoom-controls");
        const touchLockBtn = document.getElementById("planner-btn-touch-lock");
        const btnGraph = document.getElementById("btn-planner-graph");

        if (graphContainer) graphContainer.style.display = this.isGraphOpen ? "flex" : "none";
        
        const targetBottom = this.isGraphOpen ? "320px" : "140px";
        if (zoomControls) zoomControls.style.bottom = targetBottom;
        if (touchLockBtn) touchLockBtn.style.bottom = targetBottom;

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
        const touchLockBtn = document.getElementById("planner-btn-touch-lock");
        
        if (zoomControls) zoomControls.style.bottom = "140px";
        if (touchLockBtn) touchLockBtn.style.bottom = "140px";
    },

    showToast(message) {
        const statusTextEl = document.getElementById("banner-status-text");
        if (!statusTextEl) return;

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
            "fastbike": "Carretera",
            "manual-straight": "Punto a punto (Recto)"
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

            marker.on('drag', () => {
                const lngLat = marker.getLngLat();
                this.points[index].coords = [lngLat.lng, lngLat.lat];
                this.updateDynamicCursorLine();
            });

            marker.on('dragend', () => {
                el.style.transform = "translate(-50%, -50%) scale(1) translateZ(0)";
                const lngLat = marker.getLngLat();
                this.points[index].coords = [lngLat.lng, lngLat.lat];
                
                if (this.points.length >= 2) {
                    this.showToast("Recalculando...");
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

                this.updateDynamicCursorLine();
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
            btnFocus.innerHTML = `<img src="ui-icons/fi-rr-location-crosshairs.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(77%);" alt="Ir">`;
            btnFocus.addEventListener("click", (e) => {
                e.stopPropagation();
                if (map) map.flyTo({ center: point.coords, zoom: 15 });
            });

            const btnDelete = document.createElement("button");
            btnDelete.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center;";
            btnDelete.innerHTML = `<img src="ui-icons/fi-rr-trash.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(43%) sepia(93%) saturate(1352%) hue-rotate(334deg);" alt="Borrar">`;
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

        const profileOptions = [
            { value: "hiking-mountain", label: "Senderismo" },
            { value: "trekking", label: "Trekking" },
            { value: "mtb", label: "MTB" },
            { value: "gravel", label: "Gravel" },
            { value: "fastbike", label: "Carretera" },
            { value: "manual-straight", label: "Punto a punto (Recto)" }
        ];

        this.segments.forEach((seg, index) => {
            const itemRow = document.createElement("div");
            itemRow.style.cssText = `
                display: flex; flex-direction: column; gap: 8px;
                background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px; padding: 10px; width: 100%; box-sizing: border-box;
            `;

            const topRow = document.createElement("div");
            topRow.style.cssText = `display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;`;

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

            topRow.appendChild(badge);
            topRow.appendChild(nameInput);
            topRow.appendChild(colorInput);

            const bottomRow = document.createElement("div");
            bottomRow.style.cssText = `display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px;`;

            const profileLabel = document.createElement("span");
            profileLabel.style.cssText = "font-size: 0.75rem; color: #aaa;";
            profileLabel.innerText = "Perfil del tramo:";

            const profileSelect = document.createElement("select");
            profileSelect.style.cssText = `
                background: rgba(18,18,20,0.9); color: #00e5ff; border: 1px solid rgba(0,229,255,0.3);
                border-radius: 6px; padding: 2px 6px; font-size: 0.75rem; outline: none; cursor: pointer;
            `;
            
            profileOptions.forEach(opt => {
                const optEl = document.createElement("option");
                optEl.value = opt.value;
                optEl.innerText = opt.label;
                if (seg.profile === opt.value) {
                    optEl.selected = true;
                }
                profileSelect.appendChild(optEl);
            });

            ['click', 'focus', 'touchstart', 'pointerdown'].forEach(evt => {
                profileSelect.addEventListener(evt, (e) => e.stopPropagation());
            });

            profileSelect.addEventListener("change", (e) => {
                this.segments[index].profile = e.target.value;
                this.showToast(`Tramo ${index + 1} actualizado`);
                if (this.points.length >= 2) {
                    this.calcularRutaBRouter();
                }
            });

            bottomRow.appendChild(profileLabel);
            bottomRow.appendChild(profileSelect);

            itemRow.appendChild(topRow);
            itemRow.appendChild(bottomRow);
            container.appendChild(itemRow);
        });
    },

    renderElevationGraph(coordinates) {
        const wrapper = document.getElementById("elevation-svg-wrapper");
        const rangeLabel = document.getElementById("graph-elevation-range");
        if (!wrapper || !coordinates || coordinates.length === 0) return;
        
        const elevations = coordinates.map(c => c[2] !== undefined ? c[2] : 0);
        const minEleRaw = Math.min(...elevations);
        const maxEleRaw = Math.max(...elevations);
        
        const paddingEle = Math.max(5, (maxEleRaw - minEleRaw) * 0.1);
        const minEle = Math.floor(minEleRaw - paddingEle);
        const maxEle = Math.ceil(maxEleRaw + paddingEle);
        const rangeEle = maxEle - minEle || 1;
        
        if (rangeLabel) rangeLabel.innerText = `${Math.round(minEleRaw)} m / ${Math.round(maxEleRaw)} m`;
        
        let totalDistM = 0;
        const distances = [0];
        for (let i = 0; i < coordinates.length - 1; i++) {
            const p1 = coordinates[i],
                p2 = coordinates[i + 1];
            const d = this.haversine(p1[1], p1[0], p2[1], p2[0]);
            totalDistM += d;
            distances.push(totalDistM);
        }
        
        const width = wrapper.clientWidth || 350;
        const height = 110;
        const marginLeft = 40;
        const marginBottom = 20;
        const effectiveWidth = width - marginLeft - 10;
        const effectiveHeight = height - marginBottom - 10;
        
        let polylinePoints = "";
        let polygonPoints = `${marginLeft},${height - marginBottom} `;
        
        coordinates.forEach((c, i) => {
            const distRatio = totalDistM > 0 ? distances[i] / totalDistM : 0;
            const x = marginLeft + distRatio * effectiveWidth;
            const ele = elevations[i];
            const y = (height - marginBottom) - ((ele - minEle) / rangeEle) * effectiveHeight;
            
            polylinePoints += `${x.toFixed(1)},${y.toFixed(1)} `;
            polygonPoints += `${x.toFixed(1)},${y.toFixed(1)} `;
        });
        polygonPoints += `${marginLeft + effectiveWidth},${height - marginBottom}`;
        
        let gridLinesY = "";
        let labelsY = "";
        const stepsY = 4;
        for (let i = 0; i <= stepsY; i++) {
            const val = minEle + (rangeEle / stepsY) * i;
            const y = (height - marginBottom) - (i / stepsY) * effectiveHeight;
            
            gridLinesY += `<line x1="${marginLeft}" y1="${y}" x2="${width - 10}" y2="${y}" stroke="rgba(255,255,255,0.1)" stroke-dasharray="3,3" />`;
            labelsY += `<text x="${marginLeft - 6}" y="${y + 3}" fill="#888" font-size="9" text-anchor="end" font-family="sans-serif">${Math.round(val)}</text>`;
        }
        
        let gridLinesX = "";
        let labelsX = "";
        const stepsX = 3;
        for (let i = 0; i <= stepsX; i++) {
            const distVal = (totalDistM / stepsX) * i;
            const x = marginLeft + (i / stepsX) * effectiveWidth;
            
            if (i > 0 && i < stepsX) {
                gridLinesX += `<line x1="${x}" y1="10" x2="${x}" y2="${height - marginBottom}" stroke="rgba(255,255,255,0.1)" stroke-dasharray="3,3" />`;
            }
            
            let distStr = "";
            if (totalDistM < 1000) {
                distStr = `${Math.round(distVal)} m`;
            } else {
                distStr = `${(distVal / 1000).toFixed(1).replace('.', ',')} km`;
            }
            
            if (i > 0) {
                labelsX += `<text x="${x}" y="${height - 4}" fill="#888" font-size="9" text-anchor="middle" font-family="sans-serif">${distStr}</text>`;
            }
        }
        
        wrapper.innerHTML = `
            <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">
                <defs>
                    <linearGradient id="elevation-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="#00e5ff" stop-opacity="0.0"/>
                    </linearGradient>
                </defs>
                
                ${gridLinesY}
                ${gridLinesX}
                <line x1="${marginLeft}" y1="${height - marginBottom}" x2="${width - 10}" y2="${height - marginBottom}" stroke="rgba(255,255,255,0.2)" />
                <line x1="${marginLeft}" y1="10" x2="${marginLeft}" y2="${height - marginBottom}" stroke="rgba(255,255,255,0.2)" />

                ${labelsY}
                ${labelsX}

                <polygon points="${polygonPoints}" fill="url(#elevation-gradient)" />
                <polyline points="${polylinePoints}" fill="none" stroke="#00e5ff" stroke-width="2" stroke-linejoin="round" />
            </svg>
        `;
    }
};

window.RoutePlanner = RoutePlanner;
document.addEventListener("DOMContentLoaded", () => RoutePlanner.init());
