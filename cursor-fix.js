// ==========================================
// CURSOR-FIX.JS - Línea de medida dinámica directa al cursor en PC
// ==========================================

(function() {
    "use strict";

    function patchCursorLine() {
        const planner = window.RoutePlanner;
        if (!planner || typeof planner.updateDynamicCursorLine !== "function") return;

        // Sobrescribimos el método de la línea dinámica para que use la posición del ratón en lugar del centro
        planner.updateDynamicCursorLine = function() {
            const sourceId = 'cursor-helper-source';
            const lineLayerId = 'cursor-helper-layer';

            if (!window.map) return;
            const mapObj = window.map;

            if (!this.points || this.points.length === 0) {
                if (mapObj.getSource(sourceId)) {
                    if (mapObj.getLayer(lineLayerId)) mapObj.removeLayer(lineLayerId);
                    mapObj.removeSource(sourceId);
                }
                if (this._cursorMarker) {
                    this._cursorMarker.remove();
                    this._cursorMarker = null;
                }
                return;
            }

            const lastPoint = this.points[this.points.length - 1].coords;
            // Usamos la última posición registrada del ratón si existe, si no, el centro del mapa
            const targetCoord = this.lastMouseLngLat ? 
                [this.lastMouseLngLat.lng, this.lastMouseLngLat.lat] : 
                [mapObj.getCenter().lng, mapObj.getCenter().lat];

            const distM = this.haversine(lastPoint[1], lastPoint[0], targetCoord[1], targetCoord[0]);
            const distStr = distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(2).replace('.', ',')} km`;

            const geojson = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [lastPoint, targetCoord]
                }
            };

            if (!mapObj.getSource(sourceId)) {
                mapObj.addSource(sourceId, { type: 'geojson', data: geojson });
                mapObj.addLayer({
                    id: lineLayerId,
                    type: 'line',
                    source: sourceId,
                    paint: {
                        'line-color': '#000000',
                        'line-width': 2.5,
                        'line-dasharray': [3, 3],
                        'line-opacity': 0.85
                    }
                });
            } else {
                mapObj.getSource(sourceId).setData(geojson);
            }

            if (!this._cursorMarker) {
                const el = document.createElement('div');
                el.style.cssText = `
                    background: transparent; color: #ffffff; font-size: 11px; font-family: sans-serif;
                    font-weight: bold; text-shadow: -1px -1px 0 #121212, 1px -1px 0 #121212, -1px 1px 0 #121212, 1px 1px 0 #121212, 0 0 3px #121212;
                    white-space: nowrap; pointer-events: none;
                `;
                el.innerText = distStr;

                this._cursorMarker = new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, 20] })
                    .setLngLat(targetCoord)
                    .addTo(mapObj);
            } else {
                this._cursorMarker.setLngLat(targetCoord);
                const el = this._cursorMarker.getElement();
                if (el) el.innerText = distStr;
            }
        };

        // Asegurarnos de capturar el movimiento del ratón en el mapa
        const mapContainer = mapObj.getContainer();
        if (mapContainer && !planner._mouseListenerAdded) {
            planner._mouseListenerAdded = true;
            mapObj.on('mousemove', (e) => {
                planner.lastMouseLngLat = e.lngLat;
                planner.updateDynamicCursorLine();
            });
            mapContainer.addEventListener('mouseleave', () => {
                planner.lastMouseLngLat = null;
                planner.updateDynamicCursorLine();
            });
        }
    }

    // Comprobamos cada poco hasta que el planificador esté listo
    const checkInterval = setInterval(() => {
        if (window.RoutePlanner && window.map) {
            clearInterval(checkInterval);
            patchCursorLine();
        }
    }, 150);
})();
