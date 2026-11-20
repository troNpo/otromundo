// ==========================================
// POI-MANAGER.JS - Módulo independiente de Puntos de Interés (POIs) editables sin alterar el trazado
// ==========================================

const PoiManager = {
    pois: [],
    markers: [],
    isPlacingMode: false,
    storageKey: "otromundo_custom_pois",

    // Catálogo de categorías con iconos SVG locales y colores corporativos
    categories: [
        { id: "general", label: "Punto de Interés", icon: "ui-icons/fi-rr-map-marker-plus.svg", color: "#00e5ff" },
        { id: "water", label: "Agua / Fuente", icon: "ui-icons/fi-rr-location-crosshairs.svg", color: "#00b0ff" },
        { id: "peak", label: "Cima / Collado", icon: "ui-icons/fi-rr-mountains.svg", color: "#ffab40" },
        { id: "shelter", label: "Refugio / Vivac", icon: "ui-icons/fi-rr-map.svg", color: "#00e676" },
        { id: "viewpoint", label: "Mirador / Foto", icon: "ui-icons/fi-rr-star.svg", color: "#e040fb" },
        { id: "danger", label: "Precaución / Paso", icon: "ui-icons/fi-rr-info.svg", color: "#ff3b30" }
    ],

    init() {
        this.loadFromStorage();
        this.injectFloatingButton();
        this.injectPoisTabInDrawer();
        this.hookPlannerInputMethods();
        this.setupMapListeners();
        this.hookExporter();
    },

    loadFromStorage() {
        try {
            const raw = window.localStorage ? localStorage.getItem(this.storageKey) : null;
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) this.pois = parsed;
            }
        } catch (e) {
            this.pois = [];
        }
    },

    saveToStorage() {
        try {
            if (window.localStorage) {
                localStorage.setItem(this.storageKey, JSON.stringify(this.pois));
            }
        } catch (e) {}
    },

    getCategoryMeta(catId) {
        return this.categories.find(c => c.id === catId) || this.categories[0];
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

            // Fallback flotante garantizado si el contenedor aún no está montado
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

        // Sincronizar también el botón principal "Añadir" del tablero inferior
        const mainAddBtn = document.getElementById("planner-btn-add");
        if (mainAddBtn) {
            const addImg = mainAddBtn.querySelector("img");
            const addSpan = mainAddBtn.querySelector("span");

            if (this.isPlacingMode) {
                if (addImg) {
                    if (!addImg.dataset.origSrc) addImg.dataset.origSrc = addImg.getAttribute("src") || "ui-icons/fi-rr-square-plus.svg";
                    addImg.src = "ui-icons/fi-rr-map-marker-plus.svg";
                    addImg.style.filter = "brightness(0)";
                }
                if (addSpan) {
                    if (!addSpan.dataset.origText) addSpan.dataset.origText = addSpan.innerText;
                    addSpan.innerText = "Añadir POI";
                }
                mainAddBtn.style.background = "#00e5ff";
                mainAddBtn.style.color = "#121214";
                mainAddBtn.style.borderColor = "#00e5ff";
                mainAddBtn.style.boxShadow = "0 0 14px rgba(0, 229, 255, 0.55)";
            } else {
                if (addImg) {
                    addImg.src = addImg.dataset.origSrc || "ui-icons/fi-rr-square-plus.svg";
                    addImg.style.filter = "";
                }
                if (addSpan) {
                    addSpan.innerText = addSpan.dataset.origText || "Añadir";
                }
                mainAddBtn.style.background = "";
                mainAddBtn.style.color = "";
                mainAddBtn.style.borderColor = "";
                mainAddBtn.style.boxShadow = "";
            }
        }

        if (this.isPlacingMode) {
            window.RoutePlanner?.showToast?.("Modo POI activo: toca, haz clic, pulsa Espacio o + para situar POI");
        } else {
            window.RoutePlanner?.showToast?.("Modo POI desactivado");
        }
    },

    // ==========================================
    // 2. INTERACCIÓN UNIFICADA (TOQUE, CLIC, ESPACIO Y BOTÓN +)
    // ==========================================
    hookPlannerInputMethods() {
        const waitForPlanner = setInterval(() => {
            const planner = window.RoutePlanner;
            if (!planner || typeof planner.addPoint !== "function") return;
            clearInterval(waitForPlanner);

            if (planner._poiAddPointHooked) return;
            planner._poiAddPointHooked = true;

            const originalAddPoint = planner.addPoint.bind(planner);
            planner.addPoint = (lngLat, defaultName) => {
                if (this.isPlacingMode) {
                    const coords = Array.isArray(lngLat)
                        ? [lngLat[0], lngLat[1]]
                        : [lngLat.lng, lngLat.lat];
                    const newPoi = this.createPoi(coords);
                    this.togglePlacingMode(false);
                    this.openEditModal(newPoi.id);
                    return;
                }
                return originalAddPoint(lngLat, defaultName);
            };
        }, 150);
    },

    setupMapListeners() {
        const waitForMap = setInterval(() => {
            const mapObj = window.map;
            if (!mapObj || typeof mapObj.on !== "function") return;
            clearInterval(waitForMap);

            // Captura directa del clic/toque en el mapa (funciona incluso con el candado táctil cerrado)
            mapObj.on("click", (e) => {
                if (!this.isPlacingMode) return;

                e.preventDefault?.();
                const lngLat = [e.lngLat.lng, e.lngLat.lat];
                const newPoi = this.createPoi(lngLat);
                this.togglePlacingMode(false);
                this.openEditModal(newPoi.id);
            });

            // Renderizar POIs guardados una vez cargado el mapa
            if (mapObj.loaded()) {
                this.renderAllMarkers();
            } else {
                mapObj.once("load", () => this.renderAllMarkers());
            }

            mapObj.on("style.load", () => {
                setTimeout(() => this.renderAllMarkers(), 220);
            });
        }, 150);
    },

    createPoi(coords, customData = {}) {
        const idx = this.pois.length + 1;
        const poi = {
            id: `poi_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: customData.name || `POI ${idx}`,
            category: customData.category || "general",
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
        this.saveToStorage();
        this.renderAllMarkers();
        this.refreshDrawerListIfActive();
        window.RoutePlanner?.showToast?.("Punto de interés eliminado");
    },

    // ==========================================
    // 3. RENDERIZADO DE MARCADORES ARRASTRABLES EN MAPA
    // ==========================================
    renderAllMarkers() {
        const mapObj = window.map;
        if (!mapObj || typeof maplibregl === "undefined" || typeof maplibregl.Marker !== "function") return;

        try {
            this.markers.forEach(m => {
                try { m.remove(); } catch (e) {}
            });
        } catch (e) {}
        this.markers = [];

        this.pois.forEach(poi => {
            try {
                if (!poi || !Array.isArray(poi.coords) || poi.coords.length < 2) return;
                const lng = Number(poi.coords[0]);
                const lat = Number(poi.coords[1]);
                if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

                const cat = this.getCategoryMeta(poi.category);

                const wrapper = document.createElement("div");
                wrapper.className = "otromundo-custom-poi-marker";
                wrapper.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    cursor: grab;
                    user-select: none;
                    pointer-events: auto;
                `;

                const pin = document.createElement("div");
                pin.style.cssText = `
                    width: 30px;
                    height: 30px;
                    border-radius: 50% 50% 50% 4px;
                    transform: rotate(-45deg);
                    background: #121214;
                    border: 2px solid ${cat.color};
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;

                const iconEl = document.createElement("img");
                iconEl.src = cat.icon;
                iconEl.width = 14;
                iconEl.height = 14;
                iconEl.style.cssText = `
                    transform: rotate(45deg);
                    filter: brightness(0) invert(1);
                    pointer-events: none;
                `;
                pin.appendChild(iconEl);

                const label = document.createElement("div");
                label.style.cssText = `
                    margin-top: 4px;
                    background: rgba(18, 18, 20, 0.88);
                    border: 1px solid ${cat.color};
                    color: #ffffff;
                    font-family: sans-serif;
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 6px;
                    white-space: nowrap;
                    max-width: 120px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.65);
                `;
                label.innerText = poi.name;

                wrapper.appendChild(pin);
                wrapper.appendChild(label);

                let wasDragged = false;

                const marker = new maplibregl.Marker({
                    element: wrapper,
                    draggable: true,
                    anchor: "bottom"
                })
                    .setLngLat([lng, lat])
                    .addTo(mapObj);

                marker.on("dragstart", () => {
                    wasDragged = true;
                    if (window.RoutePlanner) window.RoutePlanner.isDraggingMarker = true;
                });

                marker.on("dragend", () => {
                    const lngLat = marker.getLngLat();
                    poi.coords = [lngLat.lng, lngLat.lat];
                    this.saveToStorage();
                    this.refreshDrawerListIfActive();
                    window.RoutePlanner?.showToast?.(`Posición de "${poi.name}" actualizada`);

                    setTimeout(() => {
                        wasDragged = false;
                        if (window.RoutePlanner) window.RoutePlanner.isDraggingMarker = false;
                    }, 200);
                });

                wrapper.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (!wasDragged) {
                        this.openEditModal(poi.id);
                    }
                });

                this.markers.push(marker);
            } catch (err) {
                console.warn("No se pudo renderizar un POI:", err);
            }
        });
    },

    // ==========================================
    // 4. MODAL DE EDICIÓN DE POI (NOMBRE, CATEGORÍA, NOTAS)
    // ==========================================
    openEditModal(poiId) {
        const poi = this.pois.find(p => p.id === poiId);
        if (!poi) return;

        document.getElementById("otromundo-poi-edit-modal")?.remove();

        const categoriesHTML = this.categories.map(cat => {
            const isSelected = poi.category === cat.id;
            return `
                <button type="button" class="poi-cat-btn" data-cat="${cat.id}" style="
                    display: flex; align-items: center; gap: 6px;
                    background: ${isSelected ? 'rgba(0, 229, 255, 0.16)' : 'rgba(255, 255, 255, 0.04)'};
                    border: 1.5px solid ${isSelected ? cat.color : 'rgba(255, 255, 255, 0.1)'};
                    color: #fff; border-radius: 10px; padding: 7px 10px; font-size: 0.76rem;
                    cursor: pointer; text-align: left;
                ">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: ${cat.color}; flex-shrink: 0;"></span>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat.label}</span>
                </button>
            `;
        }).join("");

        const modalHTML = `
        <div id="otromundo-poi-edit-modal" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72); backdrop-filter: blur(4px); z-index: 35000; display: flex; align-items: center; justify-content: center; padding: 16px; pointer-events: auto;">
            <div style="background: #121214; border: 1.5px solid #00e5ff; border-radius: 18px; width: 100%; max-width: 380px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.85); color: #fff; font-family: sans-serif; display: flex; flex-direction: column;">
                
                <div style="padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: bold; color: #00e5ff; font-size: 0.95rem;">
                        <img src="ui-icons/fi-rr-map-marker-plus.svg" width="18" height="18" style="filter: brightness(0) saturate(100%) invert(77%);">
                        <span>Editar Punto de Interés</span>
                    </div>
                    <button id="btn-close-poi-modal" style="background: transparent; border: none; color: #aaa; font-size: 1.15rem; cursor: pointer;">✕</button>
                </div>

                <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <label style="font-size: 0.76rem; color: #aaa;">Nombre del punto:</label>
                        <input type="text" id="poi-edit-name" value="${poi.name.replace(/"/g, '&quot;')}" style="background: #09090b; border: 1px solid rgba(255,255,255,0.18); border-radius: 9px; color: #fff; padding: 9px 11px; font-size: 0.88rem; outline: none;">
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 0.76rem; color: #aaa;">Tipo / Categoría:</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                            ${categoriesHTML}
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <label style="font-size: 0.76rem; color: #aaa;">Notas o descripción (opcional):</label>
                        <textarea id="poi-edit-desc" rows="2" placeholder="Ej. Fuente con agua todo el año, desvío a la izquierda..." style="background: #09090b; border: 1px solid rgba(255,255,255,0.18); border-radius: 9px; color: #fff; padding: 8px 11px; font-size: 0.82rem; outline: none; resize: none; font-family: sans-serif;">${poi.description || ""}</textarea>
                    </div>

                    <div style="font-size: 0.72rem; color: #888; background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: 8px;">
                        📍 Coordenadas: ${poi.coords[1].toFixed(5)}, ${poi.coords[0].toFixed(5)} (Arrastra el icono en el mapa para moverlo)
                    </div>

                    <div style="display: flex; gap: 8px; margin-top: 4px;">
                        <button id="btn-delete-poi" type="button" style="background: rgba(255, 59, 48, 0.14); border: 1px solid #ff3b30; color: #ff3b30; border-radius: 10px; padding: 9px 12px; font-weight: bold; font-size: 0.82rem; cursor: pointer;">
                            Eliminar
                        </button>
                        <button id="btn-save-poi" type="button" style="flex: 1; background: #00e5ff; border: none; color: #121212; border-radius: 10px; padding: 9px 14px; font-weight: bold; font-size: 0.85rem; cursor: pointer;">
                            Guardar Cambios
                        </button>
                    </div>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML("beforeend", modalHTML);

        let selectedCategory = poi.category;
        const modal = document.getElementById("otromundo-poi-edit-modal");
        const closeModal = () => modal?.remove();

        modal.querySelectorAll(".poi-cat-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                selectedCategory = btn.dataset.cat;
                modal.querySelectorAll(".poi-cat-btn").forEach(b => {
                    const cMeta = this.getCategoryMeta(b.dataset.cat);
                    const active = b.dataset.cat === selectedCategory;
                    b.style.background = active ? "rgba(0, 229, 255, 0.16)" : "rgba(255, 255, 255, 0.04)";
                    b.style.borderColor = active ? cMeta.color : "rgba(255, 255, 255, 0.1)";
                });
            });
        });

        document.getElementById("btn-close-poi-modal")?.addEventListener("click", closeModal);
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
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
                this.renderPoisListDrawer();
            });

            clearInterval(waitForTabs);
        }, 150);
    },

    refreshDrawerListIfActive() {
        const countEl = document.getElementById("planner-pois-count");
        if (countEl) countEl.innerText = `(${this.pois.length})`;
        if (window.RoutePlanner?.activeTab === "pois") {
            this.renderPoisListDrawer();
        }
    },

    renderPoisListDrawer() {
        const container = document.getElementById("planner-points-items-container");
        const countEl = document.getElementById("planner-pois-count");
        if (!container) return;

        if (countEl) countEl.innerText = `(${this.pois.length})`;
        container.innerHTML = "";

        // Botón rápido superior para añadir POI desde la lista
        const addQuickBtn = document.createElement("button");
        addQuickBtn.type = "button";
        addQuickBtn.style.cssText = `
            width: 100%; background: rgba(0, 229, 255, 0.12); border: 1px dashed #00e5ff;
            color: #00e5ff; border-radius: 10px; padding: 8px 10px; font-size: 0.8rem;
            font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
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
            const cat = this.getCategoryMeta(poi.category);
            const row = document.createElement("div");
            row.style.cssText = `
                display: flex; align-items: center; justify-content: space-between;
                background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
                border-left: 3px solid ${cat.color};
                border-radius: 10px; padding: 8px 10px; gap: 8px;
            `;

            row.innerHTML = `
                <div style="flex: 1; min-width: 0; cursor: pointer;" class="poi-row-info">
                    <div style="font-size: 0.84rem; font-weight: bold; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${poi.name}</div>
                    <div style="font-size: 0.72rem; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat.label}${poi.description ? " · " + poi.description : ""}</div>
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
                    const descTag = poi.description ? `\n    <desc><![CDATA[${poi.description}]]></desc>` : "";
                    return `  <wpt lat="${poi.coords[1]}" lon="${poi.coords[0]}">\n    <name><![CDATA[${poi.name}]]></name>${descTag}\n    <type><![CDATA[${poi.category}]]></type>\n  </wpt>`;
                }).join("\n");

                return gpx.replace("</gpx>", `${poiWaypoints}\n</gpx>`);
            };

            const origBuildKml = exp.buildKmlHierarchical.bind(exp);
            exp.buildKmlHierarchical = (filename, planner) => {
                let kml = origBuildKml(filename, planner);
                if (this.pois.length === 0) return kml;

                let poiFolder = `  <Folder>\n    <name><![CDATA[Puntos de Interés (POIs)]]></name>\n`;
                this.pois.forEach(poi => {
                    poiFolder += `    <Placemark>\n`;
                    poiFolder += `      <name><![CDATA[${poi.name}]]></name>\n`;
                    if (poi.description) {
                        poiFolder += `      <description><![CDATA[${poi.description}]]></description>\n`;
                    }
                    poiFolder += `      <Point>\n        <coordinates>${poi.coords[0]},${poi.coords[1]},0</coordinates>\n      </Point>\n`;
                    poiFolder += `    </Placemark>\n`;
                });
                poiFolder += `  </Folder>\n`;

                return kml.replace("</Document>", `${poiFolder}</Document>`);
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