// ==========================================
// POI-MANAGER.JS - Módulo independiente de Puntos de Interés (POIs) con iconos pois_otromundo
// ==========================================

const PoiManager = {
    pois: [],
    markers: [],
    markerEntries: [],
    isPlacingMode: false,
    movingPoiId: null,
    alwaysShowLabels: false,
    storageKey: "otromundo_custom_pois",
    labelsPrefKey: "otromundo_pois_always_labels",
    publicBaseUrl: "https://tronpo.github.io/otromundo/",
    hoveredPoiId: null,
    lastMouseLngLat: null,
    _proximityRafId: null,

    // Presets principales usando rutas exactas verificadas en pois_otromundo/
    categories: [
        { id: "general", label: "Punto de Interés", icon: "pois_otromundo/tourism/guidepost.svg", color: "#00e5ff" },
        { id: "water", label: "Agua / Fuente", icon: "pois_otromundo/amenity/drinking_water.svg", color: "#00b0ff" },
        { id: "peak", label: "Cima / Collado", icon: "pois_otromundo/natural/peak.svg", color: "#00e676" },
        { id: "shelter", label: "Refugio / Vivac", icon: "pois_otromundo/tourism/alpinehut.svg", color: "#00e5ff" },
        { id: "viewpoint", label: "Mirador / Vista", icon: "pois_otromundo/tourism/viewpoint.svg", color: "#00e5ff" },
        { id: "danger", label: "Precaución / Paso", icon: "pois_otromundo/barrier/gate.svg", color: "#ff3b30" }
    ],

    // Traducciones al español para mostrar nombres claros y permitir búsquedas en español o inglés
    iconSpanishNames: {
        // tourism
        "alpinehut.svg": "Refugio Guardado",
        "camping.svg": "Camping / Acampada",
        "caravan_park.svg": "Área Autocaravanas",
        "guidepost.svg": "Poste Indicador",
        "hotel.svg": "Hotel / Alojamiento",
        "museum.svg": "Museo",
        "office.svg": "Oficina Turismo",
        "picnic.svg": "Área de Picnic",
        "terminal.svg": "Terminal / Estación",
        "viewpoint.svg": "Mirador",
        "wilderness_hut.svg": "Refugio Libre / Vivac",
        // natural
        "cave.svg": "Cueva / Sima",
        "peak.svg": "Cima / Pico",
        "saddle.svg": "Collado / Portillo",
        "spring.svg": "Manantial / Naciente",
        "waterfall.svg": "Cascada / Salto",
        // amenity
        "bench.svg": "Banco / Descanso",
        "bicycle_repair_station.svg": "Taller Bici",
        "charging_station.svg": "Punto de Carga",
        "drinking_water.svg": "Agua Potable",
        "emergency_phone.svg": "Teléfono SOS",
        "firestation.svg": "Bomberos",
        "fountain.svg": "Fuente",
        "fuel.svg": "Gasolinera",
        "hospital.svg": "Hospital / Urgencias",
        "hunting_stand.svg": "Puesto de Caza / Observación",
        "pharmacy.svg": "Farmacia",
        "police.svg": "Policía / Guardia",
        "restaurant.svg": "Restaurante / Comida",
        "shelter.svg": "Refugio / Cubierto",
        "toilets.svg": "Aseos / WC",
        // historic
        "archaeological_site.svg": "Yacimiento Arqueológico",
        "bust.svg": "Busto / Escultura",
        "castle.svg": "Castillo",
        "city_gate.svg": "Puerta Histórica",
        "fort.svg": "Fuerte",
        "fortress.svg": "Fortaleza",
        "manor.svg": "Casona / Palacio Rural",
        "memorial.svg": "Memorial",
        "monument.svg": "Monumento",
        "obelisk.svg": "Obelisco / Hito",
        "palace.svg": "Palacio",
        "plaque.svg": "Placa Conmemorativa",
        "shrine.svg": "Ermita / Santuario",
        "statue.svg": "Estatua",
        "stone.svg": "Monolito / Piedra",
        // highway
        "bus_stop.svg": "Parada de Bus",
        "ford.svg": "Vado de Río",
        "mountain_pass.svg": "Puerto de Montaña",
        // barrier
        "cattle_grid.svg": "Paso Canadiense",
        "cycle_barrier.svg": "Barrera Ciclista",
        "full-height_turnstile.svg": "Torno Alto",
        "gate.svg": "Cancilla / Puerta",
        "kissing_gate.svg": "Portillo Peatonal",
        "level_crossing.svg": "Paso a Nivel",
        "level_crossing2.svg": "Paso a Nivel (2)",
        "level_crossing_incomplete.svg": "Paso sin Barrera",
        "lift_gate.svg": "Barrera Levadiza",
        "motorcycle_barrier.svg": "Barrera Moto",
        "stile.svg": "Escalera de Cercado",
        "toll_booth.svg": "Peaje / Control",
        // man_made
        "cross.svg": "Cruz / Cima",
        "lighthouse.svg": "Faro",
        "tower_defensive.svg": "Torre / Atalaya",
        "watermill.svg": "Molino de Agua",
        "windmill.svg": "Molino de Viento",
        // shop
        "bicycle.svg": "Tienda de Bicis",
        "outdoor.svg": "Tienda de Montaña",
        "pet.svg": "Animales / Veterinaria",
        "supermarket.svg": "Supermercado / Víveres"
    },

    // Catálogo exacto de los 69 iconos presentes en pois_otromundo/
    folderCatalog: [
        {
            id: "natural",
            label: "Naturaleza y Relieve",
            color: "#00e676",
            icons: ["peak.svg", "saddle.svg", "spring.svg", "waterfall.svg", "cave.svg"]
        },
        {
            id: "tourism",
            label: "Turismo, Refugios y Miradores",
            color: "#00e5ff",
            icons: ["alpinehut.svg", "wilderness_hut.svg", "viewpoint.svg", "guidepost.svg", "camping.svg", "picnic.svg", "hotel.svg", "caravan_park.svg", "office.svg", "museum.svg", "terminal.svg"]
        },
        {
            id: "amenity",
            label: "Agua y Servicios",
            color: "#ffab40",
            icons: ["drinking_water.svg", "fountain.svg", "shelter.svg", "restaurant.svg", "bench.svg", "toilets.svg", "bicycle_repair_station.svg", "hospital.svg", "pharmacy.svg", "emergency_phone.svg", "police.svg", "firestation.svg", "hunting_stand.svg", "fuel.svg", "charging_station.svg"]
        },
        {
            id: "barrier",
            label: "Barreras y Pasos",
            color: "#ff3b30",
            icons: ["gate.svg", "kissing_gate.svg", "stile.svg", "cattle_grid.svg", "lift_gate.svg", "cycle_barrier.svg", "motorcycle_barrier.svg", "full-height_turnstile.svg", "level_crossing.svg", "level_crossing2.svg", "level_crossing_incomplete.svg", "toll_booth.svg"]
        },
        {
            id: "highway",
            label: "Vías y Puertos",
            color: "#ffea00",
            icons: ["mountain_pass.svg", "ford.svg", "bus_stop.svg"]
        },
        {
            id: "historic",
            label: "Patrimonio e Historia",
            color: "#d500f9",
            icons: ["castle.svg", "fortress.svg", "fort.svg", "archaeological_site.svg", "shrine.svg", "monument.svg", "memorial.svg", "statue.svg", "bust.svg", "obelisk.svg", "stone.svg", "plaque.svg", "city_gate.svg", "palace.svg", "manor.svg"]
        },
        {
            id: "man_made",
            label: "Infraestructuras y Construcciones",
            color: "#b0bec5",
            icons: ["cross.svg", "tower_defensive.svg", "watermill.svg", "windmill.svg", "lighthouse.svg"]
        },
        {
            id: "shop",
            label: "Comercios y Tiendas",
            color: "#ff4081",
            icons: ["outdoor.svg", "bicycle.svg", "supermarket.svg", "pet.svg"]
        }
    ],

    init() {
        this.loadFromStorage();
        this.injectFloatingButton();
        this.injectPoisTabInDrawer();
        this.optimizePointsDrawerLayout();
        this.hookPlannerInputMethods();
        this.setupMapListeners();
        this.hookRoutePointCreationBlock();
        this.hookExporter();
    },

    // Optimiza la altura flexible del contenedor de Puntos, Segmentos y POIs para PC y móvil
    optimizePointsDrawerLayout() {
        const applyLayoutFix = () => {
            const panel = document.getElementById("side-panel-points-list");
            const body = panel?.querySelector(".side-drawer-body");
            const listContainer = document.getElementById("planner-points-items-container");

            if (body) {
                body.style.display = "flex";
                body.style.flexDirection = "column";
                body.style.height = "calc(100% - 56px)";
                body.style.maxHeight = "none";
                body.style.overflow = "hidden";
                body.style.boxSizing = "border-box";
            }

            if (listContainer) {
                listContainer.style.flex = "1 1 auto";
                listContainer.style.minHeight = "0";
                listContainer.style.maxHeight = "none";
                listContainer.style.overflowY = "auto";
                listContainer.style.paddingBottom = "24px";
            }
        };

        applyLayoutFix();
        const waitDrawer = setInterval(() => {
            if (document.getElementById("planner-points-items-container")) {
                applyLayoutFix();
                clearInterval(waitDrawer);
            }
        }, 150);
    },

    // Evita que al arrastrar un POI en modo mover se añadan puntos de ruta en el mapa
    hookRoutePointCreationBlock() {
        const waitForPlanner = setInterval(() => {
            const planner = window.RoutePlanner;
            if (!planner || typeof planner.addPoint !== "function" || planner._poiMoveBlockHooked) return;
            planner._poiMoveBlockHooked = true;
            clearInterval(waitForPlanner);

            const origAddPoint = planner.addPoint.bind(planner);
            planner.addPoint = (...args) => {
                if (this.movingPoiId) {
                    return;
                }
                return origAddPoint(...args);
            };
        }, 150);
    },

    // Activa el arrastre únicamente para el POI indicado (cerrando el modal para ver bien el mapa)
    startMovingPoi(poiId) {
        const poi = this.pois.find(p => p.id === poiId);
        if (!poi) return;

        this.movingPoiId = poiId;
        this.syncMarkersDraggableState();
        window.RoutePlanner?.showToast?.(`Moviendo "${poi.name}": arrastra el pin y suelta`);
    },

    stopMovingPoi() {
        if (!this.movingPoiId) return;
        this.movingPoiId = null;
        this.syncMarkersDraggableState();
    },

    // Solo es arrastrable el POI que esté explícitamente en modo mover desde su modal
    isPoiDraggable(poiId) {
        return Boolean(this.movingPoiId && this.movingPoiId === poiId);
    },

    syncMarkersDraggableState() {
        this.markerEntries.forEach(entry => {
            const { poi, marker, wrapper } = entry;
            const canDrag = this.isPoiDraggable(poi.id);
            if (marker && typeof marker.setDraggable === "function") {
                marker.setDraggable(canDrag);
            }
            if (wrapper) {
                wrapper.style.cursor = canDrag ? "grab" : "pointer";
                wrapper.style.zIndex = canDrag ? "25" : "";
            }
        });
    },

    getFolderCatalog() {
        return this.folderCatalog;
    },

    loadFromStorage() {
        try {
            if (window.localStorage) {
                const raw = localStorage.getItem(this.storageKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) this.pois = parsed;
                }
                const savedLabelPref = localStorage.getItem(this.labelsPrefKey);
                if (savedLabelPref !== null) {
                    this.alwaysShowLabels = savedLabelPref === "true";
                }
            }
        } catch (e) {
            this.pois = [];
        }
    },

    saveToStorage() {
        try {
            if (window.localStorage) {
                localStorage.setItem(this.storageKey, JSON.stringify(this.pois));
                localStorage.setItem(this.labelsPrefKey, String(this.alwaysShowLabels));
            }
        } catch (e) {}
    },

    getCategoryMeta(catId) {
        return this.categories.find(c => c.id === catId) || this.categories[0];
    },

    getPoiVisualMeta(poi) {
        const cat = this.getCategoryMeta(poi.category);
        return {
            icon: poi.customIcon || cat.icon,
            color: poi.customColor || cat.color,
            label: poi.customLabel || cat.label
        };
    },

    formatIconName(filename) {
        if (this.iconSpanishNames[filename]) {
            return this.iconSpanishNames[filename];
        }
        return filename
            .replace(/\.svg$/i, "")
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, l => l.toUpperCase());
    },

    resolvePublicIconUrl(iconRelPath) {
        const base = (window.location.hostname && window.location.hostname.includes("github.io"))
            ? `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "/")}`
            : this.publicBaseUrl;
        return new URL(iconRelPath, base).href;
    },

    // ==========================================
    // 1. BOTÓN FLOTANTE EN EL PANEL LATERAL DE CONTROLES
    // ==========================================
    injectFloatingButton() {
        const tryInject = () => {
            if (document.getElementById("planner-btn-add-poi")) return true;

            const btnPoi = document.createElement("button");
            btnPoi.id = "planner-btn-add-poi";
            btnPoi.type = "button";
            btnPoi.className = "planner-float-btn";
            btnPoi.title = "Añadir Punto de Interés (POI) sin modificar la ruta";
            btnPoi.style.cssText = `
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: rgba(18, 18, 20, 0.92);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1.5px solid #00e5ff;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.55);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                padding: 0;
                flex-shrink: 0;
                z-index: 1005;
            `;
            btnPoi.innerHTML = `<img id="planner-poi-btn-icon" src="ui-icons/fi-rr-map-marker-plus.svg" width="20" height="20" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg); pointer-events: none; display: block;" alt="POI">`;

            btnPoi.addEventListener("click", (e) => {
                e.stopPropagation();
                this.togglePlacingMode();
            });

            const controlsGroup = document.getElementById("planner-zoom-controls");
            if (controlsGroup) {
                const optionsBtn = document.getElementById("planner-btn-options");
                if (optionsBtn && optionsBtn.parentElement === controlsGroup) {
                    controlsGroup.insertBefore(btnPoi, optionsBtn);
                } else {
                    controlsGroup.appendChild(btnPoi);
                }
                return true;
            }

            btnPoi.style.position = "fixed";
            btnPoi.style.right = "16px";
            btnPoi.style.bottom = "250px";
            document.body.appendChild(btnPoi);
            return false;
        };

        tryInject();
        const waitForControls = setInterval(() => {
            const btnPoi = document.getElementById("planner-btn-add-poi");
            const controlsGroup = document.getElementById("planner-zoom-controls");
            if (btnPoi && controlsGroup && btnPoi.parentElement !== controlsGroup) {
                const optionsBtn = document.getElementById("planner-btn-options");
                btnPoi.style.position = "";
                btnPoi.style.right = "";
                btnPoi.style.bottom = "";
                if (optionsBtn && optionsBtn.parentElement === controlsGroup) {
                    controlsGroup.insertBefore(btnPoi, optionsBtn);
                } else {
                    controlsGroup.appendChild(btnPoi);
                }
                clearInterval(waitForControls);
            } else if (btnPoi && controlsGroup && btnPoi.parentElement === controlsGroup) {
                clearInterval(waitForControls);
            }
        }, 200);
    },

    togglePlacingMode(forceState) {
        this.isPlacingMode = typeof forceState === "boolean" ? forceState : !this.isPlacingMode;
        const btnPoi = document.getElementById("planner-btn-add-poi");
        const icon = document.getElementById("planner-poi-btn-icon");

        if (btnPoi) {
            btnPoi.style.background = this.isPlacingMode ? "#00e5ff" : "rgba(18, 18, 20, 0.92)";
            btnPoi.style.borderColor = this.isPlacingMode ? "#121214" : "#00e5ff";
        }
        if (icon) {
            icon.style.filter = this.isPlacingMode
                ? "brightness(0)"
                : "brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg)";
        }

        const mainAddBtn = document.getElementById("planner-btn-add");
        if (mainAddBtn) {
            const addImg = mainAddBtn.querySelector("img");
            const addSpan = mainAddBtn.querySelector("span");
            if (this.isPlacingMode) {
                if (addImg) addImg.src = "ui-icons/fi-rr-map-marker-plus.svg";
                if (addSpan) addSpan.innerText = "Añadir POI";
            } else {
                if (addImg) addImg.src = "ui-icons/fi-rr-square-plus.svg";
                if (addSpan) addSpan.innerText = "Añadir";
            }
        }

        if (this.isPlacingMode) {
            window.RoutePlanner?.showToast?.("Modo POI activo: sitúa puntos y pulsa el botón POI de nuevo para salir");
        } else {
            window.RoutePlanner?.showToast?.("Modo POI desactivado");
        }
    },

    // ==========================================
    // 2. INTERACCIÓN UNIFICADA Y REFRESCO DEL PANEL LATERAL
    // ==========================================
    hookPlannerInputMethods() {
        const waitForPlanner = setInterval(() => {
            const planner = window.RoutePlanner;
            if (!planner || typeof planner.addPoint !== "function") return;
            clearInterval(waitForPlanner);

            if (!planner._poiAddPointHooked) {
                planner._poiAddPointHooked = true;

                const originalAddPoint = planner.addPoint.bind(planner);
                planner.addPoint = (lngLat, defaultName) => {
                    if (this.isPlacingMode) {
                        const coords = Array.isArray(lngLat)
                            ? [lngLat[0], lngLat[1]]
                            : [lngLat.lng, lngLat.lat];
                        const newPoi = this.createPoi(coords);
                        this.openEditModal(newPoi.id);
                        return;
                    }
                    return originalAddPoint(lngLat, defaultName);
                };
            }

            if (typeof planner.renderActiveDrawerTab === "function" && !planner._poiTabHooked) {
                planner._poiTabHooked = true;
                const origRenderTab = planner.renderActiveDrawerTab.bind(planner);
                planner.renderActiveDrawerTab = (...args) => {
                    this.optimizePointsDrawerLayout();
                    if (planner.activeTab === "pois") {
                        this.renderPoisListDrawer();
                        return;
                    }
                    return origRenderTab(...args);
                };
            }
        }, 150);
    },

    setupMapListeners() {
        const waitForMap = setInterval(() => {
            const mapObj = window.map;
            if (!mapObj || typeof mapObj.on !== "function" || typeof maplibregl === "undefined") return;
            clearInterval(waitForMap);

            mapObj.on("click", (e) => {
                if (!this.isPlacingMode) return;

                e.preventDefault?.();
                const lngLat = [e.lngLat.lng, e.lngLat.lat];
                const newPoi = this.createPoi(lngLat);
                this.openEditModal(newPoi.id);
            });

            mapObj.on("mousemove", (e) => {
                this.lastMouseLngLat = e.lngLat;
                this.scheduleLabelVisibilityUpdate();
            });

            mapObj.on("move", () => {
                this.scheduleLabelVisibilityUpdate();
            });

            const container = mapObj.getContainer?.();
            container?.addEventListener("mouseleave", () => {
                this.lastMouseLngLat = null;
                this.hoveredPoiId = null;
                this.scheduleLabelVisibilityUpdate();
            });

            // Renderizar de inmediato al arrancar (un Marker DOM de MapLibre funciona sin esperar a style.load)
            this.renderAllMarkers();

            // Y asegurar re-renderizado si el mapa termina de cargar o cambia de estilo
            mapObj.once("load", () => this.renderAllMarkers());
            mapObj.on("style.load", () => {
                setTimeout(() => this.renderAllMarkers(), 200);
            });
        }, 150);
    },

    // ==========================================
    // 3. RENDERIZADO DE MARCADORES DE POIS EN EL MAPA
    // ==========================================
    renderAllMarkers() {
        const mapObj = window.map;
        if (!mapObj || typeof maplibregl === "undefined") return;

        this.markers.forEach(m => {
            try { m.remove(); } catch (e) {}
        });
        this.markers = [];
        this.markerEntries = [];

        this.pois.forEach(poi => {
            if (!Array.isArray(poi.coords) || poi.coords.length < 2) return;
            const visual = this.getPoiVisualMeta(poi);

            // IMPORTANTE: No asignar "position: relative" al wrapper raíz del Marker,
            // porque MapLibre GL necesita controlar su "position: absolute" para anclarlo al mapa.
            const wrapper = document.createElement("div");
            wrapper.className = "otromundo-poi-marker";
            wrapper.style.cssText = `
                width: 32px;
                height: 39px;
                cursor: grab;
                user-select: none;
            `;

            // Contenedor interno relativo solo para posicionar la etiqueta encima del pin
            const innerBox = document.createElement("div");
            innerBox.style.cssText = `
                position: relative;
                width: 32px;
                height: 39px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            // Etiqueta tipográfica limpia sin cápsula (solo texto con halo oscuro)
            const labelEl = document.createElement("div");
            labelEl.innerText = poi.name;
            labelEl.style.cssText = `
                position: absolute;
                bottom: 41px;
                left: 50%;
                transform: translateX(-50%);
                background: transparent;
                color: #ffffff;
                font-family: sans-serif;
                font-size: 11.5px;
                font-weight: bold;
                letter-spacing: 0.2px;
                text-shadow: -1.5px -1.5px 0 #121212, 1.5px -1.5px 0 #121212, -1.5px 1.5px 0 #121212, 1.5px 1.5px 0 #121212, 0 0 4px #121212;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.16s ease;
            `;

            // Icono pin SVG
            const pinImg = document.createElement("img");
            pinImg.src = visual.icon;
            pinImg.width = 32;
            pinImg.height = 39;
            pinImg.alt = poi.name;
            pinImg.draggable = false;
            pinImg.style.cssText = `
                display: block;
                width: 32px;
                height: 39px;
                object-fit: contain;
                filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.65));
                pointer-events: auto;
            `;

            innerBox.appendChild(labelEl);
            innerBox.appendChild(pinImg);
            wrapper.appendChild(innerBox);

            wrapper.addEventListener("mouseenter", () => {
                this.hoveredPoiId = poi.id;
                this.scheduleLabelVisibilityUpdate();
            });

            wrapper.addEventListener("mouseleave", () => {
                if (this.hoveredPoiId === poi.id) {
                    this.hoveredPoiId = null;
                    this.scheduleLabelVisibilityUpdate();
                }
            });

            let isDragging = false;

            wrapper.addEventListener("click", (e) => {
                e.stopPropagation();
                if (isDragging) return;
                // Si el usuario tocó el POI que estaba moviendo, fijamos su posición al tocarlo
                if (this.movingPoiId === poi.id) {
                    this.stopMovingPoi();
                    window.RoutePlanner?.showToast?.(`Posición de "${poi.name}" fijada`);
                    return;
                }
                this.openEditModal(poi.id);
            });

            const marker = new maplibregl.Marker({
                element: wrapper,
                anchor: "bottom",
                draggable: this.isPoiDraggable(poi.id)
            })
                .setLngLat([Number(poi.coords[0]), Number(poi.coords[1])])
                .addTo(mapObj);

            marker.on("dragstart", () => {
                if (!this.isPoiDraggable(poi.id)) {
                    marker.setDraggable(false);
                    return;
                }
                isDragging = true;
                wrapper.style.cursor = "grabbing";
            });

            marker.on("dragend", () => {
                const lngLat = marker.getLngLat();
                poi.coords = [lngLat.lng, lngLat.lat];
                this.saveToStorage();
                this.stopMovingPoi();
                this.refreshDrawerListIfActive();
                this.scheduleLabelVisibilityUpdate();
                window.RoutePlanner?.showToast?.(`"${poi.name}" movido`);
                setTimeout(() => { isDragging = false; }, 120);
            });

            this.markers.push(marker);
            this.markerEntries.push({ poi, marker, labelEl, wrapper });
        });

        this.syncMarkersDraggableState();
        this.scheduleLabelVisibilityUpdate();
    },

    scheduleLabelVisibilityUpdate() {
        if (this._proximityRafId) return;
        this._proximityRafId = requestAnimationFrame(() => {
            this._proximityRafId = null;
            this.updateLabelVisibility();
        });
    },

    updateLabelVisibility() {
        const mapObj = window.map;
        if (!mapObj || this.markerEntries.length === 0) return;

        // Si el interruptor global de mostrar nombres está activo, mostramos todos
        if (this.alwaysShowLabels) {
            this.markerEntries.forEach(entry => {
                if (!entry.labelEl) return;
                entry.labelEl.style.opacity = "1";
            });
            return;
        }

        // Por defecto: mostrar solo al pasar el ratón o el centro del mapa (diana) por encima
        const refLngLat = this.lastMouseLngLat || (typeof mapObj.getCenter === "function" ? mapObj.getCenter() : null);
        const isMouseActive = Boolean(this.lastMouseLngLat);
        const proximityThresholdPx = isMouseActive ? 28 : 36;

        let closestPoiId = null;
        let closestDistPx = Infinity;

        if (refLngLat && typeof mapObj.project === "function") {
            const refPoint = mapObj.project([refLngLat.lng, refLngLat.lat]);

            this.markerEntries.forEach(entry => {
                const { poi } = entry;
                if (!Array.isArray(poi.coords) || poi.coords.length < 2) return;

                const tipScreen = mapObj.project([Number(poi.coords[0]), Number(poi.coords[1])]);
                const dx = tipScreen.x - refPoint.x;
                const dy = tipScreen.y - refPoint.y;
                const distPx = Math.hypot(dx, dy);

                if (distPx <= proximityThresholdPx && distPx < closestDistPx) {
                    closestDistPx = distPx;
                    closestPoiId = poi.id;
                }
            });
        }

        this.markerEntries.forEach(entry => {
            const { poi, labelEl } = entry;
            if (!labelEl) return;

            const isHovered = this.hoveredPoiId === poi.id;
            const isNearFocus = closestPoiId === poi.id;
            const shouldShow = isHovered || isNearFocus;

            labelEl.style.opacity = shouldShow ? "1" : "0";
        });
    },

    createPoi(coords, customData = {}) {
        const idx = this.pois.length + 1;
        const defaultCat = this.categories[0];
        const poi = {
            id: `poi_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: customData.name || `POI ${idx}`,
            category: customData.category || "general",
            customIcon: customData.customIcon || defaultCat.icon,
            customColor: customData.customColor || defaultCat.color,
            customLabel: customData.customLabel || defaultCat.label,
            description: customData.description || "",
            coords: [coords[0], coords[1]],
            createdAt: Date.now()
        };

        this.pois.push(poi);
        this.saveToStorage();
        this.renderAllMarkers();
        this.refreshDrawerListIfActive();
        return poi;
    },

    updatePoi(id, updates) {
        const poi = this.pois.find(p => p.id === id);
        if (!poi) return;

        Object.assign(poi, updates);
        this.saveToStorage();
        this.renderAllMarkers();
        this.refreshDrawerListIfActive();
    },

    deletePoi(id) {
        this.pois = this.pois.filter(p => p.id !== id);
        if (this.hoveredPoiId === id) this.hoveredPoiId = null;
        if (this.movingPoiId === id) this.movingPoiId = null;
        this.saveToStorage();
        this.renderAllMarkers();
        this.refreshDrawerListIfActive();
        window.RoutePlanner?.showToast?.("Punto de interés eliminado");
    },

    // ==========================================
    // 4. MODAL DE EDICIÓN DE POI
    // ==========================================
    openEditModal(poiId) {
        const poi = this.pois.find(p => p.id === poiId);
        if (!poi) return;

        this.stopMovingPoi();
        document.getElementById("otromundo-poi-edit-modal")?.remove();

        const currentVisual = this.getPoiVisualMeta(poi);
        let selectedCategory = poi.category || "custom";
        let selectedIcon = currentVisual.icon;
        let selectedColor = currentVisual.color;
        let selectedLabel = currentVisual.label;

        const buildCatalogHTML = (filterQuery = "") => {
            const query = filterQuery.trim().toLowerCase();
            const folders = this.getFolderCatalog();

            return folders.map(folder => {
                const filteredIcons = folder.icons.filter(file => {
                    if (!query) return true;
                    const esName = (this.iconSpanishNames[file] || "").toLowerCase();
                    return file.toLowerCase().includes(query) ||
                           esName.includes(query) ||
                           folder.label.toLowerCase().includes(query) ||
                           folder.id.toLowerCase().includes(query);
                });

                if (filteredIcons.length === 0) return "";

                const gridItems = filteredIcons.map(file => {
                    const iconPath = `pois_otromundo/${folder.id}/${file}`;
                    const prettyName = this.formatIconName(file);
                    const active = selectedIcon === iconPath;
                    return `
                        <button type="button" class="poi-catalog-icon-btn" data-icon="${iconPath}" data-color="${folder.color}" data-label="${prettyName}" title="${prettyName}" style="
                            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
                            background: ${active ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 255, 255, 0.03)'};
                            border: 1.5px solid ${active ? '#00e5ff' : 'rgba(255, 255, 255, 0.08)'};
                            border-radius: 9px; padding: 6px 4px; cursor: pointer; min-width: 0;
                        ">
                            <img src="${iconPath}" width="26" height="31" style="object-fit: contain; pointer-events: none;" loading="lazy" alt="${prettyName}">
                            <span style="font-size: 0.64rem; color: #ddd; width: 100%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;">${prettyName}</span>
                        </button>
                    `;
                }).join("");

                return `
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.74rem; font-weight: bold; color: ${folder.color}; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 3px;">
                            <span>📁 ${folder.label}</span>
                            <span style="font-size: 0.68rem; color: #888;">${filteredIcons.length}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                            ${gridItems}
                        </div>
                    </div>
                `;
            }).join("") || `<div style="text-align: center; color: #888; font-size: 0.78rem; padding: 16px;">No se encontraron iconos con ese nombre</div>`;
        };

        const modalHTML = `
        <div id="otromundo-poi-edit-modal" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px); z-index: 35000; display: flex; align-items: center; justify-content: center; padding: 14px; pointer-events: auto;">
            <div style="background: #121214; border: 1.5px solid #00e5ff; border-radius: 18px; width: 100%; max-width: 410px; max-height: 90vh; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.85); color: #fff; font-family: sans-serif; display: flex; flex-direction: column;">
                
                <div style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
                    <div style="display: flex; align-items: center; gap: 10px; font-weight: bold; color: #00e5ff; font-size: 0.95rem;">
                        <img id="poi-modal-preview-icon" src="${selectedIcon}" width="24" height="29" style="object-fit: contain;">
                        <div>
                            <div>Editar Punto de Interés</div>
                            <div id="poi-modal-preview-sub" style="font-size: 0.7rem; color: #aaa; font-weight: normal;">${selectedLabel}</div>
                        </div>
                    </div>
                    <button id="btn-close-poi-modal" style="background: transparent; border: none; color: #aaa; font-size: 1.15rem; cursor: pointer;">✕</button>
                </div>

                <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto;">
                    
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 0.75rem; color: #aaa;">Nombre del punto:</label>
                        <input type="text" id="poi-edit-name" value="${poi.name.replace(/"/g, '&quot;')}" style="background: #09090b; border: 1px solid rgba(255,255,255,0.18); border-radius: 9px; color: #fff; padding: 8px 10px; font-size: 0.86rem; outline: none;">
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <input type="text" id="poi-catalog-search" placeholder="🔍 Buscar icono (ej. fuente, refugio, castillo...)" style="background: #09090b; border: 1px solid rgba(0,229,255,0.35); border-radius: 8px; color: #fff; padding: 7px 10px; font-size: 0.78rem; outline: none;">
                        <div id="poi-catalog-scroll-area" style="max-height: 230px; overflow-y: auto; padding-right: 4px; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px; background: rgba(0,0,0,0.25);">
                            ${buildCatalogHTML()}
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 0.75rem; color: #aaa;">Notas o descripción (opcional):</label>
                        <textarea id="poi-edit-desc" rows="2" placeholder="Ej. Fuente con agua todo el año, desvío a la izquierda..." style="background: #09090b; border: 1px solid rgba(255,255,255,0.18); border-radius: 9px; color: #fff; padding: 7px 10px; font-size: 0.8rem; outline: none; resize: none; font-family: sans-serif;">${poi.description || ""}</textarea>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.7rem; color: #999; background: rgba(255,255,255,0.03); padding: 7px 9px; border-radius: 8px;">
                        <span>📍 ${poi.coords[1].toFixed(5)}, ${poi.coords[0].toFixed(5)}</span>
                        <button id="btn-move-poi-on-map" type="button" style="background: rgba(0, 229, 255, 0.14); border: 1px solid rgba(0, 229, 255, 0.5); color: #00e5ff; border-radius: 7px; padding: 5px 10px; font-size: 0.74rem; font-weight: bold; cursor: pointer; white-space: nowrap;">
                            ✥ Mover en el mapa
                        </button>
                    </div>

                </div>

                <div style="padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 8px; flex-shrink: 0; background: #121214;">
                    <button id="btn-delete-poi" type="button" style="background: rgba(255, 59, 48, 0.14); border: 1px solid #ff3b30; color: #ff3b30; border-radius: 10px; padding: 9px 12px; font-weight: bold; font-size: 0.82rem; cursor: pointer;">
                        Eliminar
                    </button>
                    <button id="btn-save-poi" type="button" style="flex: 1; background: #00e5ff; border: none; color: #121212; border-radius: 10px; padding: 9px 14px; font-weight: bold; font-size: 0.85rem; cursor: pointer;">
                        Guardar Cambios
                    </button>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML("beforeend", modalHTML);

        const modal = document.getElementById("otromundo-poi-edit-modal");
        const closeModal = () => modal?.remove();
        const previewImg = document.getElementById("poi-modal-preview-icon");
        const previewSub = document.getElementById("poi-modal-preview-sub");

        const updateSelectionUI = () => {
            if (previewImg) previewImg.src = selectedIcon;
            if (previewSub) previewSub.innerText = selectedLabel;

            modal.querySelectorAll(".poi-catalog-icon-btn").forEach(b => {
                const active = selectedIcon === b.dataset.icon;
                b.style.background = active ? "rgba(0, 229, 255, 0.18)" : "rgba(255, 255, 255, 0.03)";
                b.style.borderColor = active ? "#00e5ff" : "rgba(255, 255, 255, 0.08)";
            });
        };

        const bindCatalogEvents = () => {
            modal.querySelectorAll(".poi-catalog-icon-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    selectedCategory = "custom";
                    selectedIcon = btn.dataset.icon;
                    selectedColor = btn.dataset.color;
                    selectedLabel = btn.dataset.label;
                    updateSelectionUI();
                });
            });
        };
        bindCatalogEvents();

        const searchInput = document.getElementById("poi-catalog-search");
        const scrollArea = document.getElementById("poi-catalog-scroll-area");
        searchInput?.addEventListener("input", (e) => {
            if (scrollArea) {
                scrollArea.innerHTML = buildCatalogHTML(e.target.value);
                bindCatalogEvents();
            }
        });

        document.getElementById("btn-close-poi-modal")?.addEventListener("click", closeModal);
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });

        document.getElementById("btn-move-poi-on-map")?.addEventListener("click", () => {
            const newName = document.getElementById("poi-edit-name")?.value.trim() || poi.name;
            const newDesc = document.getElementById("poi-edit-desc")?.value.trim() || "";
            this.updatePoi(poi.id, {
                name: newName,
                category: selectedCategory,
                customIcon: selectedIcon,
                customColor: selectedColor,
                customLabel: selectedLabel,
                description: newDesc
            });
            closeModal();
            this.startMovingPoi(poi.id);
        });

        document.getElementById("btn-delete-poi")?.addEventListener("click", () => {
            this.deletePoi(poi.id);
            closeModal();
        });

        document.getElementById("btn-save-poi")?.addEventListener("click", () => {
            const newName = document.getElementById("poi-edit-name")?.value.trim() || poi.name;
            const newDesc = document.getElementById("poi-edit-desc")?.value.trim() || "";
            this.updatePoi(poi.id, {
                name: newName,
                category: selectedCategory,
                customIcon: selectedIcon,
                customColor: selectedColor,
                customLabel: selectedLabel,
                description: newDesc
            });
            window.RoutePlanner?.showToast?.(`POI "${newName}" guardado`);
            closeModal();
        });
    },

    // ==========================================
    // 5. PESTAÑA "POIs" EN EL PANEL LATERAL DE GESTIÓN DE RUTA
    // ==========================================
    injectPoisTabInDrawer() {
        const waitForTabs = setInterval(() => {
            const tabSegmentsBtn = document.getElementById("tab-btn-segments");
            const tabPointsBtn = document.getElementById("tab-btn-points");
            if (!tabSegmentsBtn || !tabPointsBtn || document.getElementById("tab-btn-pois")) {
                if (document.getElementById("tab-btn-pois")) clearInterval(waitForTabs);
                return;
            }

            const tabBar = tabSegmentsBtn.parentElement;
            const tabPoisBtn = document.createElement("button");
            tabPoisBtn.id = "tab-btn-pois";
            tabPoisBtn.style.cssText = "flex: 1; background: transparent; color: #aaa; border: none; padding: 6px; border-radius: 6px; font-weight: bold; font-size: 0.8rem; cursor: pointer;";
            tabPoisBtn.innerHTML = `POIs <span id="planner-pois-count">(${this.pois.length})</span>`;

            tabBar.appendChild(tabPoisBtn);

            const resetOtherTabs = () => {
                tabPoisBtn.style.background = "transparent";
                tabPoisBtn.style.color = "#aaa";
                this.optimizePointsDrawerLayout();
            };

            tabPointsBtn.addEventListener("click", resetOtherTabs);
            tabSegmentsBtn.addEventListener("click", resetOtherTabs);

            tabPoisBtn.addEventListener("click", () => {
                if (window.RoutePlanner) window.RoutePlanner.activeTab = "pois";
                tabPointsBtn.style.background = "transparent";
                tabPointsBtn.style.color = "#aaa";
                tabSegmentsBtn.style.background = "transparent";
                tabSegmentsBtn.style.color = "#aaa";
                tabPoisBtn.style.background = "#00e5ff";
                tabPoisBtn.style.color = "#121212";
                this.optimizePointsDrawerLayout();
                this.renderPoisListDrawer();
            });

            clearInterval(waitForTabs);
        }, 150);
    },

    isPoisTabActive() {
        const tabPoisBtn = document.getElementById("tab-btn-pois");
        const isVisuallyActive = tabPoisBtn && (
            tabPoisBtn.style.background.includes("0, 229, 255") ||
            tabPoisBtn.style.background.includes("#00e5ff")
        );
        return window.RoutePlanner?.activeTab === "pois" || Boolean(isVisuallyActive);
    },

    refreshDrawerListIfActive() {
        const countEl = document.getElementById("planner-pois-count");
        if (countEl) countEl.innerText = `(${this.pois.length})`;
        if (this.isPoisTabActive()) {
            this.renderPoisListDrawer();
        }
    },

    renderPoisListDrawer() {
        const container = document.getElementById("planner-points-items-container");
        const countEl = document.getElementById("planner-pois-count");
        if (!container) return;

        this.optimizePointsDrawerLayout();
        if (countEl) countEl.innerText = `(${this.pois.length})`;
        container.innerHTML = "";

        // Interruptor para mostrar / ocultar siempre los nombres de POIs
        const toggleLabelsCard = document.createElement("div");
        toggleLabelsCard.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.09);
            border-radius: 10px; padding: 8px 12px; cursor: pointer; gap: 8px; flex-shrink: 0;
        `;
        toggleLabelsCard.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1px;">
                <span style="font-size: 0.8rem; font-weight: bold; color: #fff;">Mostrar nombres siempre</span>
                <span style="font-size: 0.69rem; color: #999;">Si está desactivado, se ven al pasar la diana o el ratón</span>
            </div>
            <label class="switch" style="pointer-events: none; flex-shrink: 0;">
                <input type="checkbox" id="toggle-pois-always-labels" ${this.alwaysShowLabels ? "checked" : ""}>
                <span class="slider-round"></span>
            </label>
        `;
        toggleLabelsCard.addEventListener("click", () => {
            this.alwaysShowLabels = !this.alwaysShowLabels;
            const cb = document.getElementById("toggle-pois-always-labels");
            if (cb) cb.checked = this.alwaysShowLabels;
            this.saveToStorage();
            this.scheduleLabelVisibilityUpdate();
        });
        container.appendChild(toggleLabelsCard);

        // Botón para añadir POI rápido en el centro del mapa
        const addQuickBtn = document.createElement("button");
        addQuickBtn.type = "button";
        addQuickBtn.style.cssText = `
            width: 100%; background: rgba(0, 229, 255, 0.12); border: 1px dashed #00e5ff;
            color: #00e5ff; border-radius: 10px; padding: 8px 10px; font-size: 0.8rem;
            font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0;
        `;
        addQuickBtn.innerHTML = `<span>+ Añadir POI en el centro del mapa</span>`;
        addQuickBtn.addEventListener("click", () => {
            if (!window.map) return;
            const center = window.map.getCenter();
            const newPoi = this.createPoi([center.lng, center.lat]);
            this.openEditModal(newPoi.id);
        });
        container.appendChild(addQuickBtn);

        if (this.pois.length === 0) {
            const emptyMsg = document.createElement("div");
            emptyMsg.style.cssText = "font-size: 0.82rem; color: #888; text-align: center; padding: 20px;";
            emptyMsg.innerText = "No hay puntos de interés personalizados";
            container.appendChild(emptyMsg);
            return;
        }

        this.pois.forEach(poi => {
            const visual = this.getPoiVisualMeta(poi);
            const row = document.createElement("div");
            row.style.cssText = `
                display: flex; align-items: center; justify-content: space-between;
                background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
                border-left: 3px solid ${visual.color};
                border-radius: 10px; padding: 8px 10px; gap: 8px; flex-shrink: 0;
            `;

            row.innerHTML = `
                <img src="${visual.icon}" width="22" height="26" style="flex-shrink: 0; object-fit: contain;" alt="${poi.name}">
                <div style="flex: 1; min-width: 0; cursor: pointer;" class="poi-row-info">
                    <div style="font-size: 0.84rem; font-weight: bold; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${poi.name}</div>
                    <div style="font-size: 0.72rem; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${visual.label}${poi.description ? " · " + poi.description : ""}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                    <button type="button" class="poi-btn-goto" title="Centrar en mapa" style="background: transparent; border: none; cursor: pointer; padding: 4px;">
                        <img src="ui-icons/fi-rr-location-crosshairs.svg" width="15" height="15" style="filter: brightness(0) saturate(100%) invert(77%);">
                    </button>
                    <button type="button" class="poi-btn-edit" title="Editar POI" style="background: transparent; border: none; cursor: pointer; padding: 4px;">
                        <img src="ui-icons/fi-rr-pencil.svg" width="15" height="15" style="filter: brightness(0) saturate(100%) invert(77%);">
                    </button>
                    <button type="button" class="poi-btn-del" title="Eliminar POI" style="background: transparent; border: none; cursor: pointer; padding: 4px;">
                        <img src="ui-icons/fi-rr-trash.svg" width="15" height="15" style="filter: brightness(0) saturate(100%) invert(43%) sepia(93%) saturate(1352%) hue-rotate(334deg);">
                    </button>
                </div>
            `;

            row.querySelector(".poi-row-info")?.addEventListener("click", () => this.openEditModal(poi.id));
            row.querySelector(".poi-btn-edit")?.addEventListener("click", () => this.openEditModal(poi.id));
            row.querySelector(".poi-btn-goto")?.addEventListener("click", () => {
                window.map?.flyTo({ center: poi.coords, zoom: 16 });
            });
            row.querySelector(".poi-btn-del")?.addEventListener("click", () => this.deletePoi(poi.id));

            container.appendChild(row);
        });
    },

    // ==========================================
    // 6. INTEGRACIÓN CON EXPORTADOR GPX / KML
    // ==========================================
    hookExporter() {
        let attempts = 0;
        const waitForExporter = setInterval(() => {
            attempts++;
            const exp = window.RouteExporter || (typeof RouteExporter !== "undefined" ? RouteExporter : null);

            if (!exp || typeof exp.buildGpx !== "function" || typeof exp.buildKmlHierarchical !== "function") {
                if (attempts > 40) clearInterval(waitForExporter);
                return;
            }

            if (exp._poisHooked) {
                clearInterval(waitForExporter);
                return;
            }

            exp._poisHooked = true;
            clearInterval(waitForExporter);

            const origBuildGpx = exp.buildGpx.bind(exp);
            exp.buildGpx = (filename, planner) => {
                let gpx = origBuildGpx(filename, planner);
                if (this.pois.length === 0) return gpx;

                const poiWaypoints = this.pois.map(poi => {
                    const visual = this.getPoiVisualMeta(poi);
                    const descTag = poi.description ? `\n    <desc><![CDATA[${poi.description}]]></desc>` : "";
                    return `  <wpt lat="${poi.coords[1]}" lon="${poi.coords[0]}">\n    <name><![CDATA[${poi.name}]]></name>${descTag}\n    <type><![CDATA[${visual.label}]]></type>\n  </wpt>`;
                }).join("\n");

                return gpx.replace("</gpx>", `${poiWaypoints}\n</gpx>`);
            };

            const origBuildKml = exp.buildKmlHierarchical.bind(exp);
            exp.buildKmlHierarchical = (filename, planner) => {
                let kml = origBuildKml(filename, planner);
                if (this.pois.length === 0) return kml;

                const uniqueIcons = [...new Set(this.pois.map(p => this.getPoiVisualMeta(p).icon))];
                const styleIdMap = {};

                const poiStyles = uniqueIcons.map((iconPath, idx) => {
                    const styleId = `poi_icon_style_${idx}`;
                    styleIdMap[iconPath] = styleId;
                    const iconUrl = this.resolvePublicIconUrl(iconPath);
                    return [
                        `  <Style id="${styleId}">`,
                        `    <IconStyle>`,
                        `      <scale>1.1</scale>`,
                        `      <Icon>`,
                        `        <href>${iconUrl}</href>`,
                        `      </Icon>`,
                        `      <hotSpot x="0.5" y="0" xunits="fraction" yunits="fraction"/>`,
                        `    </IconStyle>`,
                        `  </Style>`
                    ].join("\n");
                }).join("\n");

                let poiFolder = `  <Folder>\n    <name><![CDATA[Puntos de Interés (POIs)]]></name>\n`;
                this.pois.forEach(poi => {
                    const visual = this.getPoiVisualMeta(poi);
                    const styleId = styleIdMap[visual.icon];
                    poiFolder += `    <Placemark>\n`;
                    poiFolder += `      <name><![CDATA[${poi.name}]]></name>\n`;
                    poiFolder += `      <styleUrl>#${styleId}</styleUrl>\n`;
                    if (poi.description) {
                        poiFolder += `      <description><![CDATA[${poi.description}]]></description>\n`;
                    }
                    poiFolder += `      <Point>\n        <coordinates>${poi.coords[0]},${poi.coords[1]},0</coordinates>\n      </Point>\n`;
                    poiFolder += `    </Placemark>\n`;
                });
                poiFolder += `  </Folder>\n`;

                return kml.replace("</Document>", `${poiStyles}\n${poiFolder}</Document>`);
            };
        }, 200);
    }
};

window.PoiManager = PoiManager;
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => PoiManager.init());
} else {
    PoiManager.init();
}