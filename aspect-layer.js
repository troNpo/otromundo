// ==========================================
// ASPECT-LAYER.JS - Mapa de Orientación de Laderas (Aspect) en tiempo real usando Mapterhorn DEM (Terrarium)
// ==========================================

const AspectLayerManager = {
    isEnabled: false,
    protocolRegistered: false,
    sourceId: "otromundo-aspect-source",
    layerId: "otromundo-aspect-layer",
    protocolName: "otromundo-aspect",
    demUrlTemplate: "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp",
    tileCache: new Map(),
    maxCacheEntries: 120,
    settings: {
        opacity: 0.48,
        minSlope: 5,        // Ignorar terreno llano (< 5°) para no generar ruido de orientación
        mode: "compass"     // "compass" (8 rumbos N-NE-E-SE-S-SO-O-NO) | "solar" (Solana vs Umbría)
    },

    init() {
        this.loadSavedSettings();
        this.registerAspectProtocol();
        this.injectUIControls();
        this.setupMapListeners();
    },

    loadSavedSettings() {
        try {
            const savedEnabled = localStorage.getItem("otromundo_aspect_enabled");
            if (savedEnabled !== null) {
                this.isEnabled = savedEnabled === "true";
            }
            const savedSettings = localStorage.getItem("otromundo_aspect_settings");
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (e) {
            console.warn("No se pudieron cargar las preferencias de orientación:", e);
        }
    },

    saveSettings() {
        try {
            localStorage.setItem("otromundo_aspect_settings", JSON.stringify(this.settings));
            localStorage.setItem("otromundo_aspect_enabled", String(this.isEnabled));
        } catch (e) {}
    },

    // ==========================================
    // 1. PROTOCOLO CUSTOM MAPLIBRE PARA CÁLCULO DE ORIENTACIÓN (ASPECT)
    // ==========================================
    registerAspectProtocol() {
        if (this.protocolRegistered || typeof maplibregl === "undefined" || typeof maplibregl.addProtocol !== "function") {
            return;
        }
        this.protocolRegistered = true;

        maplibregl.addProtocol(this.protocolName, async (params, abortController) => {
            try {
                // Formato URL: otromundo-aspect://{z}/{x}/{y}?min={minSlope}&mode={mode}
                const cleanUrl = params.url.replace(`${this.protocolName}://`, "");
                const [pathPart, queryPart] = cleanUrl.split("?");
                const [zStr, xStr, yStr] = pathPart.split("/");
                const z = parseInt(zStr, 10);
                const x = parseInt(xStr, 10);
                const y = parseInt(yStr, 10);

                const searchParams = new URLSearchParams(queryPart || "");
                const minSlope = parseFloat(searchParams.get("min") || this.settings.minSlope);
                const mode = searchParams.get("mode") || this.settings.mode;

                const cacheKey = `${z}/${x}/${y}_${minSlope}_${mode}`;
                if (this.tileCache.has(cacheKey)) {
                    const cachedBuffer = this.tileCache.get(cacheKey);
                    return { data: cachedBuffer.slice(0) };
                }

                const demUrl = this.demUrlTemplate
                    .replace("{z}", String(z))
                    .replace("{x}", String(x))
                    .replace("{y}", String(y));

                const response = await fetch(demUrl, { signal: abortController?.signal });
                if (!response.ok) {
                    return { data: await this.createTransparentTileBuffer() };
                }

                const blob = await response.blob();
                const bitmap = await createImageBitmap(blob);

                const width = bitmap.width;
                const height = bitmap.height;

                const srcCanvas = document.createElement("canvas");
                srcCanvas.width = width;
                srcCanvas.height = height;
                const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
                srcCtx.drawImage(bitmap, 0, 0);
                bitmap.close?.();

                const imgData = srcCtx.getImageData(0, 0, width, height);
                const rgba = imgData.data;

                // Decodificación Terrarium: elevación (m) = (R * 256 + G + B / 256) - 32768
                const totalPixels = width * height;
                const elevations = new Float32Array(totalPixels);
                for (let i = 0, p = 0; i < totalPixels; i++, p += 4) {
                    elevations[i] = (rgba[p] * 256 + rgba[p + 1] + rgba[p + 2] / 256) - 32768;
                }

                const n = Math.pow(2, z);
                const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)));
                const metersPerPixel = (40075016.686 * Math.cos(latRad)) / (width * n);
                const eightRes = 8 * metersPerPixel;
                const radToDeg = 180 / Math.PI;

                const outCanvas = document.createElement("canvas");
                outCanvas.width = width;
                outCanvas.height = height;
                const outCtx = outCanvas.getContext("2d");
                const outImg = outCtx.createImageData(width, height);
                const outData = outImg.data;

                // Gradiente de Horn (3x3) para calcular pendiente y azimut de caída (Aspect 0°=Norte, 90°=Este, 180°=Sur, 270°=Oeste)
                for (let row = 0; row < height; row++) {
                    const rPrev = row > 0 ? row - 1 : 0;
                    const rNext = row < height - 1 ? row + 1 : height - 1;
                    const rowOff = row * width;
                    const prevOff = rPrev * width;
                    const nextOff = rNext * width;

                    for (let col = 0; col < width; col++) {
                        const cPrev = col > 0 ? col - 1 : 0;
                        const cNext = col < width - 1 ? col + 1 : width - 1;

                        const a = elevations[prevOff + cPrev];
                        const b = elevations[prevOff + col];
                        const c = elevations[prevOff + cNext];
                        const d = elevations[rowOff + cPrev];
                        const f = elevations[rowOff + cNext];
                        const g = elevations[nextOff + cPrev];
                        const h = elevations[nextOff + col];
                        const iVal = elevations[nextOff + cNext];

                        const dzdx = ((c + 2 * f + iVal) - (a + 2 * d + g)) / eightRes;
                        const dzdy = ((g + 2 * h + iVal) - (a + 2 * b + c)) / eightRes;

                        const slopeDeg = Math.atan(Math.hypot(dzdx, dzdy)) * radToDeg;
                        const pxIdx = (rowOff + col) * 4;

                        if (slopeDeg < minSlope) {
                            outData[pxIdx + 3] = 0;
                            continue;
                        }

                        // Azimut hacia donde mira la ladera (0° = Norte, horario)
                        let aspectDeg = Math.atan2(-dzdx, dzdy) * radToDeg;
                        if (aspectDeg < 0) aspectDeg += 360;

                        const color = this.getColorForAspect(aspectDeg, mode);
                        outData[pxIdx] = color[0];
                        outData[pxIdx + 1] = color[1];
                        outData[pxIdx + 2] = color[2];
                        outData[pxIdx + 3] = color[3];
                    }
                }

                outCtx.putImageData(outImg, 0, 0);
                const outBlob = await new Promise(resolve => outCanvas.toBlob(resolve, "image/png"));
                const arrayBuffer = await outBlob.arrayBuffer();

                if (this.tileCache.size >= this.maxCacheEntries) {
                    const oldestKey = this.tileCache.keys().next().value;
                    this.tileCache.delete(oldestKey);
                }
                this.tileCache.set(cacheKey, arrayBuffer.slice(0));

                return { data: arrayBuffer };
            } catch (err) {
                if (err?.name === "AbortError") throw err;
                return { data: await this.createTransparentTileBuffer() };
            }
        });
    },

    async createTransparentTileBuffer() {
        const c = document.createElement("canvas");
        c.width = 1;
        c.height = 1;
        const blob = await new Promise(r => c.toBlob(r, "image/png"));
        return await blob.arrayBuffer();
    },

    // Paleta cartográfica por orientación (Umbría fría en azul/cian, Solana cálida en rojo/naranja/amarillo)
    getColorForAspect(deg, mode) {
        if (mode === "solar") {
            // Solana (SE - S - SO: 112.5° a 247.5°) vs Umbría (NO - N - NE: 292.5° a 67.5°) vs Media ladera (E / O)
            if (deg >= 112.5 && deg < 247.5) return [255, 82, 82, 195];     // Solana (Cálida / Soleada)
            if (deg >= 292.5 || deg < 67.5) return [0, 176, 255, 195];      // Umbría (Fría / Nieve dura)
            return [255, 215, 64, 150];                                     // Media exposición (Este / Oeste)
        }

        // 8 sectores cardinales estándar
        if (deg >= 337.5 || deg < 22.5)  return [0, 145, 255, 200];  // N  - Azul intenso (Umbría pura)
        if (deg >= 22.5 && deg < 67.5)   return [0, 229, 255, 190];  // NE - Cian
        if (deg >= 67.5 && deg < 112.5)  return [0, 230, 118, 185];  // E  - Verde esmeralda (Sol de mañana)
        if (deg >= 112.5 && deg < 157.5) return [255, 234, 0, 190];  // SE - Amarillo
        if (deg >= 157.5 && deg < 202.5) return [255, 61, 0, 200];   // S  - Rojo naranja (Solana pura)
        if (deg >= 202.5 && deg < 247.5) return [255, 145, 0, 195];  // SO - Naranja (Sol de tarde)
        if (deg >= 247.5 && deg < 292.5) return [181, 92, 255, 185]; // O  - Violeta
        return [83, 109, 254, 195];                                  // NO - Índigo frío
    },

    // ==========================================
    // 2. INYECTAR TARJETA + ROSA DE ORIENTACIÓN EN PANEL MAPAS BASE
    // ==========================================
    injectUIControls() {
        const mapsDrawerBody = document.querySelector("#side-panel-maps .side-drawer-body");
        if (!mapsDrawerBody || document.getElementById("otromundo-aspect-card")) return;

        const card = document.createElement("div");
        card.id = "otromundo-aspect-card";
        card.style.cssText = `
            margin-top: 12px;
            padding: 12px 14px;
            background: rgba(255, 255, 255, 0.04);
            border: 1.5px solid rgba(0, 229, 255, 0.4);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            box-sizing: border-box;
            max-width: 100%;
            flex-shrink: 0;
            font-family: sans-serif;
            transition: all 0.2s ease;
        `;

        card.innerHTML = `
            <!-- Cabecera con interruptor principal -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div id="aspect-toggle-row" style="display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer;">
                    <div style="background: rgba(0, 229, 255, 0.12); border-radius: 8px; padding: 7px; display: flex; align-items: center; justify-content: center;">
                        <img src="ui-icons/fi-rr-location-crosshairs.svg" width="18" height="18" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg);" alt="Orientación">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 0.88rem; font-weight: bold; color: #fff;">Orientación (Aspecto)</span>
                        <span style="font-size: 0.72rem; color: #aaa;">Exposición solar y rumbos de ladera</span>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 10px;">
                    <button id="btn-toggle-aspect-settings" type="button" title="Configurar orientación de laderas" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #00e5ff; border-radius: 8px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem; transition: transform 0.2s ease;">
                        ▾
                    </button>
                    <label class="switch" id="aspect-switch-label" style="cursor: pointer;">
                        <input type="checkbox" id="toggle-aspect-layer" ${this.isEnabled ? "checked" : ""}>
                        <span class="slider-round"></span>
                    </label>
                </div>
            </div>

            <!-- Desplegable de Configuración -->
            <div id="aspect-settings-drawer" style="display: ${this.isEnabled ? "flex" : "none"}; min-width: 0; flex-direction: column; gap: 11px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 11px; margin-top: 2px;">
                
                <!-- Leyenda de rumbos -->
                <div id="aspect-legend-bar" style="display: flex; flex-direction: column; gap: 5px; background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.08); border-radius: 9px; padding: 7px 9px;">
                    ${this.buildLegendHTML()}
                </div>

                <!-- Modo de visualización -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 0.78rem; color: #ccc; flex-shrink: 0;">Clasificación:</span>
                    <select id="aspect-mode-select" style="flex: 1 1 0; min-width: 0; max-width: 100%; box-sizing: border-box; text-overflow: ellipsis; background: #121214; color: #00e5ff; border: 1px solid rgba(0,229,255,0.35); border-radius: 8px; padding: 5px 8px; font-size: 0.78rem; outline: none; cursor: pointer;">
                        <option value="compass" ${this.settings.mode === "compass" ? "selected" : ""}>8 rumbos</option>
                        <option value="solar" ${this.settings.mode === "solar" ? "selected" : ""}>Solana / Umbría</option>
                    </select>
                </div>

                <!-- Filtro de terreno llano -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 0.78rem; color: #ccc; flex-shrink: 0;">Ocultar llanos (&lt;):</span>
                    <select id="aspect-min-slope-select" style="flex: 1 1 0; min-width: 0; max-width: 100%; box-sizing: border-box; text-overflow: ellipsis; background: #121214; color: #00e5ff; border: 1px solid rgba(0,229,255,0.35); border-radius: 8px; padding: 5px 8px; font-size: 0.78rem; outline: none; cursor: pointer;">
                        <option value="2" ${this.settings.minSlope === 2 ? "selected" : ""}>2°</option>
                        <option value="5" ${this.settings.minSlope === 5 ? "selected" : ""}>5° (estándar)</option>
                        <option value="12" ${this.settings.minSlope === 12 ? "selected" : ""}>12°</option>
                    </select>
                </div>

                <!-- Opacidad -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 0.78rem; color: #ccc;">Opacidad:</span>
                    <input type="range" id="aspect-opacity-slider" min="0" max="1" step="0.05" value="${this.settings.opacity}" style="flex: 1; min-width: 0; accent-color: #00e5ff; cursor: pointer;">
                    <span id="aspect-opacity-val" style="font-size: 0.76rem; color: #00e5ff; font-weight: bold; min-width: 34px; text-align: right;">${Math.round(this.settings.opacity * 100)}%</span>
                </div>

            </div>
        `;

        const slopeCard = document.getElementById("otromundo-slope-card");
        const contourCard = document.getElementById("otromundo-contour-card");
        const anchorCard = slopeCard || contourCard;

        if (anchorCard && anchorCard.parentElement === mapsDrawerBody) {
            anchorCard.insertAdjacentElement("afterend", card);
        } else {
            mapsDrawerBody.appendChild(card);
        }

        const checkbox = document.getElementById("toggle-aspect-layer");
        const toggleRow = document.getElementById("aspect-toggle-row");
        const settingsBtn = document.getElementById("btn-toggle-aspect-settings");
        const settingsDrawer = document.getElementById("aspect-settings-drawer");
        const modeSelect = document.getElementById("aspect-mode-select");
        const minSlopeSelect = document.getElementById("aspect-min-slope-select");
        const opacitySlider = document.getElementById("aspect-opacity-slider");
        const opacityVal = document.getElementById("aspect-opacity-val");
        const legendBar = document.getElementById("aspect-legend-bar");

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
                this.applyAspectLayer();
                window.RoutePlanner?.showToast?.("Capa de orientación activada");
            } else {
                this.removeAspectLayer();
                window.RoutePlanner?.showToast?.("Capa de orientación desactivada");
            }
        };

        toggleRow?.addEventListener("click", () => handleActivationChange(!this.isEnabled));
        checkbox?.addEventListener("change", (e) => {
            e.stopPropagation();
            handleActivationChange(e.target.checked);
        });

        modeSelect?.addEventListener("change", (e) => {
            this.settings.mode = e.target.value;
            this.saveSettings();
            if (legendBar) legendBar.innerHTML = this.buildLegendHTML();
            if (this.isEnabled) this.applyAspectLayer();
        });

        minSlopeSelect?.addEventListener("change", (e) => {
            this.settings.minSlope = parseFloat(e.target.value);
            this.saveSettings();
            if (this.isEnabled) this.applyAspectLayer();
        });

        opacitySlider?.addEventListener("input", (e) => {
            this.settings.opacity = parseFloat(e.target.value);
            if (opacityVal) opacityVal.innerText = `${Math.round(this.settings.opacity * 100)}%`;
            this.saveSettings();
            if (this.isEnabled) this.updateLayerOpacity();
        });
    },

    buildLegendHTML() {
        if (this.settings.mode === "solar") {
            const items = [
                { color: "#00b0ff", label: "Umbría (N)" },
                { color: "#ffd740", label: "Este / Oeste" },
                { color: "#ff5252", label: "Solana (S)" }
            ];
            return `
                <div style="display: flex; align-items: center; gap: 6px; width: 100%;">
                    ${items.map(it => `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;">
                            <div style="width: 100%; height: 7px; border-radius: 4px; background: ${it.color};"></div>
                            <span style="font-size: 0.65rem; color: #ddd; font-weight: bold;">${it.label}</span>
                        </div>
                    `).join("")}
                </div>
            `;
        }

        const dirs = [
            { color: "#0091ff", label: "N" },
            { color: "#00e5ff", label: "NE" },
            { color: "#00e676", label: "E" },
            { color: "#ffea00", label: "SE" },
            { color: "#ff3d00", label: "S" },
            { color: "#ff9100", label: "SO" },
            { color: "#b55cff", label: "O" },
            { color: "#536dfe", label: "NO" }
        ];

        return `
            <div style="display: flex; align-items: center; gap: 3px; width: 100%;">
                ${dirs.map(d => `
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;">
                        <div style="width: 100%; height: 7px; border-radius: 3px; background: ${d.color};"></div>
                        <span style="font-size: 0.62rem; color: #ddd; font-weight: bold;">${d.label}</span>
                    </div>
                `).join("")}
            </div>
        `;
    },

    // ==========================================
    // 3. GESTIÓN DE LA CAPA RÁSTER EN MAPLIBRE GL JS
    // ==========================================
    setupMapListeners() {
        const waitForMap = setInterval(() => {
            const mapObj = window.map;
            if (mapObj && typeof mapObj.on === "function") {
                clearInterval(waitForMap);

                this.registerAspectProtocol();

                if (mapObj.isStyleLoaded() && this.isEnabled) {
                    this.applyAspectLayer();
                }

                mapObj.on("style.load", () => {
                    this.registerAspectProtocol();
                    if (this.isEnabled) {
                        setTimeout(() => this.applyAspectLayer(), 200);
                    }
                });
            }
        }, 150);
    },

    getBeforeLayerId(mapObj) {
        const layers = mapObj.getStyle()?.layers || [];
        for (const layer of layers) {
            if (
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
        return undefined;
    },

    applyAspectLayer() {
        const mapObj = window.map;
        if (!mapObj) return;

        this.removeAspectLayer();

        const tileUrl = `${this.protocolName}://{z}/{x}/{y}?min=${this.settings.minSlope}&mode=${this.settings.mode}`;

        mapObj.addSource(this.sourceId, {
            type: "raster",
            tiles: [tileUrl],
            tileSize: 256,
            maxzoom: 14
        });

        const beforeId = this.getBeforeLayerId(mapObj);

        mapObj.addLayer(
            {
                id: this.layerId,
                type: "raster",
                source: this.sourceId,
                paint: {
                    "raster-opacity": this.settings.opacity,
                    "raster-fade-duration": 150
                }
            },
            beforeId
        );
    },

    updateLayerOpacity() {
        const mapObj = window.map;
        if (!mapObj || !mapObj.getLayer(this.layerId)) return;
        mapObj.setPaintProperty(this.layerId, "raster-opacity", this.settings.opacity);
    },

    removeAspectLayer() {
        const mapObj = window.map;
        if (!mapObj) return;
        try {
            if (mapObj.getLayer(this.layerId)) mapObj.removeLayer(this.layerId);
            if (mapObj.getSource(this.sourceId)) mapObj.removeSource(this.sourceId);
        } catch (e) {}
    }
};

window.AspectLayerManager = AspectLayerManager;
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => AspectLayerManager.init());
} else {
    AspectLayerManager.init();
}