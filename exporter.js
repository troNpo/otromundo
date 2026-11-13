// ==========================================
// EXPORTER.JS - Gestor Avanzado de Exportación (KML jerárquico y GPX compatible con tramos mixtos)
// ==========================================

const RouteExporter = {
    init() {
        this.setupEvents();
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
                this.executeExport();
            });
        }

        const detailsEl = document.getElementById("export-accordion");
        detailsEl?.addEventListener("toggle", () => {
            const arrow = document.getElementById("export-accordion-arrow");
            if (arrow) {
                arrow.style.transform = detailsEl.open ? "rotate(180deg)" : "rotate(0deg)";
            }
        });
    },

    executeExport() {
        const planner = window.RoutePlanner || (typeof RoutePlanner !== 'undefined' ? RoutePlanner : null);

        if (!planner || (planner.points.length === 0 && !planner.currentRouteData)) {
            alert("⚠️ No hay ruta ni puntos para exportar");
            return;
        }

        let format = 'kml';
        document.querySelectorAll('input[name="export-format"]').forEach(r => {
            if (r.checked) format = r.value;
        });

        const inputNombre = document.getElementById("export-filename-input");
        let filename = inputNombre && inputNombre.value.trim() ? inputNombre.value.trim() : `otromundo_ruta.${format}`;
        if (!filename.endsWith(`.${format}`)) filename += `.${format}`;

        if (format === 'kml') {
            this.downloadKmlHierarchical(filename, planner);
        } else {
            this.downloadGpx(filename, planner);
        }

        document.getElementById("side-panel-planner-options")?.classList.remove("active");
    },

    hexToKmlColor(hex) {
        if (!hex || !hex.startsWith('#') || hex.length < 7) return 'ff00e5ff';
        const r = hex.substring(1, 3);
        const g = hex.substring(3, 5);
        const b = hex.substring(5, 7);
        return `ff${b}${g}${r}`;
    },

    downloadKmlHierarchical(filename, planner) {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        kml += `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:om="http://www.oruxmaps.com/oruxmapsextensions/1/0" xmlns:gx="http://www.google.com/kml/ext/2.2">\n`;
        kml += `<Document>\n`;
        kml += `  <name><![CDATA[${filename.replace('.kml', '')}]]></name>\n`;

        // Carpeta 1: Waypoints
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

        // Carpeta 2: Traza mixta desglosada por Segmentos
        if (planner.segments && planner.segments.length > 0 && planner.points.length >= 2) {
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
                const kmlColor = this.hexToKmlColor(seg.color || '#00e5ff');

                kml += `    <Style id="${styleId}">\n`;
                kml += `      <LineStyle>\n`;
                kml += `        <color>${kmlColor}</color>\n`;
                kml += `        <width>4</width>\n`;
                kml += `      </LineStyle>\n`;
                kml += `    </Style>\n`;

                kml += `    <Placemark>\n`;
                kml += `      <name><![CDATA[${segName}]]></name>\n`;
                kml += `      <styleUrl>#${styleId}</styleUrl>\n`;
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

        this.triggerBlobDownload(kml, filename, 'application/vnd.google-earth.kml+xml');
    },

    downloadGpx(filename, planner) {
        let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        gpx += `<gpx version="1.1" creator="Otromundo - PWA" xmlns="http://www.topografix.com/GPX/1/1" xmlns:om="http://www.oruxmaps.com/oruxmapsextensions/1/0">\n`;
        gpx += `  <metadata>\n`;
        gpx += `    <name><![CDATA[${filename.replace('.gpx', '')}]]></name>\n`;
        gpx += `    <time>${new Date().toISOString()}</time>\n`;
        gpx += `  </metadata>\n`;

        // Waypoints
        if (planner.points && planner.points.length > 0) {
            planner.points.forEach((p, idx) => {
                gpx += `  <wpt lat="${p.coords[1]}" lon="${p.coords[0]}">\n`;
                if (p.coords[2] !== undefined) gpx += `    <ele>${p.coords[2]}</ele>\n`;
                gpx += `    <name><![CDATA[${p.name || ('Punto ' + (idx + 1))}]]></name>\n`;
                gpx += `  </wpt>\n`;
            });
        }

        // Track unificado combinando todos los segmentos (BRouter y manuales)
        if (planner.segments && planner.segments.length > 0 && planner.points.length >= 2) {
            gpx += `  <trk>\n`;
            gpx += `    <name><![CDATA[Ruta Mixta Otromundo]]></name>\n`;
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
                    if (sIdx > 0 && cIdx === 0) return; // Evitar duplicar vértices en uniones

                    gpx += `      <trkpt lat="${c[1]}" lon="${c[0]}">\n`;
                    if (c[2] !== undefined) gpx += `        <ele>${c[2]}</ele>\n`;
                    gpx += `      </trkpt>\n`;
                });
            });

            gpx += `    </trkseg>\n`;
            gpx += `  </trk>\n`;
        }

        gpx += `</gpx>`;
        this.triggerBlobDownload(gpx, filename, 'text/xml');
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

document.addEventListener("DOMContentLoaded", () => {
    RouteExporter.init();
});
