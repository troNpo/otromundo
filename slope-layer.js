// ==========================================
// SLOPE-LAYER.JS - Mapa de Pendientes (Slope) en tiempo real usando Mapterhorn DEM (Terrarium)
// ==========================================

const SlopeLayerManager = {
    isEnabled: false,
    protocolRegistered: false,
    sourceId: "otromundo-slope-source",
    layerId: "otromundo-slope-layer",
    protocolName: "otromundo-slope",
    demUrlTemplate: "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp",
    tileCache: new Map(),
    maxCacheEntries: 120,
    settings: {
        opacity: 0.55,
        minAngle: 25,       // Umbral mínimo visible (25° o 30° modo avalanchas)
        scheme: "ates"      // "ates" (Montaña / Avalanchas) | "thermal" (Térmico continuo)
    },

    init() {
        this.loadSavedSettings();
        this.registerSlopeProtocol();
        this.injectUIControls();
        this.setupMapListeners();
    },

    loadSavedSettings() {
        try {
            const savedEnabled = localStorage.getItem("otromundo_slope_enabled");
            if (savedEnabled !== null) {
                this.isEnabled = savedEnabled === "true";
            }
            const savedSettings = localStorage.getItem("otromundo_slope_settings");
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (e) {
            console.warn("No se pudieron cargar las preferencias de pendientes:", e);
        }
    },

    saveSettings() {
        try {
            localStorage.setItem("otromundo_slope_settings", JSON.stringify(this.settings));
            localStorage.setItem("otromundo_slope_enabled", String(this.isEnabled));
        } catch (e) {}
    },

    // ==========================================
    // 1. PROTOCOLO CUSTOM MAPLIBRE PARA CÁLCULO DE PENDIENTES EN GRADOS
    // ==========================================
    registerSlopeProtocol() {
        if (this.protocolRegistered || typeof maplibregl === "undefined" || typeof maplibregl.addProtocol !== "function") {
            return;
        }
        this.protocolRegistered = true;

        maplibregl.addProtocol(this.protocolName, async (params, abortController) => {
            try {
                // Formato URL: otromundo-slope://{z}/{x}/{y}?min={minAngle}&scheme={scheme}
                const cleanUrl = params.url.replace(`${this.protocolName}://`, "");
                const [pathPart, queryPart] = cleanUrl.split("?");
                const [zStr, xStr, yStr] = pathPart.split("/");
                const z = parseInt(zStr, 10);
                const x = parseInt(xStr, 10);
                const y = parseInt(yStr, 10);

                const searchParams = new URLSearchParams(queryPart || "");
                const minAngle = parseFloat(searchParams.get("min") || this.settings.minAngle);
                const scheme = searchParams.get("scheme") || this.settings.scheme;

                const cacheKey = `${z}/${x}/${y}_${minAngle}_${scheme}`;
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

                // Resolución real en metros/píxel según latitud y zoom
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

                // Cálculo del gradiente de Horn (ventana 3x3)
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
                        if (slopeDeg < minAngle) {
                            outData[pxIdx + 3] = 0;
                            continue;
                        }

                        const color = this.getColorForSlope(slopeDeg, scheme);
                        outData[pxIdx] = color[0];
                        outData[pxIdx + 1] = color[1];
                        outData[pxIdx + 2] = color[2];
                        outData[pxIdx + 3] = color[3];
                    }
                }

                outCtx.putImageData(outImg, 0, 0);
                const outBlob = await new Promise(resolve => outCanvas.toBlob(resolve, "image/png"));
                const arrayBuffer = await outBlob.arrayBuffer();

                // Guardar en caché LRU ligera
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

    // Paletas cartográficas de pendiente (R, G, B, Alpha)
    getColorForSlope(deg, scheme) {
        if (scheme === "thermal") {
            if (deg < 30) return [0, 229, 255, 165];    // 25° - 30°: Cian suave
            if (deg < 35) return [0, 230, 118, 185];    // 30° - 35°: Verde esmeralda
            if (deg < 40) return [255, 234, 0, 200];    // 35° - 40°: Amarillo intenso
            if (deg < 45) return [255, 109, 0, 215];    // 40° - 45°: Naranja fuego
            return [255, 23, 68, 230];                  // > 45°: Rojo carmesí
        }

        // Paleta estándar Montaña / ATES / Avalanchas
        if (deg < 30) return [255, 234, 0, 175];        // 25° - 30°: Amarillo (Moderada)
        if (deg < 35) return [255, 145, 0, 195];        // 30° - 35°: Naranja (Fuerte / Aludes)
        if (deg < 45) return [255, 45, 45, 210];        // 35° - 45°: Rojo (Muy inclinada)
        return [181, 92, 255, 225];                     // > 45°: Violeta / Pared vertical
    },

    // ==========================================
    // 2. INYECTAR TARJETA + LEYENDA EN EL PANEL DE MAPAS BASE
    // ==========================================
    injectUIControls() {
        const mapsDrawerBody = document.querySelector("#side-panel-maps .side-drawer-body");
        if (!mapsDrawerBody || document.getElementById("otromundo-slope-card")) return;

        const card = document.createElement("div");
        card.id = "otromundo-slope-card";
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
                <div id="slope-toggle-row" style="display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer;">
                    <div style="background: rgba(0, 229, 255, 0.12); border-radius: 8px; padding: 7px; display: flex; align-items: center; justify-content: center;">
                        <img src="ui-icons/fi-rr-grow-graphs-box.svg" width="18" height="18" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg);" alt="Pendientes">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 0.88rem; font-weight: bold; color: #fff;">Mapa de Pendientes</span>
                        <span style="font-size: 0.72rem; color: #aaa;">Inclinación del terreno en grados (°)</span>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 10px;">
                    <button id="btn-toggle-slope-settings" type="button" title="Configurar capa de pendientes" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #00e5ff; border-radius: 8px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem; transition: transform 0.2s ease;">
                        ▾
                    </button>
                    <label class="switch" id="slope-switch-label" style="cursor: pointer;">
                        <input type="checkbox" id="toggle-slope-layer" ${this.isEnabled ? "checked" : ""}>
                        <span class="slider-round"></span>
                    </label>
                </div>
            </div>

            <!-- Desplegable de Configuración y Leyenda -->
            <div id="slope-settings-drawer" style="display: ${this.isEnabled ? "flex" : "none"}; flex-direction: column; gap: 11px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 11px; margin-top: 2px;">
                
                <!-- Leyenda visual rápida -->
                <div id="slope-legend-bar" style="display: flex; flex-direction: column; gap: 5px; background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.08); border-radius: 9px; padding: 7px 9px;">
                    ${this.buildLegendHTML()}
                </div>

                <!-- Filtro de ángulo mínimo -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 0.78rem; color: #ccc;">Mostrar desde:</span>
                    <select id="slope-min-angle-select" style="background: #121214; color: #00e5ff; border: 1px solid rgba(0,229,255,0.35); border-radius: 8px; padding: 5px 8px; font-size: 0.78rem; outline: none; cursor: pointer;">
                        <option value="20" ${this.settings.minAngle === 20 ? "selected" : ""}>20° (Todo relieve)</option>
                        <option value="25" ${this.settings.minAngle === 25 ? "selected" : ""}>25° (Montaña estándar)</option>
                        <option value="30" ${this.settings.minAngle === 30 ? "selected" : ""}>30° (Zona avalanchas)</option>
                        <option value="35" ${this.settings.minAngle === 35 ? "selected" : ""}>35° (Solo cortados / pared)</option>
                    </select>
                </div>

                <!-- Paleta de colores -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 0.78rem; color: #ccc;">Esquema de color:</span>
                    <select id="slope-scheme-select" style="background: #121214; color: #00e5ff; border: 1px solid rgba(0,229,255,0.35); border-radius: 8px; padding: 5px 8px; font-size: 0.78rem; outline: none; cursor: pointer;">
                        <option value="ates" ${this.settings.scheme === "ates" ? "selected" : ""}>Alpino / ATES (Amarillo-Violeta)</option>
                        <option value="thermal" ${this.settings.scheme === "thermal" ? "selected" : ""}>Térmico (Cian-Rojo)</option>
                    </select>
                </div>

                <!-- Opacidad -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 0.78rem; color: #ccc;">Opacidad:</span>
                    <input type="range" id="slope-opacity-slider" min="0.2" max="0.95" step="0.05" value="${this.settings.opacity}" style="flex: 1; accent-color: #00e5ff; cursor: pointer;">
                    <span id="slope-opacity-val" style="font-size: 0.76rem; color: #00e5ff; font-weight: bold; min-width: 34px; text-align: right;">${Math.round(this.settings.opacity * 100)}%</span>
                </div>

            </div>
        `;

        // Insertar justo debajo de la tarjeta de curvas de nivel si existe, o al final
        const contourCard = document.getElementById("otromundo-contour-card");
        if (contourCard && contourCard.parentElement === mapsDrawerBody) {
            contourCard.insertAdjacentElement("afterend", card);
        } else {
            mapsDrawerBody.appendChild(card);
        }

        const checkbox = document.getElementById("toggle-slope-layer");
        const toggleRow = document.getElementById("slope-toggle-row");
        const settingsBtn = document.getElementById("btn-toggle-slope-settings");
        const settingsDrawer = document.getElementById("slope-settings-drawer");
        const minAngleSelect = document.getElementById("slope-min-angle-select");
        const schemeSelect = document.getElementById("slope-scheme-select");
        const opacitySlider = document.getElementById("slope-opacity-slider");
        const opacityVal = document.getElementById("slope-opacity-val");
        const legendBar = document.getElementById("slope-legend-bar");

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
                this.applySlopeLayer();
                window.RoutePlanner?.showToast?.("Mapa de pendientes activado");
            } else {
                this.removeSlopeLayer();
                window.RoutePlanner?.showToast?.("Mapa de pendientes desactivado");
            }
        };

        toggleRow?.addEventListener("click", () => handleActivationChange(!this.isEnabled));
        checkbox?.addEventListener("change", (e) => {
            e.stopPropagation();
            handleActivationChange(e.target.checked);
        });

        minAngleSelect?.addEventListener("change", (e) => {
            this.settings.minAngle = parseFloat(e.target.value);
            this.saveSettings();
            if (legendBar) legendBar.innerHTML = this.buildLegendHTML();
            if (this.isEnabled) this.applySlopeLayer();
        });

        schemeSelect?.addEventListener("change", (e) => {
            this.settings.scheme = e.target.value;
            this.saveSettings();
            if (legendBar) legendBar.innerHTML = this.buildLegendHTML();
            if (this.isEnabled) this.applySlopeLayer();
        });

        opacitySlider?.addEventListener("input", (e) => {
            this.settings.opacity = parseFloat(e.target.value);
            if (opacityVal) opacityVal.innerText = `${Math.round(this.settings.opacity * 100)}%`;
            this.saveSettings();
            if (this.isEnabled) this.updateLayerOpacity();
        });
    },

    buildLegendHTML() {
        const items = this.settings.scheme === "thermal"
            ? [
                { color: "#00e5ff", label: "25-30°", min: 20 },
                { color: "#00e676", label: "30-35°", min: 30 },
                { color: "#ffea00", label: "35-40°", min: 35 },
                { color: "#ff6d00", label: "40-45°", min: 40 },
                { color: "#ff1744", label: "45°+", min: 45 }
              ]
            : [
                { color: "#ffea00", label: "25-30°", min: 20 },
                { color: "#ff9100", label: "30-35°", min: 30 },
                { color: "#ff2d2d", label: "35-45°", min: 35 },
                { color: "#b55cff", label: "45°+", min: 45 }
              ];

        const activeItems = items.filter(it => it.min >= this.settings.minAngle || it.label === "25-30°" && this.settings.minAngle <= 25);

        return `
            <div style="display: flex; align-items: center; gap: 4px; width: 100%;">
                ${activeItems.map(it => `
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;">
                        <div style="width: 100%; height: 7px; border-radius: 4px; background: ${it.color};"></div>
                        <span style="font-size: 0.65rem; color: #ddd; font-weight: bold;">${it.label}</span>
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

                this.registerSlopeProtocol();

                if (mapObj.isStyleLoaded() && this.isEnabled) {
                    this.applySlopeLayer();
                }

                mapObj.on("style.load", () => {
                    this.registerSlopeProtocol();
                    if (this.isEnabled) {
                        setTimeout(() => this.applySlopeLayer(), 200);
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

    applySlopeLayer() {
        const mapObj = window.map;
        if (!mapObj) return;

        this.removeSlopeLayer();

        const tileUrl = `${this.protocolName}://{z}/{x}/{y}?min=${this.settings.minAngle}&scheme=${this.settings.scheme}`;

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

    removeSlopeLayer() {
        const mapObj = window.map;
        if (!mapObj) return;
        try {
            if (mapObj.getLayer(this.layerId)) mapObj.removeLayer(this.layerId);
            if (mapObj.getSource(this.sourceId)) mapObj.removeSource(this.sourceId);
        } catch (e) {}
    }
};

window.SlopeLayerManager = SlopeLayerManager;
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => SlopeLayerManager.init());
} else {
    SlopeLayerManager.init();
}