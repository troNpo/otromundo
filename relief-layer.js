// ==========================================
// RELIEF-LAYER.JS - Sombreado de Relieve 3D (Hillshade) en tiempo real usando Mapterhorn DEM (Terrarium)
// ==========================================

const ReliefLayerManager = {
    isEnabled: false,
    sourceId: "otromundo-relief-dem-source",
    layerId: "otromundo-relief-hillshade-layer",
    demUrlTemplate: "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp",
    settings: {
        exaggeration: 0.65,   // Intensidad del sombreado (0.2 a 1.0)
        sunDirection: 315,    // Azimut solar (315° NO clásico cartográfico, 180° Sur real)
        shadowColor: "#090a0f",
        highlightColor: "#ffffff"
    },

    init() {
        this.loadSavedSettings();
        this.injectUIControls();
        this.setupMapListeners();
    },

    loadSavedSettings() {
        try {
            const savedEnabled = localStorage.getItem("otromundo_relief_enabled");
            if (savedEnabled !== null) {
                this.isEnabled = savedEnabled === "true";
            }
            const savedSettings = localStorage.getItem("otromundo_relief_settings");
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (e) {
            console.warn("No se pudieron cargar las preferencias de relieve:", e);
        }
    },

    saveSettings() {
        try {
            localStorage.setItem("otromundo_relief_settings", JSON.stringify(this.settings));
            localStorage.setItem("otromundo_relief_enabled", String(this.isEnabled));
        } catch (e) {}
    },

    // ==========================================
    // 1. INYECTAR TARJETA EN EL PANEL DE MAPAS BASE
    // ==========================================
    injectUIControls() {
        const mapsDrawerBody = document.querySelector("#side-panel-maps .side-drawer-body");
        if (!mapsDrawerBody || document.getElementById("otromundo-relief-card")) return;

        const card = document.createElement("div");
        card.id = "otromundo-relief-card";
        card.style.cssText = `
            margin-top: 12px;
            padding: 12px 14px;
            background: rgba(255, 255, 255, 0.04);
            border: 1.5px solid rgba(0, 229, 255, 0.4);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            font-family: sans-serif;
            transition: all 0.2s ease;
        `;

        card.innerHTML = `
            <!-- Cabecera con interruptor principal -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div id="relief-toggle-row" style="display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer;">
                    <div style="background: rgba(0, 229, 255, 0.12); border-radius: 8px; padding: 7px; display: flex; align-items: center; justify-content: center;">
                        <img src="ui-icons/fi-rr-mountains.svg" width="18" height="18" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg);" alt="Relieve">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 0.88rem; font-weight: bold; color: #fff;">Sombreado de Relieve</span>
                        <span style="font-size: 0.72rem; color: #aaa;">Volumen orográfico Hillshade DEM</span>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 10px;">
                    <button id="btn-toggle-relief-settings" type="button" title="Configurar sombreado de relieve" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #00e5ff; border-radius: 8px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem; transition: transform 0.2s ease;">
                        ▾
                    </button>
                    <label class="switch" id="relief-switch-label" style="cursor: pointer;">
                        <input type="checkbox" id="toggle-relief-layer" ${this.isEnabled ? "checked" : ""}>
                        <span class="slider-round"></span>
                    </label>
                </div>
            </div>

            <!-- Desplegable de Configuración -->
            <div id="relief-settings-drawer" style="display: ${this.isEnabled ? "flex" : "none"}; flex-direction: column; gap: 11px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 11px; margin-top: 2px;">
                
                <!-- Dirección de iluminación -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 0.78rem; color: #ccc;">Iluminación solar:</span>
                    <select id="relief-sun-select" style="background: #121214; color: #00e5ff; border: 1px solid rgba(0,229,255,0.35); border-radius: 8px; padding: 5px 8px; font-size: 0.78rem; outline: none; cursor: pointer;">
                        <option value="315" ${this.settings.sunDirection === 315 ? "selected" : ""}>Noroeste 315° (Cartográfico)</option>
                        <option value="270" ${this.settings.sunDirection === 270 ? "selected" : ""}>Oeste 270° (Tarde)</option>
                        <option value="180" ${this.settings.sunDirection === 180 ? "selected" : ""}>Sur 180° (Mediodía real)</option>
                        <option value="90" ${this.settings.sunDirection === 90 ? "selected" : ""}>Este 90° (Amanecer)</option>
                    </select>
                </div>

                <!-- Intensidad / Exageración del relieve -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 0.78rem; color: #ccc;">Intensidad:</span>
                    <input type="range" id="relief-exaggeration-slider" min="0.2" max="1" step="0.05" value="${this.settings.exaggeration}" style="flex: 1; accent-color: #00e5ff; cursor: pointer;">
                    <span id="relief-exaggeration-val" style="font-size: 0.76rem; color: #00e5ff; font-weight: bold; min-width: 34px; text-align: right;">${Math.round(this.settings.exaggeration * 100)}%</span>
                </div>

            </div>
        `;

        const aspectCard = document.getElementById("otromundo-aspect-card");
        const slopeCard = document.getElementById("otromundo-slope-card");
        const contourCard = document.getElementById("otromundo-contour-card");
        const anchorCard = aspectCard || slopeCard || contourCard;

        if (anchorCard && anchorCard.parentElement === mapsDrawerBody) {
            anchorCard.insertAdjacentElement("afterend", card);
        } else {
            mapsDrawerBody.appendChild(card);
        }

        const checkbox = document.getElementById("toggle-relief-layer");
        const toggleRow = document.getElementById("relief-toggle-row");
        const settingsBtn = document.getElementById("btn-toggle-relief-settings");
        const settingsDrawer = document.getElementById("relief-settings-drawer");
        const sunSelect = document.getElementById("relief-sun-select");
        const exagSlider = document.getElementById("relief-exaggeration-slider");
        const exagVal = document.getElementById("relief-exaggeration-val");

        let isDrawerExpanded = this.isEnabled;
        if (settingsBtn) settingsBtn.style.transform = isDrawerExpanded ? "rotate(180deg)" : "rotate(0deg)";

        const toggleSettingsDrawer = (forceState) => {
            isDrawerExpanded = typeof forceState === "boolean" ? forceState : !isDrawerExpanded;
            if (settingsDrawer) settingsDrawer.style.display = isDrawerExpanded ? "flex" : "none";
            if (settingsBtn) settingsBtn.style.transform = isDrawerExpanded ? "rotate(180deg)" : "rotate(0deg)";
        };

        settingsBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleSettingsDrawer();
        });

        const handleActivationChange = (newState) => {
            this.isEnabled = newState;
            if (checkbox) checkbox.checked = this.isEnabled;
            this.saveSettings();

            if (this.isEnabled) {
                toggleSettingsDrawer(true);
                this.applyReliefLayer();
                window.RoutePlanner?.showToast?.("Sombreado de relieve activado");
            } else {
                this.removeReliefLayer();
                window.RoutePlanner?.showToast?.("Sombreado de relieve desactivado");
            }
        };

        toggleRow?.addEventListener("click", () => handleActivationChange(!this.isEnabled));
        checkbox?.addEventListener("change", (e) => {
            e.stopPropagation();
            handleActivationChange(e.target.checked);
        });

        sunSelect?.addEventListener("change", (e) => {
            this.settings.sunDirection = parseFloat(e.target.value);
            this.saveSettings();
            if (this.isEnabled) this.updatePaintProperties();
        });

        exagSlider?.addEventListener("input", (e) => {
            this.settings.exaggeration = parseFloat(e.target.value);
            if (exagVal) exagVal.innerText = `${Math.round(this.settings.exaggeration * 100)}%`;
            this.saveSettings();
            if (this.isEnabled) this.updatePaintProperties();
        });
    },

    // ==========================================
    // 2. GESTIÓN DE LA CAPA HILLSHADE NATIVA (GPU) EN MAPLIBRE GL JS
    // ==========================================
    setupMapListeners() {
        const waitForMap = setInterval(() => {
            const mapObj = window.map;
            if (mapObj && typeof mapObj.on === "function") {
                clearInterval(waitForMap);

                this.cleanupFixedHillshadeLayers(mapObj);

                if (mapObj.isStyleLoaded() && this.isEnabled) {
                    this.applyReliefLayer();
                }

                mapObj.on("style.load", () => {
                    this.cleanupFixedHillshadeLayers(mapObj);
                    if (this.isEnabled) {
                        setTimeout(() => this.applyReliefLayer(), 200);
                    }
                });
            }
        }, 150);
    },

    // Elimina capas hillshade fijas embebidas en estilos JSON externos para evitar sombreados fijos o duplicados
    cleanupFixedHillshadeLayers(mapObj) {
        if (!mapObj || typeof mapObj.getStyle !== "function") return;
        const layers = mapObj.getStyle()?.layers || [];
        layers.forEach(layer => {
            if (layer.type === "hillshade" && layer.id !== this.layerId) {
                try {
                    if (mapObj.getLayer(layer.id)) {
                        mapObj.removeLayer(layer.id);
                    }
                } catch (e) {}
            }
        });
    },

    // Busca una fuente raster-dem existente en el estilo (ej. "terrarium-dem") para reutilizarla sin duplicar descargas
    findExistingDemSourceId(mapObj) {
        const sources = mapObj.getStyle()?.sources || {};
        if (sources["terrarium-dem"] && sources["terrarium-dem"].type === "raster-dem") {
            return "terrarium-dem";
        }
        for (const [srcId, srcDef] of Object.entries(sources)) {
            if (srcId !== this.sourceId && srcDef && srcDef.type === "raster-dem") {
                return srcId;
            }
        }
        return null;
    },

    // Resuelve la capa "beforeId" según metadatos del JSON ("otromundoReliefBefore" / "otromundoReliefAfter")
    // o bien de forma automática antes de overlays/rutas/carreteras/etiquetas
    getBeforeLayerId(mapObj) {
        const style = mapObj.getStyle?.() || {};
        const layers = style.layers || [];
        const layerIds = new Set(layers.map(l => l.id));

        // 1. Si el JSON del estilo indica explícitamente "otromundoReliefBefore"
        if (typeof style.otromundoReliefBefore === "string" && layerIds.has(style.otromundoReliefBefore)) {
            return style.otromundoReliefBefore;
        }

        // 2. Si el JSON del estilo indica explícitamente "otromundoReliefAfter", insertamos antes de la capa siguiente
        if (typeof style.otromundoReliefAfter === "string" && layerIds.has(style.otromundoReliefAfter)) {
            const afterIdx = layers.findIndex(l => l.id === style.otromundoReliefAfter);
            if (afterIdx >= 0 && afterIdx + 1 < layers.length) {
                return layers[afterIdx + 1].id;
            }
            return undefined;
        }

        // 3. Posición por defecto: antes de capas de análisis/ruta/cursor y, si no existen, antes de etiquetas/carreteras vectoriales
        for (const layer of layers) {
            if (
                layer.id === "otromundo-slope-layer" ||
                layer.id === "otromundo-aspect-layer" ||
                layer.id === "otromundo-contour-minor" ||
                layer.id === "otromundo-contour-major" ||
                layer.id === "otromundo-imported-track-ref-layer" ||
                layer.id.startsWith("inactive-alt-") ||
                layer.id.startsWith("active-segment-") ||
                layer.id === "planned-route-arrows" ||
                layer.id === "cursor-helper-layer"
            ) {
                return layer.id;
            }
        }

        // En estilos vectoriales con muchas capas, intentar situar el sombreado por debajo de vías, caminos y textos
        const vectorOverlayHint = /(road|path|trail|track|street|highway|bridge|tunnel|label|place|poi|symbol|route)/i;
        for (const layer of layers) {
            if (layer.type === "symbol" || vectorOverlayHint.test(layer.id || "")) {
                return layer.id;
            }
        }

        return undefined;
    },

    applyReliefLayer() {
        const mapObj = window.map;
        if (!mapObj) return;

        this.cleanupFixedHillshadeLayers(mapObj);
        this.removeReliefLayer();

        const existingDemSource = this.findExistingDemSourceId(mapObj);
        let activeSourceId = existingDemSource;

        if (!activeSourceId) {
            mapObj.addSource(this.sourceId, {
                type: "raster-dem",
                tiles: [this.demUrlTemplate],
                encoding: "terrarium",
                tileSize: 256,
                maxzoom: 14
            });
            activeSourceId = this.sourceId;
        }

        const beforeId = this.getBeforeLayerId(mapObj);

        mapObj.addLayer(
            {
                id: this.layerId,
                type: "hillshade",
                source: activeSourceId,
                paint: {
                    "hillshade-exaggeration": this.settings.exaggeration,
                    "hillshade-illumination-direction": this.settings.sunDirection,
                    "hillshade-illumination-anchor": "map",
                    "hillshade-shadow-color": this.settings.shadowColor,
                    "hillshade-highlight-color": this.settings.highlightColor,
                    "hillshade-accent-color": "#1a1f29"
                }
            },
            beforeId
        );
    },

    updatePaintProperties() {
        const mapObj = window.map;
        if (!mapObj || !mapObj.getLayer(this.layerId)) return;
        mapObj.setPaintProperty(this.layerId, "hillshade-exaggeration", this.settings.exaggeration);
        mapObj.setPaintProperty(this.layerId, "hillshade-illumination-direction", this.settings.sunDirection);
    },

    removeReliefLayer() {
        const mapObj = window.map;
        if (!mapObj) return;
        try {
            if (mapObj.getLayer(this.layerId)) mapObj.removeLayer(this.layerId);
            if (mapObj.getSource(this.sourceId)) mapObj.removeSource(this.sourceId);
        } catch (e) {}
    }
};

window.ReliefLayerManager = ReliefLayerManager;
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => ReliefLayerManager.init());
} else {
    ReliefLayerManager.init();
}