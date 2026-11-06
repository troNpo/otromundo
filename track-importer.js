// ==========================================
// TRACK-IMPORTER.JS - Importador con Douglas-Peucker Fijo y RoutePlanner
// ==========================================

const TrackImporter = {
    init() {
        this.setupFileInputListener();
    },

    setupFileInputListener() {
        const fileInput = document.getElementById('import-gpx-input');
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.processFile(file);
                e.target.value = '';
            }
        });
    },

    async processFile(file) {
        try {
            const text = await file.text();
            const extension = file.name.split('.').pop().toLowerCase();

            let rawCoordinates = [];

            if (extension === 'gpx') {
                rawCoordinates = this.parseGPX(text);
            } else if (extension === 'kml') {
                rawCoordinates = this.parseKML(text);
            } else {
                alert("Por favor, selecciona un archivo formato .gpx o .kml válido.");
                return;
            }

            if (rawCoordinates.length === 0) {
                alert("No se han encontrado coordenadas en el archivo seleccionado.");
                return;
            }

            console.log(`Track cargado: ${rawCoordinates.length} puntos brutos.`);

            // Valor fijo óptimo de puntos clave para mantener la lista y el mapa limpios
            const targetPoints = 10;

            // Simplificación inteligente Douglas-Peucker
            const simplifiedPoints = this.simplifyTrack(rawCoordinates, targetPoints);
            console.log(`Puntos optimizados mediante Douglas-Peucker: ${simplifiedPoints.length} puntos clave.`);

            // Leer el perfil seleccionado en la tarjeta de importación
            const profileSelect = document.getElementById('import-profile-select');
            const selectedProfile = profileSelect ? profileSelect.value : 'hiking-mountain';

            // Inyectar directamente en el Planificador interactivo
            await this.injectIntoPlanner(simplifiedPoints, selectedProfile);

        } catch (err) {
            console.error("Error al procesar el archivo de ruta:", err);
            alert("Hubo un error al leer el archivo.");
        }
    },

    parseGPX(gpxText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(gpxText, "text/xml");
        const points = [];
        
        const trkpts = xmlDoc.querySelectorAll('trkpt, rtept, wpt');
        trkpts.forEach(pt => {
            const lat = parseFloat(pt.getAttribute('lat'));
            const lon = parseFloat(pt.getAttribute('lon'));
            const ele = pt.querySelector('ele')?.textContent;
            if (!isNaN(lat) && !isNaN(lon)) {
                points.push({ lat, lon, ele: ele ? parseFloat(ele) : null });
            }
        });

        return points;
    },

    parseKML(kmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlText, "text/xml");
        const points = [];
        
        const coordsElements = xmlDoc.querySelectorAll('coordinates');
        coordsElements.forEach(el => {
            const text = el.textContent.trim();
            const tuples = text.split(/\s+/);
            tuples.forEach(tuple => {
                const parts = tuple.split(',');
                if (parts.length >= 2) {
                    const lon = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    const ele = parts[2] ? parseFloat(parts[2]) : null;
                    if (!isNaN(lat) && !isNaN(lon)) {
                        points.push({ lat, lon, ele });
                    }
                }
            });
        });

        return points;
    },

    // --- ALGORITMO RAMER-DOUGLAS-PEUCKER ---
    getPerpendicularDistance(p, p1, p2) {
        let x = p.lon, y = p.lat;
        let x1 = p1.lon, y1 = p1.lat;
        let x2 = p2.lon, y2 = p2.lat;

        let dx = x2 - x1;
        let dy = y2 - y1;

        if (dx !== 0 || dy !== 0) {
            let t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
            if (t > 1) {
                x1 = x2;
                y1 = y2;
            } else if (t > 0) {
                x1 += t * dx;
                y1 += t * dy;
            }
        }

        dx = x - x1;
        dy = y - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    rdp(points, epsilon) {
        if (points.length <= 2) return points;

        let dMax = 0;
        let index = 0;
        let end = points.length - 1;

        for (let i = 1; i < end; i++) {
            let d = this.getPerpendicularDistance(points[i], points[0], points[end]);
            if (d > dMax) {
                index = i;
                dMax = d;
            }
        }

        if (dMax > epsilon) {
            let recResults1 = this.rdp(points.slice(0, index + 1), epsilon);
            let recResults2 = this.rdp(points.slice(index), epsilon);
            return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
        } else {
            return [points[0], points[end]];
        }
    },

    simplifyTrack(points, targetPoints = 10) {
        if (points.length <= targetPoints) return points;

        let epsilon = 0.00005;
        let simplified = this.rdp(points, epsilon);
        let step = 0.0001;

        for (let i = 0; i < 8; i++) {
            if (simplified.length > targetPoints) {
                epsilon += step;
                step *= 1.5;
            } else if (simplified.length < targetPoints && epsilon > 0.00001) {
                epsilon = Math.max(0.00001, epsilon - step / 2);
                step /= 2;
            } else {
                break;
            }
            simplified = this.rdp(points, epsilon);
        }

        if (simplified.length > targetPoints) {
            const stride = Math.floor(simplified.length / targetPoints);
            const finalPoints = [];
            for (let i = 0; i < simplified.length; i += stride) {
                finalPoints.push(simplified[i]);
            }
            const last = simplified[simplified.length - 1];
            if (finalPoints[finalPoints.length - 1] !== last) {
                finalPoints.push(last);
            }
            return finalPoints;
        }

        return simplified;
    },

    async injectIntoPlanner(waypoints, profile) {
        if (typeof window.RoutePlanner === 'undefined') {
            console.error("RoutePlanner no está disponible.");
            return;
        }

        const planner = window.RoutePlanner;

        planner.clearAllPoints();

        // 1. Establecer el perfil global activo en el planificador
        planner.profile = profile;
        planner.updateDefaultProfileStatus();

        // 2. Sincronizar visualmente los radio buttons del panel de perfiles
        const radioToSelect = document.querySelector(`input[name="brouter-profile"][value="${profile}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
        }

        // 3. Inyectar waypoints
        planner.points = waypoints.map((pt, index) => {
            let name = "Paso";
            if (index === 0) name = "Inicio";
            else if (index === waypoints.length - 1) name = "Fin";

            const coords = pt.ele !== null ? [pt.lon, pt.lat, pt.ele] : [pt.lon, pt.lat];
            return { coords, name };
        });

        // 4. Sincronizar tramos para que todos adopten este perfil
        planner.syncSegmentsArray();
        planner.segments.forEach(seg => {
            seg.profile = profile;
        });

        planner.renderMarkers();
        planner.renderActiveDrawerTab();

        if (planner.points.length >= 2) {
            planner.showToast("Adaptando ruta externa...");
            await planner.calcularRutaBRouter();
        }

        if (typeof map !== 'undefined' && waypoints.length > 0) {
            const bounds = waypoints.reduce((b, pt) => {
                return b.extend([pt.lon, pt.lat]);
            }, new maplibregl.LngLatBounds([waypoints[0].lon, waypoints[0].lat], [waypoints[0].lon, waypoints[0].lat]));

            map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
        }

        console.log(`¡Ruta externa convertida con el perfil [${profile}]!`);
    }
};

window.TrackImporter = TrackImporter;
document.addEventListener('DOMContentLoaded', () => {
    TrackImporter.init();
});