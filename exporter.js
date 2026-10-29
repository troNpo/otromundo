// ==========================================
// EXPORTER.JS - Gestor Avanzado de Exportación (KML jerárquico / GPX compatible con OruxMaps)
// ==========================================

const RouteExporter = {
    init() {
        this.setupEvents();
    },

    setupEvents() {
        // Sincronizar extensión al cambiar radio KML / GPX
        document.querySelectorAll('input[name="export-format"]').forEach(radio => {
            radio.addEventListener("change", (e) => {
                const input = document.getElementById("export-filename-input");
                if (!input) return;
                let val = input.value.trim();
                const baseName = val.includes('.') ? val.substring(0, val.lastIndexOf('.')) : val;
                input.value = `${baseName}.${e.target.value}`;
            });
        });

        // Botón principal de descarga
        const btnDownload = document.getElementById("opt-btn-download-file");
        if (btnDownload) {
            btnDownload.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.executeExport();
            });
        }

        // Rotar flecha del acordeón al abrir/cerrar
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

        // Cerrar panel lateral tras descargar
        document.getElementById("side-panel-planner-options")?.classList.remove("active");
    },

    downloadKmlHierarchical(filename, planner) {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        kml += `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">\n`;
        kml += `<Document>\n`;
        kml += `  <name><![CDATA[${filename.replace('.kml', '')}]]></name>\n`;

        // Carpeta Principal: Ruta y Waypoints
        kml += `  <Folder>\n`;
        kml += `    <name><![CDATA[Ruta y Waypoints]]></name>\n`;

        planner.points.forEach((p, idx) => {
            kml += `    <Placemark>\n`;
            kml += `      <name><![CDATA[${p.name || ('Punto ' + (idx + 1))}]]></name>\n`;
            kml += `      <description><![CDATA[Waypoint #${idx + 1}]]></description>\n`;
            kml += `      <Point>\n`;
            kml += `        <coordinates>${p.coords[0]},${p.coords[1]},0</coordinates>\n`;
            kml += `      </Point>\n`;
            kml += `    </Placemark>\n`;
        });

        if (planner.currentRouteData && planner.currentRouteData.coordinates) {
            kml += `    <Placemark>\n`;
            kml += `      <name><![CDATA[Traza de Ruta]]></name>\n`;
            kml += `      <LineString>\n`;
            kml += `        <tessellate>1</tessellate>\n`;
            kml += `        <coordinates>\n`;
            kml += `          `;
            kml += planner.currentRouteData.coordinates.map(c => `${c[0]},${c[1]},${c[2] || 0}`).join(" ");
            kml += `\n        </coordinates>\n`;
            kml += `      </LineString>\n`;
            kml += `    </Placemark>\n`;
        }
        kml += `  </Folder>\n`;

        kml += `</Document>\n`;
        kml += `</kml>`;

        this.triggerBlobDownload(kml, filename, 'application/vnd.google-earth.kml+xml');
    },

    downloadGpx(filename, planner) {
        let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        gpx += `<gpx version="1.1" creator="Otromundo - PWA" xmlns="http://www.topografix.com/GPX/1/1">\n`;
        gpx += `  <metadata>\n`;
        gpx += `    <name><![CDATA[${filename.replace('.gpx', '')}]]></name>\n`;
        gpx += `    <time>${new Date().toISOString()}</time>\n`;
        gpx += `  </metadata>\n`;

        // Waypoints (puntos de ruta)
        planner.points.forEach((p, idx) => {
            gpx += `  <wpt lat="${p.coords[1]}" lon="${p.coords[0]}">\n`;
            if (p.coords[2] !== undefined) {
                gpx += `    <ele>${p.coords[2]}</ele>\n`;
            }
            gpx += `    <name><![CDATA[${p.name || ('Punto ' + (idx + 1))}]]></name>\n`;
            gpx += `  </wpt>\n`;
        });

        // Track (traza de la ruta)
        if (planner.currentRouteData && planner.currentRouteData.coordinates) {
            gpx += `  <trk>\n`;
            gpx += `    <name><![CDATA[Ruta Otromundo]]></name>\n`;
            gpx += `    <trkseg>\n`;
            planner.currentRouteData.coordinates.forEach(c => {
                gpx += `      <trkpt lat="${c[1]}" lon="${c[0]}">\n`;
                if (c[2] !== undefined) {
                    gpx += `        <ele>${c[2]}</ele>\n`;
                }
                gpx += `      </trkpt>\n`;
            });
            gpx += `    </trkseg>\n`;
            gpx += `  </trk>\n`;
        }

        gpx += `</gpx>`;

        this.triggerBlobDownload(gpx, filename, 'application/gpx+xml');
    },

    triggerBlobDownload(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    RouteExporter.init();
});
