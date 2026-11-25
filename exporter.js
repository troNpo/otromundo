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
                let val = input.value.trim();
                const baseName = val.includes('.') ? val.substring(0, val.lastIndexOf('.')) : val;
                input.value = `${baseName}.${e.target.value}`;
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