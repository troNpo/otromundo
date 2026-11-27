// ==========================================
// EXPORTER.JS - Gestor Avanzado de Exportación (KML jerárquico con estilos dasharray, GPX mixto y orux-track://)
// ==========================================

const RouteExporter = {
    init() {
        this.injectOruxOpenButton();
        this.setupEvents();
    },

    isMobileOrTablet() {
        const ua = (navigator.userAgent || navigator.vendor || window.opera || "").toLowerCase();
        const platform = (navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();

        const isAndroid = /android/.test(ua) || /android/.test(platform) || (/linux/.test(platform) && navigator.maxTouchPoints > 0);
        const isIOS = /iphone|ipad|ipod/.test(ua) || /iphone|ipad|ipod/.test(platform) || (platform === 'macintel' && navigator.maxTouchPoints > 1);
        const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

        return isAndroid || isIOS || isCoarsePointer;
    },

    canShareFiles(fileObj) {
        return typeof navigator.share === "function" &&
            typeof navigator.canShare === "function" &&
            navigator.canShare({ files: [fileObj] });
    },

    showExportNotice(message, isError = false) {
        document.getElementById("exporter-floating-toast")?.remove();

        const toast = document.createElement("div");
        toast.id = "exporter-floating-toast";
        toast.style.cssText = `
            position: fixed;
            top: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(18, 18, 20, 0.96);
            color: ${isError ? '#ff5252' : '#00e5ff'};
            border: 1.5px solid ${isError ? '#ff5252' : '#00e5ff'};
            border-radius: 12px;
            padding: 10px 18px;
            font-family: sans-serif;
            font-size: 0.85rem;
            font-weight: bold;
            z-index: 60000;
            box-shadow: 0 8px 24px rgba(0,0,0,0.75);
            text-align: center;
            max-width: 88vw;
            pointer-events: none;
        `;
        toast.innerText = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3200);
    },

    injectOruxOpenButton() {
        const btnDownload = document.getElementById("opt-btn-download-file");
        if (!btnDownload || document.getElementById("opt-btn-open-orux")) return;

        const parent = btnDownload.parentElement;
        if (!parent) return;

        const rowWrapper = document.createElement("div");
        rowWrapper.style.cssText = `
            display: flex;
            align-items: stretch;
            gap: 8px;
            width: 100%;
        `;

        parent.insertBefore(rowWrapper, btnDownload);

        btnDownload.style.flex = "1";
        btnDownload.style.minWidth = "0";
        rowWrapper.appendChild(btnDownload);

        const btnOrux = document.createElement("button");
        btnOrux.id = "opt-btn-open-orux";
        btnOrux.type = "button";
        btnOrux.title = this.isMobileOrTablet()
            ? "Compartir archivo de ruta (OruxMaps, mensajería, Archivos...)"
            : "Compartir archivo de ruta (si el navegador lo admite) o descargar";
        btnOrux.style.cssText = `
            flex: 1.2;
            min-width: 0;
            background: rgba(0, 229, 255, 0.14);
            color: #00e5ff;
            border: 1.5px solid #00e5ff;
            border-radius: 10px;
            padding: 10px 8px;
            font-weight: bold;
            font-size: 0.82rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            box-shadow: 0 4px 12px rgba(0, 229, 255, 0.18);
        `;

        btnOrux.innerHTML = `
            <img src="ui-icons/fi-rr-share.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg); object-fit: contain; flex-shrink: 0;" alt="Compartir">
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Compartir</span>
        `;

        rowWrapper.appendChild(btnOrux);
    },

    setupEvents() {
        document.querySelectorAll('input[name="export-format"]').forEach(radio => {
            radio.addEventListener("change", (e) => {
                const input = document.getElementById("export-filename-input");
                if (!input) return;
                const val = input.value.trim();
                const baseName = val.includes('.') ? val.substring(0, val.lastIndexOf('.')) : val;
                input.value = `${baseName || 'otromundo_ruta'}.${e.target.value}`;
            });
        });

        const btnDownload = document.getElementById("opt-btn-download-file");
        if (btnDownload) {
            btnDownload.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.executeExport(false);
            });
        }

        const btnOpenOrux = document.getElementById("opt-btn-open-orux");
        if (btnOpenOrux) {
            btnOpenOrux.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.executeExport(true);
            });
        }
    },

    getExportParams() {
        const planner = window.RoutePlanner || (typeof RoutePlanner !== 'undefined' ? RoutePlanner : null);
        const poiMgr = window.PoiManager || (typeof PoiManager !== 'undefined' ? PoiManager : null);

        const hasRouteOrPoints = planner && ((planner.points && planner.points.length > 0) || planner.currentRouteData);
        const hasPois = poiMgr && Array.isArray(poiMgr.pois) && poiMgr.pois.length > 0;

        if (!hasRouteOrPoints && !hasPois) {
            this.showExportNotice("⚠️ No hay ruta, puntos ni POIs para exportar", true);
            return null;
        }

        let format = 'kml';
        document.querySelectorAll('input[name="export-format"]').forEach(r => {
            if (r.checked) format = r.value;
        });

        const inputNombre = document.getElementById("export-filename-input");
        let filename = inputNombre && inputNombre.value.trim() ? inputNombre.value.trim() : `otromundo_ruta.${format}`;
        if (!filename.endsWith(`.${format}`)) filename += `.${format}`;

        return { planner: planner || {}, format, filename };
    },

    async executeExport(openInOrux = false) {
        const params = this.getExportParams();
        if (!params) return;

        const { planner, format, filename } = params;

        const content = format === 'kml'
            ? this.buildKmlHierarchical(filename, planner)
            : this.buildGpx(filename, planner);
        const mimeType = format === 'kml'
            ? 'application/vnd.google-earth.kml+xml'
            : 'application/gpx+xml';

        if (!openInOrux) {
            this.triggerBlobDownload(content, filename, mimeType);
            document.getElementById("side-panel-planner-options")?.classList.remove("active");
            this.showExportNotice(`Archivo ${filename} descargado`);
            return;
        }

        await this.shareTrackFile(content, filename, mimeType);
    },

    async shareTrackFile(content, filename, mimeType) {
        const btnShare = document.getElementById("opt-btn-open-orux");
        const originalHTML = btnShare ? btnShare.innerHTML : "";

        if (btnShare) {
            btnShare.disabled = true;
            btnShare.innerHTML = `<span>Preparando...</span>`;
        }

        try {
            const fileObj = new File([content], filename, { type: mimeType });
            if (this.canShareFiles(fileObj)) {
                document.getElementById("side-panel-planner-options")?.classList.remove("active");
                await navigator.share({
                    files: [fileObj],
                    title: filename
                });
                return;
            }
        } catch (err) {
            if (err && err.name === "AbortError") {
                return;
            }
            console.warn("No se pudo abrir la hoja de compartir nativa:", err);
        } finally {
            if (btnShare) {
                btnShare.disabled = false;
                btnShare.innerHTML = originalHTML;
            }
        }

        this.showExportNotice(`Descargando ${filename}...`);
        document.getElementById("side-panel-planner-options")?.classList.remove("active");
        this.triggerBlobDownload(content, filename, mimeType);
    },

    includeTurnIndicators() {
        const toggle = document.getElementById("toggle-export-turn-indicators");
        return toggle ? Boolean(toggle.checked) : true;
    },

    getTurnCommandInfo(cmdCode) {
        const code = parseInt(cmdCode, 10);
        const map = {
            1: { text: "Continuar recto", sym: "Straight", iconId: 1009 },
            2: { text: "Giro suave a la izquierda", sym: "Slight Left", iconId: 1011 },
            3: { text: "Giro a la izquierda", sym: "Left", iconId: 1010 },
            4: { text: "Giro cerrado a la izquierda", sym: "Sharp Left", iconId: 1012 },
            5: { text: "Media vuelta", sym: "U-turn", iconId: 1016 },
            6: { text: "Giro cerrado a la derecha", sym: "Sharp Right", iconId: 1002 },
            7: { text: "Giro a la derecha", sym: "Right", iconId: 1000 },
            8: { text: "Giro suave a la derecha", sym: "Slight Right", iconId: 1001 },
            9: { text: "Rotonda: 1.ª salida", sym: "Roundabout", iconId: 1020 },
            10: { text: "Rotonda: 2.ª salida", sym: "Roundabout", iconId: 1020 },
            11: { text: "Rotonda: 3.ª salida", sym: "Roundabout", iconId: 1020 },
            12: { text: "Rotonda: 4.ª salida", sym: "Roundabout", iconId: 1020 },
            13: { text: "Rotonda: 5.ª salida", sym: "Roundabout", iconId: 1020 },
            14: { text: "Rotonda: 6.ª salida", sym: "Roundabout", iconId: 1020 },
            15: { text: "Rotonda: 7.ª salida", sym: "Roundabout", iconId: 1020 }
        };
        return map[code] || { text: "Indicacion de giro", sym: "Waypoint", iconId: 1009 };
    },

    getTurnIconUrl(cmdOrKey) {
        const baseUrl = "https://tronpo.github.io/otromundo/turn-icons";
        const key = String(cmdOrKey ?? "").trim().toLowerCase();

        const map = {
            "1": "continue.svg",
            "2": "turn_slight_left.svg",
            "3": "turn_left.svg",
            "4": "turn_sharp_left.svg",
            "5": "uturn.svg",
            "6": "turn_sharp_right.svg",
            "7": "turn_right.svg",
            "8": "turn_slight_right.svg",
            "9": "roundabout_slight_right1.svg",
            "10": "roundabout_slight_right2.svg",
            "11": "roundabout_slight_right3.svg",
            "12": "roundabout_slight_right4.svg",
            "13": "roundabout_slight_right5.svg",
            "14": "roundabout_slight_right5.svg",
            "15": "roundabout_slight_right5.svg",

            "arrive": "arrive.svg",
            "close": "close.svg",
            "continue": "continue.svg",
            "fork": "fork.svg",
            "fork_slight_left": "fork_slight_left.svg",
            "fork_slight_right": "fork_slight_right.svg",
            "fork_straight": "fork_straight.svg",
            "off_ramp_left": "off_ramp_left.svg",
            "off_ramp_right": "off_ramp_right.svg",
            "roundabout_slight_right1": "roundabout_slight_right1.svg",
            "roundabout_slight_right2": "roundabout_slight_right2.svg",
            "roundabout_slight_right3": "roundabout_slight_right3.svg",
            "roundabout_slight_right4": "roundabout_slight_right4.svg",
            "roundabout_slight_right5": "roundabout_slight_right5.svg",
            "start": "start.svg",
            "straight_left": "straight_left.svg",
            "straight_right": "straight_right.svg",
            "turn_left": "turn_left.svg",
            "turn_right": "turn_right.svg",
            "turn_sharp_left": "turn_sharp_left.svg",
            "turn_sharp_right": "turn_sharp_right.svg",
            "turn_slight_left": "turn_slight_left.svg",
            "turn_slight_right": "turn_slight_right.svg",
            "uturn": "uturn.svg"
        };

        return `${baseUrl}/${map[key] || "continue.svg"}`;
    },

    getHintsFromSource(src) {
        if (!src || typeof src !== "object") return [];
        const raw = src.voiceHints || src.voice_hints || src.turnHints || src.instructions;
        return Array.isArray(raw) ? raw : [];
    },

    mapSegmentHintIndex(localIdx, segIdx, segCoordsLength, combinedLengthSoFar) {
        const parsedLocal = parseInt(localIdx, 10);
        if (Number.isNaN(parsedLocal) || parsedLocal < 0) return 0;

        if (segIdx === 0) {
            return parsedLocal;
        }

        // En segmentos posteriores (segIdx > 0), el punto 0 coincide con el último punto ya agregado
        // del tramo anterior (índice combinedLengthSoFar - 1).
        const junctionIdx = Math.max(0, combinedLengthSoFar - 1);
        if (parsedLocal === 0) {
            return junctionIdx;
        }

        const clampedLocal = Math.min(parsedLocal, Math.max(0, segCoordsLength - 1));
        return junctionIdx + clampedLocal;
    },

    extractRouteTurnHints(planner) {
        const activeRoute = Array.isArray(planner.routesList)
            ? planner.routesList[planner.currentRouteIndex || 0]
            : null;
        const coords = planner.currentRouteData?.coordinates || activeRoute?.coordinates || [];
        let hints = this.getHintsFromSource(planner.currentRouteData);
        if (hints.length === 0) hints = this.getHintsFromSource(activeRoute);

        if ((!Array.isArray(hints) || hints.length === 0) && Array.isArray(planner.segments)) {
            const combined = [];
            let combinedLengthSoFar = 0;

            planner.segments.forEach((seg, idx) => {
                const segCoords = Array.isArray(seg.coordinates) ? seg.coordinates : [];
                const segHints = this.getHintsFromSource(seg);

                if (segHints.length > 0) {
                    segHints.forEach(h => {
                        if (!Array.isArray(h) || h.length < 2) return;
                        const adjIdx = this.mapSegmentHintIndex(h[0], idx, segCoords.length, combinedLengthSoFar);
                        combined.push([adjIdx, h[1], ...(h.slice(2))]);
                    });
                }

                if (segCoords.length > 0) {
                    combinedLengthSoFar = idx === 0
                        ? segCoords.length
                        : combinedLengthSoFar + Math.max(0, segCoords.length - 1);
                }
            });
            hints = combined;
        }

        if (!Array.isArray(hints) || hints.length === 0 || !Array.isArray(coords) || coords.length === 0) {
            return [];
        }

        return hints
            .map((h) => {
                if (!Array.isArray(h) || h.length < 2) return null;
                const rawIdx = parseInt(h[0], 10);
                if (Number.isNaN(rawIdx)) return null;

                const coordIdx = Math.max(0, Math.min(coords.length - 1, rawIdx));
                const pt = coords[coordIdx];
                if (!pt || pt[0] === undefined || pt[1] === undefined) return null;

                const cmd = parseInt(h[1], 10);
                if (Number.isNaN(cmd)) return null;

                const info = this.getTurnCommandInfo(cmd);
                const distToNext = h[2] !== undefined && !isNaN(parseFloat(h[2])) ? Math.round(parseFloat(h[2])) : null;
                const desc = distToNext !== null && distToNext > 0
                    ? `${info.text} (${distToNext} m)`
                    : info.text;

                return {
                    coordIdx,
                    lon: pt[0],
                    lat: pt[1],
                    ele: pt[2],
                    cmd,
                    name: info.text,
                    desc,
                    sym: info.sym,
                    iconId: info.iconId
                };
            })
            .filter(Boolean);
    },

    hexToKmlColor(hex) {
        if (!hex || !hex.startsWith('#') || hex.length < 7) return 'ff00e5ff';
        const r = hex.substring(1, 3);
        const g = hex.substring(3, 5);
        const b = hex.substring(5, 7);
        return `ff${b}${g}${r}`;
    },

    buildKmlHierarchical(filename, planner) {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        kml += `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:om="http://www.oruxmaps.com/oruxmapsextensions/1/0" xmlns:gx="http://www.google.com/kml/ext/2.2">\n`;
        kml += `<Document>\n`;
        kml += `  <name><![CDATA[${filename.replace('.kml', '')}]]></name>\n`;

        // Definición de Estilos KML de los tramos de ruta
        if (planner.segments && planner.segments.length > 0) {
            planner.segments.forEach((seg, sIdx) => {
                const isManual = seg.profile === "manual-straight";
                const styleId = `seg_style_${sIdx}`;
                const kmlColor = this.hexToKmlColor(seg.color || '#00e5ff');

                kml += `  <Style id="${styleId}">\n`;
                kml += `    <LineStyle>\n`;
                kml += `      <color>${kmlColor}</color>\n`;
                kml += `      <width>${isManual ? 3.5 : 4}</width>\n`;
                kml += `    </LineStyle>\n`;
                kml += `  </Style>\n`;
            });
        }

        // Extraer indicadores de giro una sola vez si el ajuste está activado
        const turnHints = this.includeTurnIndicators() ? this.extractRouteTurnHints(planner) : [];
        const definedTurnStyleCmds = new Set();

        if (turnHints.length > 0) {
            const uniqueCmds = [...new Set(turnHints.map(t => t.cmd))];
            uniqueCmds.forEach((cmd) => {
                definedTurnStyleCmds.add(cmd);
                kml += `  <Style id="turn_cmd_${cmd}">\n`;
                kml += `    <IconStyle>\n`;
                kml += `      <scale>0.9</scale>\n`;
                kml += `      <Icon>\n`;
                kml += `        <href>${this.getTurnIconUrl(cmd)}</href>\n`;
                kml += `      </Icon>\n`;
                kml += `    </IconStyle>\n`;
                kml += `  </Style>\n`;
            });
        }

        // Carpeta 1: Waypoints de Ruta
        if (planner.points && planner.points.length > 0) {
            kml += `  <Folder>\n`;
            kml += `    <name><![CDATA[Waypoints de Ruta]]></name>\n`;
            planner.points.forEach((p, idx) => {
                const puntoName = p.name || (`Punto ${idx + 1}`);
                kml += `    <Placemark>\n`;
                kml += `      <name><![CDATA[${puntoName}]]></name>\n`;
                kml += `      <Point>\n`;
                kml += `        <coordinates>${p.coords[0]},${p.coords[1]},${p.coords[2] || 0}</coordinates>\n`;
                kml += `      </Point>\n`;
                kml += `    </Placemark>\n`;
            });
            kml += `  </Folder>\n`;
        }

        // Carpeta de Indicadores de Dirección (BRouter)
        if (turnHints.length > 0) {
            kml += `  <Folder>\n`;
            kml += `    <name><![CDATA[Indicadores de Dirección]]></name>\n`;
            turnHints.forEach((turn) => {
                const styleTag = definedTurnStyleCmds.has(turn.cmd)
                    ? `      <styleUrl>#turn_cmd_${turn.cmd}</styleUrl>\n`
                    : ``;
                kml += `    <Placemark>\n`;
                kml += `      <name><![CDATA[${turn.name}]]></name>\n`;
                kml += `      <description><![CDATA[${turn.desc}]]></description>\n`;
                kml += styleTag;
                kml += `      <ExtendedData>\n`;
                kml += `        <Data name="ICON"><value>${turn.iconId}</value></Data>\n`;
                kml += `        <Data name="ICON_SUBTYPE"><value>0</value></Data>\n`;
                kml += `      </ExtendedData>\n`;
                kml += `      <Point>\n`;
                kml += `        <coordinates>${turn.lon},${turn.lat},${turn.ele || 0}</coordinates>\n`;
                kml += `      </Point>\n`;
                kml += `    </Placemark>\n`;
            });
            kml += `  </Folder>\n`;
        }

        // Carpeta 2: Traza desglosada por Segmentos
        if (planner.segments && planner.segments.length > 0 && planner.points && planner.points.length >= 2) {
            kml += `  <Folder>\n`;
            kml += `    <name><![CDATA[Traza de Ruta (Mixta)]]></name>\n`;

            planner.segments.forEach((seg, sIdx) => {
                const pStart = planner.points[sIdx]?.coords;
                const pEnd = planner.points[sIdx + 1]?.coords;
                if (!pStart || !pEnd) return;

                const isManual = seg.profile === "manual-straight";
                const subCoords = isManual
                    ? [pStart, pEnd]
                    : (seg.coordinates && seg.coordinates.length >= 2 ? seg.coordinates : [pStart, pEnd]);

                const segName = seg.name || `Tramo ${sIdx + 1} (${isManual ? 'Punto a punto' : 'BRouter'})`;
                const styleId = `seg_style_${sIdx}`;

                kml += `    <Placemark>\n`;
                kml += `      <name><![CDATA[${segName}]]></name>\n`;
                kml += `      <styleUrl>#${styleId}</styleUrl>\n`;
                if (isManual) {
                    kml += `      <ExtendedData>\n`;
                    kml += `        <Data name="dasharray"><value>3,3</value></Data>\n`;
                    kml += `      </ExtendedData>\n`;
                }
                kml += `      <LineString>\n`;
                kml += `        <tessellate>1</tessellate>\n`;
                kml += `        <coordinates>\n`;
                kml += `          `;
                kml += subCoords.map(c => `${c[0]},${c[1]},${c[2] || 0}`).join(" ");
                kml += `\n        </coordinates>\n`;
                kml += `      </LineString>\n`;
                kml += `    </Placemark>\n`;
            });

            kml += `  </Folder>\n`;
        }

        kml += `</Document>\n`;
        kml += `</kml>`;
        return kml;
    },

    buildGpx(filename, planner) {
        let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        gpx += `<gpx version="1.1" creator="Otromundo - PWA" xmlns="http://www.topografix.com/GPX/1/1" xmlns:om="http://www.oruxmaps.com/oruxmapsextensions/1/0">\n`;
        gpx += `  <metadata>\n`;
        gpx += `    <name><![CDATA[${filename.replace('.gpx', '')}]]></name>\n`;
        gpx += `    <time>${new Date().toISOString()}</time>\n`;
        gpx += `  </metadata>\n`;

        if (planner.points && planner.points.length > 0) {
            planner.points.forEach((p, idx) => {
                gpx += `  <wpt lat="${p.coords[1]}" lon="${p.coords[0]}">\n`;
                if (p.coords[2] !== undefined) gpx += `    <ele>${p.coords[2]}</ele>\n`;
                gpx += `    <name><![CDATA[${p.name || ('Punto ' + (idx + 1))}]]></name>\n`;
                gpx += `  </wpt>\n`;
            });
        }

        if (this.includeTurnIndicators()) {
            const turnHints = this.extractRouteTurnHints(planner);
            turnHints.forEach((turn) => {
                gpx += `  <wpt lat="${turn.lat}" lon="${turn.lon}">\n`;
                if (turn.ele !== undefined) gpx += `    <ele>${turn.ele}</ele>\n`;
                gpx += `    <name><![CDATA[${turn.name}]]></name>\n`;
                gpx += `    <desc><![CDATA[${turn.desc}]]></desc>\n`;
                gpx += `    <extensions>\n`;
                gpx += `      <om:oruxmapsextensions xmlns:om="http://www.oruxmaps.com/oruxmapsextensions/1/0">\n`;
                gpx += `        <om:ext type="ICON" subtype="0">${turn.iconId}</om:ext>\n`;
                gpx += `      </om:oruxmapsextensions>\n`;
                gpx += `    </extensions>\n`;
                gpx += `  </wpt>\n`;
            });
        }

        if (planner.segments && planner.segments.length > 0 && planner.points && planner.points.length >= 2) {
            gpx += `  <trk>\n`;
            gpx += `    <name><![CDATA[${filename.replace('.gpx', '')}]]></name>\n`;
            gpx += `    <trkseg>\n`;

            planner.segments.forEach((seg, sIdx) => {
                const pStart = planner.points[sIdx]?.coords;
                const pEnd = planner.points[sIdx + 1]?.coords;
                if (!pStart || !pEnd) return;

                const isManual = seg.profile === "manual-straight";
                const subCoords = isManual
                    ? [pStart, pEnd]
                    : (seg.coordinates && seg.coordinates.length >= 2 ? seg.coordinates : [pStart, pEnd]);

                subCoords.forEach((c, cIdx) => {
                    if (sIdx > 0 && cIdx === 0) return;

                    gpx += `      <trkpt lat="${c[1]}" lon="${c[0]}">\n`;
                    if (c[2] !== undefined) gpx += `        <ele>${c[2]}</ele>\n`;
                    gpx += `      </trkpt>\n`;
                });
            });

            gpx += `    </trkseg>\n`;
            gpx += `  </trk>\n`;
        }

        gpx += `</gpx>`;
        return gpx;
    },

    triggerBlobDownload(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
};

window.RouteExporter = RouteExporter;
document.addEventListener("DOMContentLoaded", () => {
    RouteExporter.init();
});
