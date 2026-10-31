// ==========================================
// EXPORTER.JS - Gestor Avanzado de Exportación (KML jerárquico y GPX compatible iOS/Android)
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
        kml += `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:om="http://www.oruxmaps.com/oruxmapsextensions/1/0" xmlns:gx="http://www.google.com/kml/ext/2.2">\n`;
        kml += `<Document>\n`;
        kml += `  <name><![CDATA[${filename.replace('.kml', '')}]]></name>\n`;

        // Carpeta 1: Waypoints de la ruta (Solo si existen para evitar nodos vacíos en iOS)
        if (planner.points && planner.points.length > 0) {
            kml += `  <Folder>\n`;
            kml += `    <name><![CDATA[Waypoints de Ruta]]></name>\n`;
            planner.points.forEach((p, idx) => {
                const puntoName = p.name || (`Punto ${idx + 1}`);

                let descHtml = `Waypoint #${idx + 1}<br/>\nname: ${puntoName}`;
                if (p.coords[2] !== undefined) {
                    descHtml += `<br/>\nelevación: ${Math.round(p.coords[2])} m`;
                }
                if (p.extraInfo) {
                    Object.keys(p.extraInfo).forEach(key => {
                        descHtml += `<br/>\n${key}: ${p.extraInfo[key]}`;
                    });
                } else if (p.description) {
                    descHtml += `<br/>\n${p.description}`;
                }

                kml += `    <Placemark>\n`;
                kml += `      <name><![CDATA[${puntoName}]]></name>\n`;
                kml += `      <description><![CDATA[${descHtml}\n]]></description>\n`;
                kml += `      <Point>\n`;
                kml += `        <coordinates>${p.coords[0]},${p.coords[1]},${p.coords[2] || 0}</coordinates>\n`;
                kml += `      </Point>\n`;
                kml += `    </Placemark>\n`;
            });
            kml += `  </Folder>\n`;
        }

        // Carpeta 2: Traza de la Ruta (Solo si hay coordenadas válidas)
        if (planner.currentRouteData && planner.currentRouteData.coordinates && planner.currentRouteData.coordinates.length > 0) {
            kml += `  <Folder>\n`;
            kml += `    <name><![CDATA[Traza de Ruta]]></name>\n`;
            kml += `    <Placemark>\n`;
            kml += `      <name><![CDATA[Ruta Activa]]></name>\n`;
            kml += `      <LineString>\n`;
            kml += `        <tessellate>1</tessellate>\n`;
            kml += `        <coordinates>\n`;
            kml += `          `;
            kml += planner.currentRouteData.coordinates.map(c => `${c[0]},${c[1]},${c[2] || 0}`).join(" ");
            kml += `\n        </coordinates>\n`;
            kml += `      </LineString>\n`;
            kml += `    </Placemark>\n`;
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

        // Waypoints (puntos de ruta)
        if (planner.points && planner.points.length > 0) {
            planner.points.forEach((p, idx) => {
                gpx += `  <wpt lat="${p.coords[1]}" lon="${p.coords[0]}">\n`;
                if (p.coords[2] !== undefined) {
                    gpx += `    <ele>${p.coords[2]}</ele>\n`;
                }
                gpx += `    <name><![CDATA[${p.name || ('Punto ' + (idx + 1))}]]></name>\n`;
                if (p.description) {
                    gpx += `    <desc><![CDATA[${p.description}]]></desc>\n`;
                }
                gpx += `  </wpt>\n`;
            });
        }

        // Track (traza de la ruta)
        if (planner.currentRouteData && planner.currentRouteData.coordinates && planner.currentRouteData.coordinates.length > 0) {
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

        // En iOS a veces application/gpx+xml da problemas de tipo MIME al abrir directamente, 
        // text/xml o application/xml asegura compatibilidad total de guardado/apertura en iOS.
        this.triggerBlobDownload(gpx, filename, 'application/xml');
    },

    triggerBlobDownload(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        // Soporte específico para evitar bloqueos en WebKit (iOS Safari)
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
