// ==========================================
// CURSOR-FIX.JS - Línea de medida dinámica directa al cursor en PC
// ==========================================

(function() {
    "use strict";

    function patchCursorLine() {
        const planner = window.RoutePlanner;
        const mapInstance = window.map;
        if (!planner || !mapInstance || typeof planner.updateDynamicCursorLine !== "function") return;

        planner.updateDynamicCursorLine = function() {
            const sourceId = 'cursor-helper-source';
            const lineLayerId = 'cursor-helper-layer';

            if (!window.map) return;
            const currentMap = window.map;

            if (!this.points || this.points.length === 0) {
                if (currentMap.getSource(sourceId)) {
                    if (currentMap.getLayer(lineLayerId)) currentMap.removeLayer(lineLayerId);
                    currentMap.removeSource(sourceId);
                }
                if (this._cursorMarker) {
                    this._cursorMarker.remove();
                    this._cursorMarker = null;
                }
                return;
            }

            const lastPoint = this.points[this.points.length - 1].coords;
            const targetCoord = this.lastMouseLngLat ? 
                [this.lastMouseLngLat.lng, this.lastMouseLngLat.lat] : 
                [currentMap.getCenter().lng, currentMap.getCenter().lat];

            const distM = this.haversine(lastPoint[1], lastPoint[0], targetCoord[1], targetCoord[0]);
            const distStr = distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(2).replace('.', ',')} km`;

            const geojson = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [lastPoint, targetCoord]
                }
            };

            if (!currentMap.getSource(sourceId)) {
                currentMap.addSource(sourceId, { type: 'geojson', data: geojson });
                currentMap.addLayer({
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
                currentMap.getSource(sourceId).setData(geojson);
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
                    .addTo(currentMap);
            } else {
                this._cursorMarker.setLngLat(targetCoord);
                const el = this._cursorMarker.getElement();
                if (el) el.innerText = distStr;
            }
        };

        const mapContainer = mapInstance.getContainer();
        if (mapContainer && !planner._mouseListenerAdded) {
            planner._mouseListenerAdded = true;
            mapInstance.on('mousemove', (e) => {
                planner.lastMouseLngLat = e.lngLat;
                planner.updateDynamicCursorLine();
            });
            mapContainer.addEventListener('mouseleave', () => {
                planner.lastMouseLngLat = null;
                planner.updateDynamicCursorLine();
            });
        }
    }

    const checkInterval = setInterval(() => {
        if (window.RoutePlanner && window.map) {
            clearInterval(checkInterval);
            patchCursorLine();
        }
    }, 150);
})();