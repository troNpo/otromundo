// ==========================================
// ORUX_INTENT_HANDLER.JS - Integración con OruxMaps e Intents Externos (Soporte Terreno 3D)
// ==========================================

const OruxIntentHandler = {
  init() {
    this.checkIncomingCoordinates();
  },
  
  checkIncomingCoordinates() {
    const urlParams = new URLSearchParams(window.location.search);
    const latParam = urlParams.get('lat');
    const lonParam = urlParams.get('lon');
    
    if (!latParam || !lonParam) return;
    
    const lat = parseFloat(latParam);
    const lon = parseFloat(lonParam);
    
    if (isNaN(lat) || isNaN(lon)) return;
    
    // Limpiar parámetros de la URL para evitar recargas duplicadas en el futuro
    if (window.history && window.history.replaceState) {
      const cleanURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanURL }, '', cleanURL);
    }
    
    // Esperar a que el mapa esté completamente listo
    const waitForMap = setInterval(() => {
      const mapObj = window.map || (window.RoutePlanner && window.RoutePlanner.map);
      if (mapObj && typeof mapObj.jumpTo === 'function') {
        clearInterval(waitForMap);
        
        // Saltar directamente a la zona para que MapLibre descargue inmediatamente las teselas DEM de esa montaña
        mapObj.jumpTo({
          center: [lon, lat],
          zoom: 15,
          pitch: 0,
          bearing: 0
        });

        // Cuando el terreno 3D termine de cargar en esa zona, forzar actualización de proyección
        const snapToTerrain = () => {
          if (typeof mapObj.triggerRepaint === 'function') mapObj.triggerRepaint();
          if (window.RoutePlanner && typeof window.RoutePlanner.renderMarkers === 'function') {
            window.RoutePlanner.renderMarkers();
          }
        };

        mapObj.once('idle', snapToTerrain);
        
        // Mostrar modal de elección para OruxMaps
        this.showOruxActionModal([lon, lat]);
      }
    }, 150);
  },

  sync3DMarkersAfterAction(mapObj, coords) {
    if (!mapObj) return;
    const reproject = () => {
      mapObj.jumpTo({
        center: coords,
        zoom: mapObj.getZoom(),
        pitch: mapObj.getPitch(),
        bearing: mapObj.getBearing()
      });
      if (window.RoutePlanner && typeof window.RoutePlanner.renderMarkers === 'function') {
        window.RoutePlanner.renderMarkers();
      }
    };
    setTimeout(reproject, 250);
    mapObj.once('idle', reproject);
  },
  
  showOruxActionModal(coords) {
    // Eliminar modal previo si existiera
    document.getElementById('orux-action-modal')?.remove();
    
    const modalHTML = `
        <div id="orux-action-modal" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); z-index: 40000; display: flex; align-items: center; justify-content: center; padding: 20px; pointer-events: auto;">
            <div style="background: rgba(18, 18, 20, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1.5px solid rgba(0, 229, 255, 0.5); border-radius: 20px; padding: 20px; width: 100%; max-width: 320px; box-shadow: 0 12px 36px rgba(0,0,0,0.7); display: flex; flex-direction: column; align-items: center; gap: 14px; color: #fff; font-family: sans-serif;">
                
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <div style="font-size: 0.95rem; font-weight: bold; color: #00e5ff; display: flex; align-items: center; gap: 8px;">
                        <img src="./ui-icons/fi-rr-location-arrow.svg" width="18" height="18" style="filter: brightness(0) saturate(100%) invert(77%);" alt="Orux">
                        Posición desde OruxMaps
                    </div>
                    <button id="btn-close-orux-modal" style="background: rgba(255,255,255,0.1); border: none; color: #fff; width: 26px; height: 26px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <div style="font-size: 0.82rem; color: #ccc; text-align: center; line-height: 1.4;">
                    Lat: ${coords[1].toFixed(5)}, Lon: ${coords[0].toFixed(5)}<br>¿Qué deseas hacer con este punto?
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 4px;">
                    <button id="orux-btn-start-route" style="background: #00e5ff; color: #121212; border: none; padding: 11px; border-radius: 10px; font-weight: bold; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(0, 229, 255, 0.3);">
                        <img src="./ui-icons/fi-rr-square-plus.svg" width="16" height="16" style="filter: brightness(0);">
                        <span> Iniciar Ruta Aquí</span>
                    </button>

                    <button id="orux-btn-circular-route" style="background: rgba(0, 229, 255, 0.15); border: 1px solid #00e5ff; color: #00e5ff; padding: 11px; border-radius: 10px; font-weight: bold; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <img src="./ui-icons/fi-rr-rotate-right.svg" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(77%);">
                        <span> Generar Ruta Circular</span>
                    </button>

                    <button id="orux-btn-view-only" style="background: transparent; border: none; color: #aaa; padding: 8px; font-size: 0.78rem; cursor: pointer; text-decoration: underline;">
                        Solo ver en el mapa
                    </button>
                </div>

            </div>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const closeModal = () => document.getElementById('orux-action-modal')?.remove();
    const mapObj = window.map || (window.RoutePlanner && window.RoutePlanner.map);
    
    document.getElementById('btn-close-orux-modal').addEventListener('click', closeModal);
    document.getElementById('orux-btn-view-only').addEventListener('click', closeModal);
    
    // Acción 1: Iniciar Ruta
    document.getElementById('orux-btn-start-route').addEventListener('click', () => {
      closeModal();
      const planner = window.RoutePlanner;
      if (planner) {
        planner.addPoint(coords, "OruxMaps Inicio");
        planner.showToast("Punto inicial fijado desde OruxMaps");
        this.sync3DMarkersAfterAction(mapObj, coords);
      }
    });
    
    // Acción 2: Generar Ruta Circular
    document.getElementById('orux-btn-circular-route').addEventListener('click', () => {
      closeModal();
      const planner = window.RoutePlanner;
      if (planner && planner.circularManager) {
        planner.circularManager.activePoint = { lng: coords[0], lat: coords[1] };
        planner.circularManager.syncModalSelectWithApp();
        planner.circularManager.modalElement.style.display = 'flex';
        planner.showToast("Radar circular abierto en ubicación OruxMaps");
        this.sync3DMarkersAfterAction(mapObj, coords);
      }
    });
  }
};

window.OruxIntentHandler = OruxIntentHandler;
document.addEventListener('DOMContentLoaded', () => {
  OruxIntentHandler.init();
});
