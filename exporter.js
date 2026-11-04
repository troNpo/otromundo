// ==========================================
// EXPORTER.JS - Gestor Avanzado de Exportación (KML con nombres y colores por tramo, y GPX compatible iOS/Android)
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

    // Convierte un color HEX (#RRGGBB) a formato KML AABBGGRR (con opacidad total FF)
    hexToKmlColor(hex) {
        if (!hex || !hex.startsWith('#') || hex.length < 7) return 'ff00e5ff'; // Color por defecto cian
        const r = hex.substring(1, 3);
        const g = hex.substring(3, 5);
        const b = hex.substring(5, 7);
        return `ff${b}${g}${r}`; // KML usa AABBGGRR
    },

    downloadKmlHierarchical(filename, planner) {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        kml += `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:om="http://www.oruxmaps.com/oruxmapsextensions/1/0" xmlns:gx="http://www.google.com/kml/ext/2.2">\n`;
        kml += `<Document>\n`;
        kml += `  <name><![CDATA[${filename.replace('.kml', '')}]]></name>\n`;

        // Carpeta 1: Waypoints de la ruta
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

        // Carpeta 2: Traza de la Ruta desglosada por Segmentos (con nombres y colores individuales)
        if (planner.currentRouteData && planner.currentRouteData.coordinates && planner.currentRouteData.coordinates.length > 0) {
            kml += `  <Folder>\n`;
            kml += `    <name><![CDATA[Traza de Ruta]]></name>\n`;

            const fullCoords = planner.currentRouteData.coordinates;
            const segments = planner.segments || [];

            if (segments.length > 0 && planner.points.length >= 2) {
                let coordIndex = 0;

                segments.forEach((seg, sIdx) => {
                    const nextPoint = planner.points[sIdx + 1];
                    if (!nextPoint) return;

                    const subCoords = [];
                    while (coordIndex < fullCoords.length) {
                        const pt = fullCoords[coordIndex];
                        subCoords.push(pt);
                        
                        const distToNext = planner.haversine(pt[1], pt[0], nextPoint.coords[1], nextPoint.coords[0]);
                        coordIndex++;
                        
                        if (distToNext < 40 && sIdx < segments.length - 1) {
                            break;
                        }
                    }
                    
                    if (sIdx === segments.length - 1) {
                        while (coordIndex < fullCoords.length) {
                            subCoords.push(fullCoords[coordIndex]);
                            coordIndex++;
                        }
                    }

                    if (subCoords.length < 2 && fullCoords.length >= 2) {
                        subCoords.push(fullCoords[fullCoords.length - 1]);
                    }

                    const segName = seg.name || `Tramo ${sIdx + 1}`;
                    const styleId = `seg_style_${sIdx}`;
                    const kmlColor = this.hexToKmlColor(seg.color || '#00e5ff');

                    // Definir estilo de color para el segmento
                    kml += `    <Style id="${styleId}">\n`;
                    kml += `      <LineStyle>\n`;
                    kml += `        <color>${kmlColor}</color>\n`;
                    kml += `        <width>4</width>\n`;
                    kml += `      </LineStyle>\n`;
                    kml += `    </Style>\n`;

                    // Placemark del segmento
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
            } else {
                // Si no hay segmentos definidos, exporta la ruta completa genérica
                kml += `    <Placemark>\n`;
                kml += `      <name><![CDATA[Ruta Activa]]></name>\n`;
                kml += `      <LineString>\n`;
                kml += `        <tessellate>1</tessellate>\n`;
                kml += `        <coordinates>\n`;
                kml += `          `;
                kml += fullCoords.map(c => `${c[0]},${c[1]},${c[2] || 0}`).join(" ");
                kml += `\n        </coordinates>\n`;
                kml += `      </LineString>\n`;
                kml += `    </Placemark>\n`;
            }

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

        // Se usa 'text/xml' para garantizar compatibilidad absoluta de guardado y apertura limpia en iOS y Android sin extensiones extrañas (.xml)
        this.triggerBlobDownload(gpx, filename, 'text/xml');
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
