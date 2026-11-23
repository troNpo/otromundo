// ==========================================
// TRACK-IMPORTER.JS - Importador Dual: Adaptar con BRouter o Cargar Track Original Editable
// Incluye capa de referencia semitransparente violeta (#b55cff) bajo el track importado
// ==========================================

const TrackImporter = {
    referenceSourceId: "otromundo-imported-track-ref-source",
    referenceLayerId: "otromundo-imported-track-ref-layer",
    referenceCoords: null,

    init() {
        this.setupImportModeOptions();
        this.setupFileInputListener();
        this.hookPlannerForOriginalSegments();
        this.hookPlannerClearAndStyleEvents();
    },

    // Dibuja o actualiza la capa semitransparente violeta de referencia bajo la ruta
    renderReferenceLayer(coords) {
        if (Array.isArray(coords) && coords.length >= 2) {
            this.referenceCoords = coords.map(c => [Number(c[0]), Number(c[1])]);
        }

        const mapObj = window.map;
        if (!mapObj || typeof mapObj.getSource !== "function" || !Array.isArray(this.referenceCoords) || this.referenceCoords.length < 2) {
            return;
        }

        const geojsonData = {
            type: "Feature",
            properties: {
                role: "imported-track-reference"
            },
            geometry: {
                type: "LineString",
                coordinates: this.referenceCoords
            }
        };

        try {
            const existingSource = mapObj.getSource(this.referenceSourceId);
            if (existingSource && typeof existingSource.setData === "function") {
                existingSource.setData(geojsonData);
            } else {
                mapObj.addSource(this.referenceSourceId, {
                    type: "geojson",
                    data: geojsonData
                });
            }

            if (!mapObj.getLayer(this.referenceLayerId)) {
                // Buscamos la primera capa de ruta o símbolo para colocar la referencia violeta justo debajo
                const layers = mapObj.getStyle?.()?.layers || [];
                const routeLayer = layers.find(l =>
                    typeof l.id === "string" &&
                    (l.id.includes("route") || l.id.includes("track") || l.id.includes("planner")) &&
                    l.id !== this.referenceLayerId
                );
                const beforeId = routeLayer ? routeLayer.id : undefined;

                mapObj.addLayer({
                    id: this.referenceLayerId,
                    type: "line",
                    source: this.referenceSourceId,
                    layout: {
                        "line-join": "round",
                        "line-cap": "round"
                    },
                    paint: {
                        "line-color": "#b55cff",
                        "line-width": 5.5,
                        "line-opacity": 0.42
                    }
                }, beforeId);
            }
        } catch (err) {
            console.warn("No se pudo dibujar la capa de referencia violeta:", err);
        }
    },

    // Elimina la capa violeta de referencia
    clearReferenceLayer() {
        this.referenceCoords = null;
        const mapObj = window.map;
        if (!mapObj) return;

        try {
            if (mapObj.getLayer?.(this.referenceLayerId)) {
                mapObj.removeLayer(this.referenceLayerId);
            }
            if (mapObj.getSource?.(this.referenceSourceId)) {
                mapObj.removeSource(this.referenceSourceId);
            }
        } catch (err) {}
    },

    // Mantiene la capa violeta al cambiar de mapa base y la limpia al borrar todo el trazado
    hookPlannerClearAndStyleEvents() {
        const waitForMap = setInterval(() => {
            const mapObj = window.map;
            if (!mapObj || typeof mapObj.on !== "function" || mapObj._refLayerStyleHooked) return;
            mapObj._refLayerStyleHooked = true;
            clearInterval(waitForMap);

            mapObj.on("style.load", () => {
                if (Array.isArray(this.referenceCoords) && this.referenceCoords.length >= 2) {
                    setTimeout(() => this.renderReferenceLayer(), 180);
                }
            });
        }, 150);

        const waitForPlanner = setInterval(() => {
            const planner = window.RoutePlanner;
            if (!planner || typeof planner.clearAllPoints !== "function" || planner._refClearHooked) return;
            planner._refClearHooked = true;
            clearInterval(waitForPlanner);

            const origClear = planner.clearAllPoints.bind(planner);
            planner.clearAllPoints = (...args) => {
                this.clearReferenceLayer();
                return origClear(...args);
            };
        }, 150);
    },

    // Configura las opciones del desplegable de importación
    setupImportModeOptions() {
        const profileSelect = document.getElementById('import-profile-select');
        if (!profileSelect) return;

        // Eliminamos la opción antigua "manual-straight" si existiera
        const manualOption = profileSelect.querySelector('option[value="manual-straight"]');
        if (manualOption) {
            manualOption.remove();
        }

        // Añadimos la opción "Track Original (Sin recalcular / Editable)" arriba del todo si no existe
        if (!profileSelect.querySelector('option[value="original-track"]')) {
            const originalOption = document.createElement('option');
            originalOption.value = 'original-track';
            originalOption.textContent = 'Track Original (Sin recalcular)';
            profileSelect.insertBefore(originalOption, profileSelect.firstChild);
            profileSelect.value = 'original-track';
        }
    },

    // Intercepta el cálculo de BRouter para preservar intactos los segmentos marcados como 'original-track'
    hookPlannerForOriginalSegments() {
        const waitForPlanner = setInterval(() => {
            const planner = window.RoutePlanner;
            if (!planner || typeof planner.calcularRutaBRouter !== 'function' || planner._originalTrackHooked) return;
            planner._originalTrackHooked = true;
            clearInterval(waitForPlanner);

            const originalCalc = planner.calcularRutaBRouter.bind(planner);

            planner.calcularRutaBRouter = async function(...args) {
                const hasOriginalSegments = Array.isArray(this.segments) && this.segments.some(s => s.profile === 'original-track');
                if (!hasOriginalSegments) {
                    return originalCalc(...args);
                }

                if (this.points.length < 2) return;
                this.syncSegmentsArray();

                try {
                    const segmentPromises = [];

                    for (let i = 0; i < this.points.length - 1; i++) {
                        const p1 = this.points[i].coords;
                        const p2 = this.points[i + 1].coords;
                        const seg = this.segments[i];
                        const segProfile = seg?.profile || this.profile;

                        // Si el tramo es un track original importado y conserva sus puntos sin haber sido movido
                        if (segProfile === 'original-track' && Array.isArray(seg.coordinates) && seg.coordinates.length >= 2) {
                            const firstC = seg.coordinates[0];
                            const lastC = seg.coordinates[seg.coordinates.length - 1];
                            const startMoved = this.haversine(p1[1], p1[0], firstC[1], firstC[0]) > 25;
                            const endMoved = this.haversine(p2[1], p2[0], lastC[1], lastC[0]) > 25;

                            if (!startMoved && !endMoved) {
                                segmentPromises.push(Promise.resolve({
                                    coordinates: seg.coordinates,
                                    travelTime: 0,
                                    profile: 'original-track'
                                }));
                                continue;
                            } else {
                                // Si el usuario arrastró uno de los extremos o insertó un punto intermedio,
                                // recalculamos solo este tramo afectado usando el perfil activo del planificador
                                seg.profile = this.profile;
                            }
                        }

                        const effectiveProfile = (seg.profile && seg.profile !== 'original-track') ? seg.profile : this.profile;

                        if (effectiveProfile === 'manual-straight') {
                            const straightCoords = [];
                            const distanceMeters = this.haversine(p1[1], p1[0], p2[1], p2[0]);
                            const steps = Math.max(2, Math.floor(distanceMeters / 100));
                            for (let s = 0; s <= steps; s++) {
                                const t = s / steps;
                                const lng = p1[0] + (p2[0] - p1[0]) * t;
                                const lat = p1[1] + (p2[1] - p1[1]) * t;
                                const ele1 = p1[2] !== undefined ? p1[2] : 0;
                                const ele2 = p2[2] !== undefined ? p2[2] : 0;
                                straightCoords.push([lng, lat, ele1 + (ele2 - ele1) * t]);
                            }
                            segmentPromises.push(Promise.resolve({
                                coordinates: straightCoords,
                                travelTime: distanceMeters / (5.0 * 1000 / 3600),
                                profile: effectiveProfile
                            }));
                        } else {
                            const url = `https://brouter.de/brouter?lonlats=${p1[0]},${p1[1]}|${p2[0]},${p2[1]}&profile=${effectiveProfile}&alternativeidx=0&format=geojson`;
                            segmentPromises.push(
                                fetch(url)
                                    .then(res => res.json())
                                    .then(data => {
                                        const feature = data?.features?.[0];
                                        const coords = feature?.geometry?.coordinates || [p1, p2];
                                        const props = feature?.properties || {};
                                        const travelTime = parseFloat(props['total-time'] || props.time || props.traveltime || 0);
                                        return { coordinates: coords, travelTime, profile: effectiveProfile };
                                    })
                                    .catch(() => ({ coordinates: [p1, p2], travelTime: 0, profile: effectiveProfile }))
                            );
                        }
                    }

                    const segmentResults = await Promise.all(segmentPromises);

                    let combinedCoordinates = [];
                    let totalDistM = 0;
                    let totalAscent = 0;
                    let totalDescent = 0;
                    let totalSeconds = 0;

                    segmentResults.forEach((segRes, idx) => {
                        const coords = segRes.coordinates;
                        totalSeconds += (segRes.travelTime || 0);

                        if (this.segments[idx]) {
                            this.segments[idx].coordinates = coords;
                        }

                        if (idx > 0 && combinedCoordinates.length > 0) {
                            combinedCoordinates.push(...coords.slice(1));
                        } else {
                            combinedCoordinates.push(...coords);
                        }

                        for (let j = 0; j < coords.length - 1; j++) {
                            const c1 = coords[j], c2 = coords[j + 1];
                            const dSeg = this.haversine(c1[1], c1[0], c2[1], c2[0]);
                            totalDistM += dSeg;
                            const diff = (c2[2] || 0) - (c1[2] || 0);
                            if (diff > 0) totalAscent += diff; else totalDescent += Math.abs(diff);
                        }
                    });

                    const distKm = (totalDistM / 1000).toFixed(2);
                    const timeStr = this.formatBRouterTime(totalSeconds, totalDistM, this.profile);

                    this.routesList = [{
                        index: 0,
                        coordinates: combinedCoordinates,
                        distKm,
                        timeStr,
                        ascent: Math.round(totalAscent),
                        descent: Math.round(totalDescent)
                    }];

                    this.currentRouteIndex = 0;
                    this.activateRouteVariant(0);
                    this.updateAltButtonVisibility();
                } catch (e) {
                    console.error("Error al actualizar ruta con tramos originales:", e);
                }
            };
        }, 150);
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

            if (rawCoordinates.length < 2) {
                alert("No se han encontrado suficientes coordenadas en el archivo seleccionado.");
                return;
            }

            // Guardamos la referencia del track original completo antes de simplificar o adaptar
            const refCoords = rawCoordinates.map(pt => [pt.lon, pt.lat]);

            const profileSelect = document.getElementById('import-profile-select');
            const selectedMode = profileSelect ? profileSelect.value : 'original-track';

            if (selectedMode === 'original-track') {
                await this.injectOriginalTrackEditable(rawCoordinates, refCoords);
            } else {
                const targetPoints = 10;
                const simplifiedPoints = this.simplifyTrack(rawCoordinates, targetPoints);
                await this.injectIntoPlanner(simplifiedPoints, selectedMode, refCoords);
            }

        } catch (err) {
            console.error("Error al procesar el archivo de ruta:", err);
            alert("Hubo un error al leer el archivo.");
        }
    },

    // Carga el track original exacto (sin modificar su geometría) y crea nodos editables sobre él
    async injectOriginalTrackEditable(rawCoordinates, refCoords = null) {
        if (typeof window.RoutePlanner === 'undefined') return;
        const planner = window.RoutePlanner;

        planner.clearAllPoints();
        if (Array.isArray(refCoords) && refCoords.length >= 2) {
            this.renderReferenceLayer(refCoords);
        }

        // Convertimos todas las coordenadas al formato [lon, lat, ele]
        const fullCoords = rawCoordinates.map(pt =>
            pt.ele !== null && !isNaN(pt.ele) ? [pt.lon, pt.lat, pt.ele] : [pt.lon, pt.lat, 0]
        );

        // Seleccionamos hasta 8 nodos de control distribuidos a lo largo del track para poder arrastrar/editar tramos
        const maxControlNodes = Math.min(8, fullCoords.length);
        const controlIndices = [0];

        if (maxControlNodes > 2) {
            const step = (fullCoords.length - 1) / (maxControlNodes - 1);
            for (let k = 1; k < maxControlNodes - 1; k++) {
                controlIndices.push(Math.round(k * step));
            }
        }
        controlIndices.push(fullCoords.length - 1);

        // Creamos los puntos marcadores y los sub-tramos exactos entre cada par de marcadores
        planner.points = [];
        planner.segments = [];

        for (let i = 0; i < controlIndices.length; i++) {
            const ptIdx = controlIndices[i];
            let name = "Paso";
            if (i === 0) name = "Inicio";
            else if (i === controlIndices.length - 1) name = "Fin";

            planner.points.push({
                coords: fullCoords[ptIdx],
                name
            });

            if (i < controlIndices.length - 1) {
                const nextPtIdx = controlIndices[i + 1];
                const sliceCoords = fullCoords.slice(ptIdx, nextPtIdx + 1);
                planner.segments.push({
                    name: `Tramo Original ${i + 1}`,
                    color: '#00e5ff',
                    profile: 'original-track',
                    coordinates: sliceCoords
                });
            }
        }

        planner.renderMarkers();
        planner.renderActiveDrawerTab();
        await planner.calcularRutaBRouter();
        if (Array.isArray(refCoords) && refCoords.length >= 2) {
            this.renderReferenceLayer(refCoords);
        }

        // Cerrar panel lateral de opciones si estaba abierto
        document.getElementById("side-panel-planner-options")?.classList.remove("active");
        planner.showToast("Track original cargado (referencia violeta activa)");

        if (typeof map !== 'undefined' && fullCoords.length > 0) {
            const bounds = fullCoords.reduce((b, c) => b.extend([c[0], c[1]]), new maplibregl.LngLatBounds([fullCoords[0][0], fullCoords[0][1]], [fullCoords[0][0], fullCoords[0][1]]));
            map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
        }
    },

    parseGPX(gpxText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(gpxText, "text/xml");
        const points = [];
        
        const trkpts = xmlDoc.querySelectorAll('trkpt, rtept');
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

    async injectIntoPlanner(waypoints, profile, refCoords = null) {
        if (typeof window.RoutePlanner === 'undefined') return;

        const planner = window.RoutePlanner;
        planner.clearAllPoints();
        if (Array.isArray(refCoords) && refCoords.length >= 2) {
            this.renderReferenceLayer(refCoords);
        }

        planner.profile = profile;
        planner.updateDefaultProfileStatus();

        const radioToSelect = document.querySelector(`input[name="brouter-profile"][value="${profile}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
        }

        planner.points = waypoints.map((pt, index) => {
            let name = "Paso";
            if (index === 0) name = "Inicio";
            else if (index === waypoints.length - 1) name = "Fin";

            const coords = pt.ele !== null ? [pt.lon, pt.lat, pt.ele] : [pt.lon, pt.lat];
            return { coords, name };
        });

        planner.syncSegmentsArray();
        planner.segments.forEach(seg => {
            seg.profile = profile;
        });

        planner.renderMarkers();
        planner.renderActiveDrawerTab();

        if (planner.points.length >= 2) {
            planner.showToast("Adaptando ruta externa...");
            await planner.calcularRutaBRouter();
            if (Array.isArray(refCoords) && refCoords.length >= 2) {
                this.renderReferenceLayer(refCoords);
            }
        }

        document.getElementById("side-panel-planner-options")?.classList.remove("active");

        if (typeof map !== 'undefined' && waypoints.length > 0) {
            const bounds = waypoints.reduce((b, pt) => {
                return b.extend([pt.lon, pt.lat]);
            }, new maplibregl.LngLatBounds([waypoints[0].lon, waypoints[0].lat], [waypoints[0].lon, waypoints[0].lat]));

            map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
        }
    }
};

window.TrackImporter = TrackImporter;
document.addEventListener('DOMContentLoaded', () => {
    TrackImporter.init();
});