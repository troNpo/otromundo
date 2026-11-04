// ==========================================
// MAP-OVERLAYS.JS - Gestor Resiliente de Capas Complementarias (Waymarked Trails)
// ==========================================

const MapOverlays = {
    layersConfig: {
        hiking: {
            id: 'overlay-hiking-layer',
            sourceId: 'overlay-hiking-source',
            url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
            defaultOpacity: 0.8
        },
        cycling: {
            id: 'overlay-cycling-layer',
            sourceId: 'overlay-cycling-source',
            url: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
            defaultOpacity: 0.8
        },
        mtb: {
            id: 'overlay-mtb-layer',
            sourceId: 'overlay-mtb-source',
            url: 'https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png',
            defaultOpacity: 0.8
        }
    },

    activeLayers: new Set(),

    init() {
        this.setupEvents();
        this.setupStyleReloadListener();
        this.bindBasemapChangeEvents();
    },

    setupEvents() {
        const bindLayerEvents = (key) => {
            const chk = document.getElementById(`toggle-layer-${key}`);
            const range = document.getElementById(`range-opacity-${key}`);

            chk?.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.activeLayers.add(key);
                    this.addLayer(key);
                } else {
                    this.activeLayers.delete(key);
                    this.removeLayer(key);
                }
            });

            range?.addEventListener('input', (e) => {
                this.setOpacity(key, parseFloat(e.target.value));
            });
        };

        ['hiking', 'cycling', 'mtb'].forEach(bindLayerEvents);
    },

    bindBasemapChangeEvents() {
        const basemapInputs = document.querySelectorAll('input[name="basemap"]');
        basemapInputs.forEach(input => {
            input.addEventListener('change', () => {
                // Al cambiar de mapa base mediante radio buttons, agendamos la restauración
                setTimeout(() => this.restoreActiveLayers(), 400);
            });
        });
    },

    setupStyleReloadListener() {
        if (typeof map === 'undefined') return;

        // Escuchamos cuando MapLibre termina de renderizar el nuevo estilo por completo
        map.on('idle', () => {
            this._isMapIdle = true;
        });

        map.on('style.load', () => {
            this._isMapIdle = false;
            // Esperamos un margen generoso para que OpenTopoMap u otros mapas complejos terminen de reconstruirse
            setTimeout(() => {
                this.restoreActiveLayers();
            }, 500);
        });
    },

    restoreActiveLayers() {
        if (typeof map === 'undefined') return;

        this.activeLayers.forEach(key => {
            // Verificamos si la fuente ya existe en el nuevo estilo; si no, la recreamos con seguridad
            const config = this.layersConfig[key];
            if (config && !map.getSource(config.sourceId)) {
                this.addLayer(key);
            }
        });
    },

    addLayer(key) {
        const config = this.layersConfig[key];
        if (!config || typeof map === 'undefined') return;

        try {
            // Limpieza preventiva por si queda rastro previo
            if (map.getLayer(config.id)) map.removeLayer(config.id);
            if (map.getSource(config.sourceId)) map.removeSource(config.sourceId);

            map.addSource(config.sourceId, {
                type: 'raster',
                tiles: [config.url],
                tileSize: 256,
                attribution: '&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>'
            });

            const rangeInput = document.getElementById(`range-opacity-${key}`);
            const currentOpacity = rangeInput ? parseFloat(rangeInput.value) : config.defaultOpacity;

            map.addLayer({
                id: config.id,
                type: 'raster',
                source: config.sourceId,
                paint: {
                    'raster-opacity': currentOpacity
                }
            });
        } catch (err) {
            // Evita que un error de sincronización de estilo detenga la app
        }
    },

    removeLayer(key) {
        const config = this.layersConfig[key];
        if (!config || typeof map === 'undefined') return;

        try {
            if (map.getLayer(config.id)) map.removeLayer(config.id);
            if (map.getSource(config.sourceId)) map.removeSource(config.sourceId);
        } catch (err) {
            // Silencioso
        }
    },

    setOpacity(key, opacity) {
        const config = this.layersConfig[key];
        if (!config || typeof map === 'undefined') return;

        try {
            if (map.getLayer(config.id)) {
                map.setPaintProperty(config.id, 'raster-opacity', opacity);
            }
        } catch (err) {
            // Silencioso
        }
    }
};

window.MapOverlays = MapOverlays;
document.addEventListener('DOMContentLoaded', () => {
    MapOverlays.init();
});
