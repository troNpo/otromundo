// ==========================================
// GESTOR DE CAPAS Y ELEMENTOS EN EL MAPA (layer-manager.js)
// ==========================================

const LayerManager = {
    activeLayers: {
        searchedPOIs: [],     // Puntos individuales / waypoints
        externalTracks: []    // Trazos / líneas continuas de rutas (Tracks)
    },
    activeMapMarkers: [],     // Almacén de marcadores visuales estables
    selectedTrackId: null,    // ID del track seleccionado actualmente en el mapa

    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // 1. Abrir panel de Gestor de Capas desde la tarjeta del Centro de Control
        const btnCard = document.getElementById("btn-layer-manager-card");
        if (btnCard) {
            btnCard.addEventListener("click", () => {
                document.getElementById("control-center-panel").classList.add("hidden");
                document.getElementById("layer-manager-panel").classList.remove("hidden");
                this.renderLayerManagerPanel();
            });
        }

        // 2. Botón volver desde el Gestor de Capas al mapa
        const btnBack = document.getElementById("btn-back-layer-manager");
        if (btnBack) {
            btnBack.addEventListener("click", () => {
                document.getElementById("layer-manager-panel").classList.add("hidden");
                const bottomToolbar = document.getElementById("bottom-toolbar");
                if (bottomToolbar) bottomToolbar.classList.remove("hidden");
                if (typeof map !== 'undefined' && map) {
                    setTimeout(() => map.resize(), 50);
                }
            });
        }

        // 3. Botón "Ver en el Mapa" desde el Gestor de PDI
        const btnViewOnMap = document.getElementById("btn-view-on-map");
        if (btnViewOnMap) {
            btnViewOnMap.addEventListener("click", () => {
                let selected = [];
                const checkedBoxes = document.querySelectorAll(".poi-select-checkbox:checked");
                
                if (checkedBoxes.length > 0) {
                    checkedBoxes.forEach(chk => {
                        const idStr = chk.getAttribute("data-id");
                        const card = chk.closest(".node-card");
                        if (card) {
                            const name = card.querySelector(".node-name")?.textContent || "Punto sin nombre";
                            let lat = typeof currentLat !== 'undefined' ? currentLat : 37.3414;
                            let lon = typeof currentLon !== 'undefined' ? currentLon : -5.9304;

                            if (typeof currentNominatimElements !== 'undefined' && Array.isArray(currentNominatimElements)) {
                                const found = currentNominatimElements.find(el => el.id == idStr);
                                if (found) {
                                    lat = found.lat;
                                    lon = found.lon;
                                }
                            }

                            selected.push({
                                id: idStr,
                                nombre: name,
                                categoria: 'PDI',
                                lat: parseFloat(lat),
                                lon: parseFloat(lon),
                                tags: { name: name }
                            });
                        }
                    });
                }

                if (selected.length === 0) {
                    alert("Por favor, selecciona al menos un PDI para ver en el mapa.");
                    return;
                }

                this.loadPOIsAsLayer(selected);
                document.getElementById("results-panel").style.display = "none";
                const bottomToolbar = document.getElementById("bottom-toolbar");
                if (bottomToolbar) bottomToolbar.classList.remove("hidden");
                const mapCursor = document.getElementById("map-center-cursor");
                if (mapCursor) mapCursor.style.display = "none";
            });
        }

        // 4. Autonomía: Botón de subida de archivo externo (GPX / KML)
        const btnUploadFile = document.getElementById("btn-upload-layer-file");
        const fileInput = document.getElementById("layer-file-input");

        if (btnUploadFile && fileInput) {
            btnUploadFile.addEventListener("click", () => {
                fileInput.click();
            });

            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const content = event.target.result;
                    this.parseAndLoadExternalFile(file.name, content);
                    fileInput.value = "";
                };
                reader.readAsText(file);
            });
        }

        // 5. Botón vaciar capa completa
        const btnClearLayer = document.getElementById("btn-clear-layer");
        if (btnClearLayer) {
            btnClearLayer.addEventListener("click", () => {
                if (confirm("¿Estás seguro de vaciar toda la capa activa y los tracks del mapa?")) {
                    this.activeLayers.searchedPOIs = [];
                    this.activeLayers.externalTracks = [];
                    this.renderLayerManagerPanel();
                    this.paintMarkersOnMap();
                    this.paintTracksOnMap();
                    this.hideAllDetailPanels();
                    if (typeof map !== 'undefined' && map) map.resize();
                }
            });
        }

        // 6. Botones de acción del nuevo panel inferior de Track
        const trackDetailClose = document.getElementById("detail-track-btn-close");
        if (trackDetailClose) {
            trackDetailClose.addEventListener("click", () => {
                this.hideTrackDetailPanel();
            });
        }

        const trackDetailAction = document.getElementById("detail-track-btn-action");
        if (trackDetailAction) {
            trackDetailAction.addEventListener("click", () => {
                this.hideTrackDetailPanel();
                document.getElementById("layer-manager-panel").classList.remove("hidden");
                this.renderLayerManagerPanel();
            });
        }

        const trackDetailDelete = document.getElementById("detail-track-btn-delete");
        if (trackDetailDelete) {
            trackDetailDelete.addEventListener("click", () => {
                if (!this.selectedTrackId) return;
                const index = this.activeLayers.externalTracks.findIndex(t => t.id === this.selectedTrackId);
                if (index !== -1) {
                    this.removeTrack(index);
                    this.hideTrackDetailPanel();
                }
            });
        }

        // 7. Botón "Listado" desde el panel inferior de detalle de PDI en el mapa
        const detailBtnAction = document.getElementById("detail-btn-action");
        if (detailBtnAction) {
            detailBtnAction.addEventListener("click", () => {
                document.getElementById("map-poi-detail-panel").style.display = "none";
                document.getElementById("layer-manager-panel").classList.remove("hidden");
                this.renderLayerManagerPanel();
            });
        }
    },

    parseAndLoadExternalFile(filename, textContent) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(textContent, "text/xml");
        let newPoints = [];
        let newTracks = [];

        if (filename.toLowerCase().endsWith(".gpx")) {
            const wpts = xmlDoc.querySelectorAll("wpt");
            wpts.forEach((pt, idx) => {
                const lat = parseFloat(pt.getAttribute("lat"));
                const lon = parseFloat(pt.getAttribute("lon"));
                const nameEl = pt.querySelector("name");
                const name = nameEl ? nameEl.textContent : `Punto GPX ${idx + 1}`;

                if (!isNaN(lat) && !isNaN(lon)) {
                    newPoints.push({
                        id: `gpx_wpt_${Date.now()}_${idx}`,
                        nombre: name,
                        categoria: 'Waypoint GPX',
                        lat: lat,
                        lon: lon,
                        tags: { name: name }
                    });
                }
            });

            const trks = xmlDoc.querySelectorAll("trk");
            trks.forEach((trk, idx) => {
                const nameEl = trk.querySelector("name");
                const name = nameEl ? nameEl.textContent : `Track GPX ${idx + 1}`;
                const pts = trk.querySelectorAll("trkpt");
                const coords = [];
                
                pts.forEach(pt => {
                    const lat = parseFloat(pt.getAttribute("lat"));
                    const lon = parseFloat(pt.getAttribute("lon"));
                    if (!isNaN(lat) && !isNaN(lon)) {
                        coords.push([lon, lat]);
                    }
                });

                if (coords.length > 1) {
                    newTracks.push({
                        id: `gpx_trk_${Date.now()}_${idx}`,
                        nombre: name,
                        categoria: 'Track GPX',
                        coordinates: coords
                    });
                }
            });

        } else if (filename.toLowerCase().endsWith(".kml")) {
            const placemarks = xmlDoc.querySelectorAll("Placemark");
            placemarks.forEach((pm, idx) => {
                const nameEl = pm.querySelector("name");
                const name = nameEl ? nameEl.textContent.trim() : `Elemento KML ${idx + 1}`;
                
                const lineCoords = pm.querySelector("LineString coordinates");
                if (lineCoords) {
                    const coordsText = lineCoords.textContent.trim();
                    const pairs = coordsText.split(/\s+/);
                    const coords = [];

                    pairs.forEach(pair => {
                        const parts = pair.split(",");
                        if (parts.length >= 2) {
                            const lon = parseFloat(parts[0]);
                            const lat = parseFloat(parts[1]);
                            if (!isNaN(lat) && !isNaN(lon)) {
                                coords.push([lon, lat]);
                            }
                        }
                    });

                    if (coords.length > 1) {
                        newTracks.push({
                            id: `kml_trk_${Date.now()}_${idx}`,
                            nombre: name,
                            categoria: 'Track KML',
                            coordinates: coords
                        });
                    }
                } else {
                    const coordsEl = pm.querySelector("Point coordinates");
                    if (coordsEl) {
                        const coordsText = coordsEl.textContent.trim().split(/\s+/)[0];
                        const parts = coordsText.split(",");
                        if (parts.length >= 2) {
                            const lon = parseFloat(parts[0]);
                            const lat = parseFloat(parts[1]);

                            if (!isNaN(lat) && !isNaN(lon)) {
                                newPoints.push({
                                    id: `kml_pt_${Date.now()}_${idx}`,
                                    nombre: name,
                                    categoria: 'Punto KML',
                                    lat: lat,
                                    lon: lon,
                                    tags: { name: name }
                                });
                            }
                        }
                    }
                }
            });
        }

        if (newPoints.length === 0 && newTracks.length === 0) {
            alert("No se pudieron extraer puntos ni tracks válidos del archivo seleccionado.");
            return;
        }

        this.activeLayers.searchedPOIs = [...this.activeLayers.searchedPOIs, ...newPoints];
        this.activeLayers.externalTracks = [...this.activeLayers.externalTracks, ...newTracks];

        this.renderLayerManagerPanel();
        this.paintMarkersOnMap();
        this.paintTracksOnMap();

        document.getElementById("control-center-panel").classList.add("hidden");
        document.getElementById("layer-manager-panel").classList.add("hidden");
        const bottomToolbar = document.getElementById("bottom-toolbar");
        if (bottomToolbar) bottomToolbar.classList.remove("hidden");

        if (typeof showToast === 'function') {
            showToast(`📂 Archivo cargado: ${newPoints.length} puntos, ${newTracks.length} tracks`);
        }

        if (typeof map !== 'undefined' && map) {
            try {
                const bounds = new maplibregl.LngLatBounds();
                newPoints.forEach(p => bounds.extend([p.lon, p.lat]));
                newTracks.forEach(t => t.coordinates.forEach(c => bounds.extend(c)));
                map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1200 });
                setTimeout(() => map.resize(), 50);
            } catch (e) {
                console.error("Error ajustando límites:", e);
            }
        }
    },

    loadPOIsAsLayer(pois) {
        this.activeLayers.searchedPOIs = [...pois];
        this.renderLayerManagerPanel();
        this.paintMarkersOnMap();
        this.paintTracksOnMap();

        if (pois.length > 0 && typeof map !== 'undefined' && map) {
            try {
                const bounds = new maplibregl.LngLatBounds();
                pois.forEach(p => bounds.extend([p.lon, p.lat]));
                map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1200 });
            } catch (e) {
                console.error("Error ajustando límites:", e);
            }
        }
    },

    renderLayerManagerPanel() {
        const container = document.getElementById("layer-manager-nodes-container");
        const badge = document.getElementById("layer-manager-badge");
        if (!container) return;

        container.innerHTML = "";
        const totalPoints = this.activeLayers.searchedPOIs.length;
        const totalTracks = this.activeLayers.externalTracks.length;
        const total = totalPoints + totalTracks;
        
        if (badge) badge.innerText = total;

        if (total === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 40px 20px;">No hay elementos ni tracks activos en la capa del mapa.</p>`;
            return;
        }

        // 1. Renderizar Tracks
        this.activeLayers.externalTracks.forEach((trk, index) => {
            const card = document.createElement("div");
            card.className = "poi-card-item";
            card.style.cssText = "background: var(--bg-card); border: 1px solid var(--primary-cyan); padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;";
            
            card.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; padding-right: 10px;">
                    <span style="font-size: 0.7rem; color: var(--primary-cyan); font-weight: bold; text-transform: uppercase;">${trk.categoria || 'TRACK'}</span>
                    <strong style="color: var(--text-main); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${trk.nombre}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${trk.coordinates.length} puntos de ruta</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <button class="btn-focus-track" data-index="${index}" title="Centrar track en el mapa" style="background: rgba(0,229,255,0.1); border: 1px solid var(--primary-cyan); border-radius: 8px; padding: 6px; cursor: pointer; display: flex; align-items: center;">
                        <img src="./ui-icons/fi-rr-location-arrow.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%);" alt="Centrar">
                    </button>
                    <button class="btn-delete-track" data-index="${index}" title="Eliminar track" style="background: rgba(231,76,60,0.1); border: 1px solid #e74c3c; border-radius: 8px; padding: 6px; cursor: pointer; display: flex; align-items: center;">
                        <img src="./ui-icons/fi-rr-trash.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(43%) sepia(93%) saturate(1352%) hue-rotate(334deg) brightness(97%) contrast(92%);" alt="Borrar">
                    </button>
                </div>
            `;

            card.querySelector(".btn-focus-track").addEventListener("click", () => {
                this.focusOnTrack(trk);
            });

            card.querySelector(".btn-delete-track").addEventListener("click", () => {
                this.removeTrack(index);
            });

            container.appendChild(card);
        });

        // 2. Renderizar Puntos
        this.activeLayers.searchedPOIs.forEach((poi, index) => {
            const card = document.createElement("div");
            card.className = "poi-card-item";
            card.style.cssText = "background: var(--bg-card); border: 1px solid var(--border-color); padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;";
            
            card.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; padding-right: 10px;">
                    <span style="font-size: 0.7rem; color: var(--primary-cyan); font-weight: bold; text-transform: uppercase;">${poi.categoria || 'PDI'}</span>
                    <strong style="color: var(--text-main); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${poi.nombre}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${poi.distancia || ''}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <button class="btn-focus-poi" data-index="${index}" title="Centrar en el mapa" style="background: rgba(0,229,255,0.1); border: 1px solid var(--primary-cyan); border-radius: 8px; padding: 6px; cursor: pointer; display: flex; align-items: center;">
                        <img src="./ui-icons/fi-rr-location-arrow.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%);" alt="Centrar">
                    </button>
                    <button class="btn-delete-layer-item" data-index="${index}" title="Eliminar de la capa" style="background: rgba(231,76,60,0.1); border: 1px solid #e74c3c; border-radius: 8px; padding: 6px; cursor: pointer; display: flex; align-items: center;">
                        <img src="./ui-icons/fi-rr-trash.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(43%) sepia(93%) saturate(1352%) hue-rotate(334deg) brightness(97%) contrast(92%);" alt="Borrar">
                    </button>
                </div>
            `;

            card.querySelector(".btn-focus-poi").addEventListener("click", () => {
                this.focusOnPOI(poi);
            });

            card.querySelector(".btn-delete-layer-item").addEventListener("click", () => {
                this.removePOI(index);
            });

            container.appendChild(card);
        });
    },

    paintMarkersOnMap() {
        if (typeof map === 'undefined' || !map) return;

        if (this.activeMapMarkers && Array.isArray(this.activeMapMarkers)) {
            this.activeMapMarkers.forEach(item => {
                if (item && item.marker && typeof item.marker.remove === 'function') {
                    item.marker.remove();
                }
            });
        }
        this.activeMapMarkers = [];

        this.activeLayers.searchedPOIs.forEach(poi => {
            const lat = parseFloat(poi.lat);
            const lon = parseFloat(poi.lon);
            if (isNaN(lat) || isNaN(lon)) return;

            const colorPin = typeof obtenerColorPorTag === 'function' ? obtenerColorPorTag(poi.tags) : '#00e5ff';

            const marker = new maplibregl.Marker({ color: colorPin })
                .setLngLat([lon, lat])
                .addTo(map);

            if (marker.getElement()) {
                marker.getElement().addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showLayerItemDetail(poi);
                });
            }

            this.activeMapMarkers.push({ id: poi.id, marker: marker, data: poi });
        });
    },

    paintTracksOnMap() {
        if (typeof map === 'undefined' || !map) return;

        const features = this.activeLayers.externalTracks.map(trk => ({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: trk.coordinates
            },
            properties: {
                id: trk.id,
                nombre: trk.nombre,
                categoria: trk.categoria || 'Track'
            }
        }));

        const geojson = {
            type: 'FeatureCollection',
            features: features
        };

        try {
            if (map.getLayer('layer-tracks-layer')) {
                map.removeLayer('layer-tracks-layer');
            }
            if (map.getSource('layer-tracks-source')) {
                map.removeSource('layer-tracks-source');
            }

            if (features.length > 0) {
                map.addSource('layer-tracks-source', {
                    type: 'geojson',
                    data: geojson
                });

                map.addLayer({
                    id: 'layer-tracks-layer',
                    type: 'line',
                    source: 'layer-tracks-source',
                    paint: {
                        'line-color': '#00e5ff',
                        'line-width': 4,
                        'line-opacity': 0.85
                    }
                });

                if (!map.hasLayerTrackListeners) {
                    map.on('click', 'layer-tracks-layer', (e) => {
                        if (e.features && e.features.length > 0) {
                            const props = e.features[0].properties;
                            const trk = this.activeLayers.externalTracks.find(t => t.id === props.id);
                            if (trk) {
                                this.showTrackDetail(trk);
                            }
                        }
                    });

                    map.on('mouseenter', 'layer-tracks-layer', () => {
                        map.getCanvas().style.cursor = 'pointer';
                    });
                    map.on('mouseleave', 'layer-tracks-layer', () => {
                        map.getCanvas().style.cursor = '';
                    });

                    map.hasLayerTrackListeners = true;
                }
            }
        } catch (e) {
            console.error("Error al pintar tracks en el mapa:", e);
        }
    },

    focusOnPOI(poi) {
        this.hideAllDetailPanels();
        document.getElementById("layer-manager-panel").classList.add("hidden");
        const bottomToolbar = document.getElementById("bottom-toolbar");
        if (bottomToolbar) bottomToolbar.classList.remove("hidden");

        if (typeof map !== 'undefined' && map) {
            const lat = parseFloat(poi.lat);
            const lon = parseFloat(poi.lon);
            if (!isNaN(lat) && !isNaN(lon)) {
                map.flyTo({ center: [lon, lat], zoom: 16, duration: 1000 });
                setTimeout(() => map.resize(), 50);
            }
        }
        this.showLayerItemDetail(poi);
    },

    focusOnTrack(trk) {
        this.hideAllDetailPanels();
        document.getElementById("layer-manager-panel").classList.add("hidden");
        const bottomToolbar = document.getElementById("bottom-toolbar");
        if (bottomToolbar) bottomToolbar.classList.remove("hidden");

        if (typeof map !== 'undefined' && map && trk.coordinates.length > 0) {
            try {
                const bounds = new maplibregl.LngLatBounds();
                trk.coordinates.forEach(c => bounds.extend(c));
                map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1200 });
                setTimeout(() => map.resize(), 50);
            } catch (e) {
                console.error("Error ajustando límites al track:", e);
            }
        }
        this.showTrackDetail(trk);
    },

    showLayerItemDetail(poi) {
        this.hideAllDetailPanels();
        const detailPanel = document.getElementById("map-poi-detail-panel");
        if (!detailPanel) return;

        document.getElementById("detail-poi-category").innerText = poi.categoria || "PDI de Capa";
        document.getElementById("detail-poi-title").innerText = poi.nombre;
        document.getElementById("detail-poi-meta").innerText = `Lat: ${Number(poi.lat).toFixed(5)}, Lon: ${Number(poi.lon).toFixed(5)}`;
        
        detailPanel.style.display = "flex";

        const bottomToolbar = document.getElementById("bottom-toolbar");
        if (bottomToolbar) bottomToolbar.classList.remove("hidden");

        document.getElementById("detail-btn-close").onclick = () => {
            detailPanel.style.display = "none";
            if (bottomToolbar) bottomToolbar.classList.remove("hidden");
            if (typeof map !== 'undefined' && map) map.resize();
        };
    },

    showTrackDetail(trk) {
        this.hideAllDetailPanels();
        this.selectedTrackId = trk.id;
        const panel = document.getElementById("map-track-detail-panel");
        if (!panel) return;

        document.getElementById("detail-track-category").innerText = trk.categoria || "Track / Ruta";
        document.getElementById("detail-track-title").innerText = trk.nombre;
        document.getElementById("detail-track-meta").innerText = `Contiene ${trk.coordinates.length} puntos de trazado continuo.`;

        panel.style.display = "flex";

        const bottomToolbar = document.getElementById("bottom-toolbar");
        if (bottomToolbar) bottomToolbar.classList.remove("hidden");
    },

    hideTrackDetailPanel() {
        const panel = document.getElementById("map-track-detail-panel");
        if (panel) panel.style.display = "none";
        this.selectedTrackId = null;
        const bottomToolbar = document.getElementById("bottom-toolbar");
        if (bottomToolbar) bottomToolbar.classList.remove("hidden");
        if (typeof map !== 'undefined' && map) map.resize();
    },

    hideAllDetailPanels() {
        const poiPanel = document.getElementById("map-poi-detail-panel");
        if (poiPanel) poiPanel.style.display = "none";
        const trackPanel = document.getElementById("map-track-detail-panel");
        if (trackPanel) trackPanel.style.display = "none";
        this.selectedTrackId = null;
    },

    removePOI(index) {
        const removed = this.activeLayers.searchedPOIs.splice(index, 1)[0];
        
        if (removed) {
            const markerIndex = this.activeMapMarkers.findIndex(m => m.id === removed.id);
            if (markerIndex !== -1) {
                this.activeMapMarkers[markerIndex].marker.remove();
                this.activeMapMarkers.splice(markerIndex, 1);
            }
        }

        this.renderLayerManagerPanel();
        this.paintMarkersOnMap();

        if (this.activeLayers.searchedPOIs.length === 0 && this.activeLayers.externalTracks.length === 0) {
            this.hideAllDetailPanels();
            if (typeof map !== 'undefined' && map) map.resize();
        }
    },

    removeTrack(index) {
        this.activeLayers.externalTracks.splice(index, 1);
        this.renderLayerManagerPanel();
        this.paintTracksOnMap();

        if (this.activeLayers.searchedPOIs.length === 0 && this.activeLayers.externalTracks.length === 0) {
            this.hideAllDetailPanels();
            if (typeof map !== 'undefined' && map) map.resize();
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    LayerManager.init();
});
