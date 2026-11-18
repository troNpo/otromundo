// ==========================================
// CONTOUR-LAYER.JS - Curvas de nivel dinámicas en tiempo real (Mapterhorn DEM + maplibre-contour)
// ==========================================

const ContourLayerManager = {
    isEnabled: false,
    demSource: null,
    settings: {
        minorStep: 20,      // Equidistancia curvas normales (m)
        majorStep: 100,     // Equidistancia curvas maestras (m)
        color: "#d97724",   // Color topográfico clásico (siena/naranja)
        opacity: 0.75,      // Opacidad
        showLabels: true    // Etiquetas de cota en curvas maestras
    },

    init() {
        this.loadSavedSettings();
        this.ensureLibraryAndStart();
    },

    loadSavedSettings() {
        try {
            const savedEnabled = localStorage.getItem("otromundo_contour_enabled");
            if (savedEnabled !== null) {
                this.isEnabled = savedEnabled === "true";
            }
            const savedSettings = localStorage.getItem("otromundo_contour_settings");
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (e) {
            console.warn("No se pudieron cargar las preferencias de curvas de nivel:", e);
        }
    },

    // Calcula el color de halo/fondo con contraste automático (YIQ) según el color de las curvas
    getContrastHaloColor(hexColor) {
        if (!hexColor || !hexColor.startsWith("#")) return "#121214";
        let hex = hexColor.slice(1);
        if (hex.length === 3) {
            hex = hex.split("").map(c => c + c).join("");
        }
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq < 115 ? "#ffffff" : "#121214";
    },

    saveSettings() {
        try {
            localStorage.setItem("otromundo_contour_settings", JSON.stringify(this.settings));
            localStorage.setItem("otromundo_contour_enabled", String(this.isEnabled));
        } catch (e) {}
    },

    ensureLibraryAndStart() {
        if (window.mlcontour) {
            this.setupManager();
            return;
        }

        const script = document.createElement("script");
        script.src = "https://unpkg.com/maplibre-contour@0.0.5/dist/index.min.js";
        script.async = true;
        script.onload = () => this.setupManager();
        script.onerror = () => console.warn("No se pudo cargar maplibre-contour desde CDN.");
        document.head.appendChild(script);
    },

    setupManager() {
        this.injectUIControls();
        this.setupMapListeners();
    },

    // ==========================================
    // 1. INYECTAR TARJETA + DESPLEGABLE EN PANEL MAPAS BASE
    // ==========================================
    injectUIControls() {
        const mapsDrawerBody = document.querySelector("#side-panel-maps .side-drawer-body");
        if (!mapsDrawerBody || document.getElementById("otromundo-contour-card")) return;

        const card = document.createElement("div");
        card.id = "otromundo-contour-card";
        card.style.cssText = `
            margin-top: 14px;
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
                <div id="contour-toggle-row" style="display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer;">
                    <div style="background: rgba(0, 229, 255, 0.12); border-radius: 8px; padding: 7px; display: flex; align-items: center; justify-content: center;">
                        <img src="ui-icons/fi-rr-mountains.svg" width="18" height="18" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg);" alt="Curvas">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 0.88rem; font-weight: bold; color: #fff;">Curvas de Nivel</span>
                        <span style="font-size: 0.72rem; color: #aaa;">Relieve topográfico vectorial</span>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 10px;">
                    <button id="btn-toggle-contour-settings" type="button" title="Configurar curvas de nivel" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #00e5ff; border-radius: 8px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem; transition: transform 0.2s ease;">
                        ▾
                    </button>
                    <label class="switch" id="contour-switch-label" style="cursor: pointer;">
                        <input type="checkbox" id="toggle-contour-layer" ${this.isEnabled ? "checked" : ""}>
                        <span class="slider-round"></span>
                    </label>
                </div>
            </div>

            <!-- Desplegable de Configuración -->
            <div id="contour-settings-drawer" style="display: ${this.isEnabled ? "flex" : "none"}; flex-direction: column; gap: 12px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; margin-top: 2px;">
                
                <!-- Equidistancia -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 0.78rem; color: #ccc;">Equidistancia:</span>
                    <select id="contour-interval-select" style="background: #121214; color: #00e5ff; border: 1px solid rgba(0,229,255,0.35); border-radius: 8px; padding: 5px 8px; font-size: 0.78rem; outline: none; cursor: pointer;">
                        <option value="10-50" ${this.settings.minorStep === 10 ? "selected" : ""}>10 m / 50 m (Detalle)</option>
                        <option value="20-100" ${this.settings.minorStep === 20 ? "selected" : ""}>20 m / 100 m (Estándar)</option>
                        <option value="25-100" ${this.settings.minorStep === 25 ? "selected" : ""}>25 m / 100 m (IGN)</option>
                        <option value="50-250" ${this.settings.minorStep === 50 ? "selected" : ""}>50 m / 250 m (Alta montaña)</option>
                    </select>
                </div>

                <!-- Color de las curvas -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 0.78rem; color: #ccc;">Color de trazado:</span>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button type="button" class="contour-color-preset" data-color="#d97724" title="Siena Topográfico" style="width: 20px; height: 20px; border-radius: 50%; background: #d97724; border: 2px solid #fff; cursor: pointer; padding: 0;"></button>
                        <button type="button" class="contour-color-preset" data-color="#00e5ff" title="Cian OtroMundo" style="width: 20px; height: 20px; border-radius: 50%; background: #00e5ff; border: 1.5px solid rgba(255,255,255,0.4); cursor: pointer; padding: 0;"></button>
                        <button type="button" class="contour-color-preset" data-color="#ffffff" title="Blanco (Ideal Satélite)" style="width: 20px; height: 20px; border-radius: 50%; background: #ffffff; border: 1.5px solid rgba(255,255,255,0.4); cursor: pointer; padding: 0;"></button>
                        <button type="button" class="contour-color-preset" data-color="#3e2723" title="Marrón Oscuro" style="width: 20px; height: 20px; border-radius: 50%; background: #3e2723; border: 1.5px solid rgba(255,255,255,0.4); cursor: pointer; padding: 0;"></button>
                        <input type="color" id="contour-color-picker" value="${this.settings.color}" title="Color personalizado" style="width: 24px; height: 24px; border: none; background: transparent; cursor: pointer; padding: 0;">
                    </div>
                </div>

                <!-- Opacidad -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 0.78rem; color: #ccc;">Opacidad:</span>
                    <input type="range" id="contour-opacity-slider" min="0.15" max="1" step="0.05" value="${this.settings.opacity}" style="flex: 1; accent-color: #00e5ff; cursor: pointer;">
                    <span id="contour-opacity-val" style="font-size: 0.76rem; color: #00e5ff; font-weight: bold; min-width: 34px; text-align: right;">${Math.round(this.settings.opacity * 100)}%</span>
                </div>

                <!-- Mostrar cotas numéricas -->
                <div id="contour-labels-row" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding-top: 2px;">
                    <span style="font-size: 0.78rem; color: #ccc;">Etiquetas de altitud (m):</span>
                    <input type="checkbox" id="contour-labels-checkbox" ${this.settings.showLabels ? "checked" : ""} style="accent-color: #00e5ff; width: 16px; height: 16px; cursor: pointer;">
                </div>

            </div>
        `;

        mapsDrawerBody.appendChild(card);

        const checkbox = document.getElementById("toggle-contour-layer");
        const toggleRow = document.getElementById("contour-toggle-row");
        const settingsBtn = document.getElementById("btn-toggle-contour-settings");
        const settingsDrawer = document.getElementById("contour-settings-drawer");
        const intervalSelect = document.getElementById("contour-interval-select");
        const colorPicker = document.getElementById("contour-color-picker");
        const opacitySlider = document.getElementById("contour-opacity-slider");
        const opacityVal = document.getElementById("contour-opacity-val");
        const labelsCheckbox = document.getElementById("contour-labels-checkbox");
        const labelsRow = document.getElementById("contour-labels-row");

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
                this.applyContourLayers();
                window.RoutePlanner?.showToast?.("Curvas de nivel activadas");
            } else {
                this.removeContourLayers();
                window.RoutePlanner?.showToast?.("Curvas de nivel desactivadas");
            }
        };

        toggleRow?.addEventListener("click", () => handleActivationChange(!this.isEnabled));
        checkbox?.addEventListener("change", (e) => {
            e.stopPropagation();
            handleActivationChange(e.target.checked);
        });

        intervalSelect?.addEventListener("change", (e) => {
            const [minor, major] = e.target.value.split("-").map(Number);
            this.settings.minorStep = minor;
            this.settings.majorStep = major;
            this.saveSettings();
            if (this.isEnabled) this.applyContourLayers();
        });

        card.querySelectorAll(".contour-color-preset").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const chosenColor = btn.dataset.color;
                this.settings.color = chosenColor;
                if (colorPicker) colorPicker.value = chosenColor;
                this.saveSettings();
                if (this.isEnabled) this.updatePaintProperties();
            });
        });

        colorPicker?.addEventListener("input", (e) => {
            this.settings.color = e.target.value;
            this.saveSettings();
            if (this.isEnabled) this.updatePaintProperties();
        });

        opacitySlider?.addEventListener("input", (e) => {
            this.settings.opacity = parseFloat(e.target.value);
            if (opacityVal) opacityVal.innerText = `${Math.round(this.settings.opacity * 100)}%`;
            this.saveSettings();
            if (this.isEnabled) this.updatePaintProperties();
        });

        labelsRow?.addEventListener("click", (e) => {
            if (e.target !== labelsCheckbox && labelsCheckbox) {
                labelsCheckbox.checked = !labelsCheckbox.checked;
            }
            this.settings.showLabels = labelsCheckbox.checked;
            this.saveSettings();
            if (this.isEnabled) this.updateLabelsVisibility();
        });
    },

    // ==========================================
    // 2. GESTIÓN DE CAPAS EN MAPLIBRE GL JS
    // ==========================================
    setupMapListeners() {
        const waitForMap = setInterval(() => {
            const mapObj = window.map;
            if (mapObj && typeof mapObj.on === "function") {
                clearInterval(waitForMap);

                const initDemProtocol = () => {
                    if (!this.demSource && window.mlcontour) {
                        this.demSource = new window.mlcontour.DemSource({
                            url: "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp",
                            encoding: "terrarium",
                            maxzoom: 14,
                            worker: true,
                            cacheSize: 100,
                            timeoutMs: 10000
                        });
                        this.demSource.setupMaplibre(maplibregl);
                    }
                };

                initDemProtocol();

                if (mapObj.isStyleLoaded() && this.isEnabled) {
                    this.applyContourLayers();
                }

                mapObj.on("style.load", () => {
                    initDemProtocol();
                    if (this.isEnabled) {
                        setTimeout(() => this.applyContourLayers(), 220);
                    }
                });
            }
        }, 150);
    },

    getBeforeLayerId(mapObj) {
        const layers = mapObj.getStyle()?.layers || [];
        for (const layer of layers) {
            if (
                layer.id.startsWith("inactive-alt-") ||
                layer.id.startsWith("active-segment-") ||
                layer.id === "planned-route-arrows" ||
                layer.id === "cursor-helper-layer"
            ) {
                return layer.id;
            }
        }
        return undefined;
    },

    applyContourLayers() {
        const mapObj = window.map;
        if (!mapObj || !this.demSource) return;

        this.removeContourLayers();

        const tileUrl = this.demSource.contourProtocolUrl({
            multiplier: 1,
            thresholds: {
                11: [this.settings.majorStep, this.settings.majorStep * 5],
                12: [this.settings.minorStep * 2, this.settings.majorStep],
                13: [this.settings.minorStep, this.settings.majorStep],
                15: [this.settings.minorStep, this.settings.majorStep]
            },
            contourLayer: "contours",
            elevationKey: "ele",
            levelKey: "level"
        });

        mapObj.addSource("otromundo-contour-source", {
            type: "vector",
            tiles: [tileUrl],
            maxzoom: 15
        });

        const beforeId = this.getBeforeLayerId(mapObj);

        mapObj.addLayer(
            {
                id: "otromundo-contour-minor",
                type: "line",
                source: "otromundo-contour-source",
                "source-layer": "contours",
                filter: ["==", ["get", "level"], 0],
                paint: {
                    "line-color": this.settings.color,
                    "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 15, 1.0],
                    "line-opacity": this.settings.opacity * 0.65
                }
            },
            beforeId
        );

        mapObj.addLayer(
            {
                id: "otromundo-contour-major",
                type: "line",
                source: "otromundo-contour-source",
                "source-layer": "contours",
                filter: ["==", ["get", "level"], 1],
                paint: {
                    "line-color": this.settings.color,
                    "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.1, 15, 2.0],
                    "line-opacity": this.settings.opacity
                }
            },
            beforeId
        );

        const currentStyle = mapObj.getStyle();
        if (!currentStyle.glyphs) {
            mapObj.setGlyphs("https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf");
        }

        let resolvedFont = ["Noto Sans Regular"];
        const existingSymbolLayer = (currentStyle.layers || []).find(
            l => l.type === "symbol" && l.layout && Array.isArray(l.layout["text-font"])
        );
        if (existingSymbolLayer && currentStyle.glyphs) {
            resolvedFont = existingSymbolLayer.layout["text-font"];
        }

        mapObj.addLayer(
            {
                id: "otromundo-contour-labels",
                type: "symbol",
                source: "otromundo-contour-source",
                "source-layer": "contours",
                filter: ["==", ["get", "level"], 1],
                layout: {
                    "visibility": this.settings.showLabels ? "visible" : "none",
                    "symbol-placement": "line",
                    "symbol-spacing": 110,
                    "text-max-angle": 65,
                    "text-field": ["concat", ["to-string", ["get", "ele"]], " m"],
                    "text-font": resolvedFont,
                    "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 12.5],
                    "text-padding": 1
                },
                paint: {
                    "text-color": this.settings.color,
                    "text-halo-color": this.getContrastHaloColor(this.settings.color),
                    "text-halo-width": 2.2,
                    "text-opacity": this.settings.opacity
                }
            },
            beforeId
        );
    },

    updatePaintProperties() {
        const mapObj = window.map;
        if (!mapObj) return;

        if (mapObj.getLayer("otromundo-contour-minor")) {
            mapObj.setPaintProperty("otromundo-contour-minor", "line-color", this.settings.color);
            mapObj.setPaintProperty("otromundo-contour-minor", "line-opacity", this.settings.opacity * 0.65);
        }
        if (mapObj.getLayer("otromundo-contour-major")) {
            mapObj.setPaintProperty("otromundo-contour-major", "line-color", this.settings.color);
            mapObj.setPaintProperty("otromundo-contour-major", "line-opacity", this.settings.opacity);
        }
        if (mapObj.getLayer("otromundo-contour-labels")) {
            mapObj.setPaintProperty("otromundo-contour-labels", "text-color", this.settings.color);
            mapObj.setPaintProperty("otromundo-contour-labels", "text-halo-color", this.getContrastHaloColor(this.settings.color));
            mapObj.setPaintProperty("otromundo-contour-labels", "text-opacity", this.settings.opacity);
        }
    },

    updateLabelsVisibility() {
        const mapObj = window.map;
        if (!mapObj || !mapObj.getLayer("otromundo-contour-labels")) return;
        mapObj.setLayoutProperty(
            "otromundo-contour-labels",
            "visibility",
            this.settings.showLabels ? "visible" : "none"
        );
    },

    removeContourLayers() {
        const mapObj = window.map;
        if (!mapObj) return;
        try {
            if (mapObj.getLayer("otromundo-contour-labels")) mapObj.removeLayer("otromundo-contour-labels");
            if (mapObj.getLayer("otromundo-contour-major")) mapObj.removeLayer("otromundo-contour-major");
            if (mapObj.getLayer("otromundo-contour-minor")) mapObj.removeLayer("otromundo-contour-minor");
            if (mapObj.getSource("otromundo-contour-source")) mapObj.removeSource("otromundo-contour-source");
        } catch (e) {}
    }
};

window.ContourLayerManager = ContourLayerManager;
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => ContourLayerManager.init());
} else {
    ContourLayerManager.init();
}
