// script.js

// 1. Cargar preferencias guardadas en localStorage apuntando a la carpeta styles/
const savedStyle = localStorage.getItem('otromundo_style') || 'styles/osm.json';
const savedCursorShow = localStorage.getItem('otromundo_cursor_show') !== 'false';
const savedCursorSize = localStorage.getItem('otromundo_cursor_size') || '75';
const savedPitch = localStorage.getItem('otromundo_pitch') || '0';

// 2. Inicialización del mapa con MapLibre GL JS
const map = new maplibregl.Map({
    container: 'map',
    style: savedStyle, 
    center: [-5.9304, 37.3414], // Montequinto / Sevilla
    zoom: 12,
    pitch: parseFloat(savedPitch),
    attributionControl: false
});

// Control de geolocalización
const geolocateControl = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserLocation: true
});
map.addControl(geolocateControl);

// --- LÓGICA DEL PANEL DESLIZANTE DE MAPAS Y BARRA INFERIOR ---
const btnMap = document.getElementById('btn-map');
const btnBack = document.getElementById('btn-back');
const modalSelector = document.getElementById('layer-selector-modal');
const bottomToolbar = document.getElementById('bottom-toolbar');

btnMap?.addEventListener('click', () => {
    const selectStyle = document.getElementById('select-style');
    const currentStyle = selectStyle ? selectStyle.value : savedStyle;
    const layerRadios = document.querySelectorAll('#layer-selector-modal input[type="radio"]');
    
    layerRadios.forEach(radio => {
        if (currentStyle.includes(radio.value) || radio.value === currentStyle) {
            radio.checked = true;
        }
    });

    modalSelector.classList.add('active');
    
    // Si la barra flotante de PDI está activa, mantenemos la barra general oculta
    const poiToolbar = document.getElementById('poi-map-toolbar');
    if (!poiToolbar && !window._isPlannerOpen) {
        bottomToolbar.classList.add('hidden');
    }

    // Ocultar también la barra inferior y zoom del planificador de rutas si está activo
    const routePlannerPanel = document.getElementById('route-planner-bottom-panel');
    if (routePlannerPanel && routePlannerPanel.style.display === 'flex') {
        routePlannerPanel.style.display = 'none';
        const zoomControls = document.getElementById('planner-zoom-controls');
        if (zoomControls) {
            zoomControls.classList.add('hidden');
            zoomControls.style.setProperty('display', 'none', 'important');
        }
    }
});

function closeLayerSelector() {
    modalSelector.classList.remove('active');
    
    const routePlannerPanel = document.getElementById('route-planner-bottom-panel');
    const zoomControls = document.getElementById('planner-zoom-controls');
    
    // Si el usuario abrió el selector de mapas desde el Planificador de Rutas, restauramos el planificador
    if (window._isPlannerOpen) {
        if (routePlannerPanel) routePlannerPanel.style.display = 'flex';
        if (zoomControls) {
            zoomControls.classList.remove('hidden');
            zoomControls.style.setProperty('display', 'flex', 'important');
        }
    } else {
        // Comportamiento normal en el mapa principal o vistas de PDI
        const poiToolbar = document.getElementById('poi-map-toolbar');
        if (!poiToolbar && bottomToolbar) {
            bottomToolbar.classList.remove('hidden');
        }
    }
}

btnBack?.addEventListener('click', closeLayerSelector);

const layerRadios = document.querySelectorAll('#layer-selector-modal input[type="radio"]');
layerRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const selectedStyle = e.target.value;
        map.setStyle(selectedStyle);
        
        const selectStyle = document.getElementById('select-style');
        if (selectStyle) {
            selectStyle.value = selectedStyle;
        }

        // Forzar que la barra general siga oculta si nos encontramos en el modo PDI
        const poiToolbar = document.getElementById('poi-map-toolbar');
        if (poiToolbar && bottomToolbar) {
            bottomToolbar.classList.add('hidden');
        }
    });
});

// --- LÓGICA DE LA BARRA INFERIOR (GPS y Zoom) ---
const btnGps = document.getElementById('btn-gps');
const gpsIcon = document.getElementById('gps-icon');
let isGpsActive = false;

btnGps?.addEventListener('click', () => {
    isGpsActive = !isGpsActive;
    if (isGpsActive) {
        gpsIcon.src = 'ui/fi-rr-location-crosshairs.svg';
        geolocateControl.trigger();
    } else {
        gpsIcon.src = 'ui/fi-rr-location-crosshairs-slash.svg';
    }
});

document.getElementById('btn-zoomin')?.addEventListener('click', () => {
    map.zoomIn({ duration: 300 });
});

document.getElementById('btn-zoomout')?.addEventListener('click', () => {
    map.zoomOut({ duration: 300 });
});

// --- LÓGICA DEL CENTRO DE CONTROL Y AJUSTES ---
const btnMenu = document.getElementById('btn-menu');
const btnClosePanel = document.getElementById('btn-close-panel');
const controlCenterPanel = document.getElementById('control-center-panel');
const btnSaveSettings = document.getElementById('btn-save-settings');

btnMenu?.addEventListener('click', () => {
    controlCenterPanel.classList.remove('hidden');
    bottomToolbar.classList.add('hidden');
});

btnClosePanel?.addEventListener('click', () => {
    controlCenterPanel.classList.add('hidden');
    bottomToolbar.classList.remove('hidden');
});

// Función global para acordeón
window.toggleAccordion = function(headerElement) {
    const card = headerElement.closest('.card-accordion');
    if (!card) return;
    
    card.classList.toggle('open');
    card.classList.toggle('expanded');
};

// Controles de Ajustes
const cursorContainer = document.getElementById('map-center-cursor');
const toggleCursor = document.getElementById('toggle-cursor');
const rangeCursorSize = document.getElementById('range-cursor-size');
const sizeValSpan = document.getElementById('size-val');

const rangePitch = document.getElementById('range-pitch');
const pitchValSpan = document.getElementById('pitch-val');
const selectStyle = document.getElementById('select-style');

if (toggleCursor) toggleCursor.checked = (savedCursorShow === true || savedCursorShow === 'true');
if (cursorContainer) {
    cursorContainer.style.display = toggleCursor?.checked ? 'block' : 'none';
    cursorContainer.style.width = savedCursorSize + 'px';
    cursorContainer.style.height = savedCursorSize + 'px';
}

if (rangeCursorSize) {
    rangeCursorSize.value = savedCursorSize;
    if (sizeValSpan) sizeValSpan.textContent = savedCursorSize;
}

if (rangePitch) {
    rangePitch.value = savedPitch;
    if (pitchValSpan) pitchValSpan.textContent = savedPitch;
}

if (selectStyle) {
    selectStyle.value = savedStyle;
}

toggleCursor?.addEventListener('change', (e) => {
    if (cursorContainer) cursorContainer.style.display = e.target.checked ? 'block' : 'none';
});

rangeCursorSize?.addEventListener('input', (e) => {
    const val = e.target.value;
    if (sizeValSpan) sizeValSpan.textContent = val;
    if (cursorContainer) {
        cursorContainer.style.width = val + 'px';
        cursorContainer.style.height = val + 'px';
    }
});

rangePitch?.addEventListener('input', (e) => {
    const pitchVal = parseFloat(e.target.value);
    if (pitchValSpan) pitchValSpan.textContent = pitchVal;
    map.setPitch(pitchVal);
});

selectStyle?.addEventListener('change', (e) => {
    const newStyle = e.target.value;
    map.setStyle(newStyle);
});

if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
        localStorage.setItem('otromundo_style', selectStyle.value);
        localStorage.setItem('otromundo_cursor_show', toggleCursor.checked);
        localStorage.setItem('otromundo_cursor_size', rangeCursorSize.value);
        localStorage.setItem('otromundo_pitch', rangePitch.value);
        showToast('¡Ajustes guardados correctamente!');
    });
}

// Botón flotante de recentrado GPS
const btnRecenter = document.getElementById('btn-recenter');
let userMovedMapManually = false;

map.on('movestart', (e) => {
    if (e.originalEvent && isGpsActive) {
        userMovedMapManually = true;
        btnRecenter?.classList.remove('hidden');
    }
});

btnRecenter?.addEventListener('click', () => {
    if (isGpsActive) {
        geolocateControl.trigger();
        userMovedMapManually = false;
        btnRecenter.classList.add('hidden');
    }
});

btnGps?.addEventListener('click', () => {
    setTimeout(() => {
        if (!isGpsActive && btnRecenter) {
            userMovedMapManually = false;
            btnRecenter.classList.add('hidden');
        }
    }, 50);
});

// --- NAVEGACIÓN DESDE EL CENTRO DE CONTROL AL PANEL DE POIS ---
const btnPoiCard = document.getElementById('btn-poi-card');
const poiFullscreenPanel = document.getElementById('poi-fullscreen-panel');
const btnBackToControl = document.getElementById('btn-back-to-control');

if (btnPoiCard && poiFullscreenPanel) {
    btnPoiCard.addEventListener('click', () => {
        controlCenterPanel.classList.add('hidden');    // Oculta el Centro de Control
        poiFullscreenPanel.classList.remove('hidden'); // Muestra el panel de POIs a pantalla completa
    });
}

if (btnBackToControl && poiFullscreenPanel) {
    btnBackToControl.addEventListener('click', () => {
        poiFullscreenPanel.classList.add('hidden');    // Oculta el panel de POIs
        controlCenterPanel.classList.remove('hidden'); // Regresa al Centro de Control
    });
}

// --- LÓGICA PARA EL PANEL DE ATRIBUCIONES ---
const btnOpenAttributions = document.getElementById('btn-open-attributions');
const btnCloseAttributions = document.getElementById('btn-close-attributions');
const attributionsPanel = document.getElementById('attributions-panel');
const attributionsContainerBody = document.getElementById('attributions-container-body');

btnOpenAttributions?.addEventListener('click', () => {
    controlCenterPanel.classList.add('hidden');
    attributionsPanel.classList.remove('hidden');

    if (attributionsContainerBody && attributionsContainerBody.children.length === 0) {
        attributionsContainerBody.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Cargando atribuciones...</p>';
        
        fetch('attributions.json')
            .then(response => {
                if (!response.ok) throw new Error('No se pudo cargar el archivo de atribuciones');
                return response.json();
            })
            .then(data => {
                attributionsContainerBody.innerHTML = '';
                data.forEach(item => {
                    const card = document.createElement('div');
                    card.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); padding: 14px; border-radius: 12px; display: flex; flex-direction: column; gap: 6px;';
                    
                    card.innerHTML = `
                        <strong style="color: var(--primary-cyan); font-size: 0.95rem;">${item.title}</strong>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-main); line-height: 1.4;">${item.description}</p>
                        ${item.link ? `<a href="${item.link}" target="_blank" rel="noopener noreferrer" style="color: var(--primary-cyan); font-size: 0.80rem; text-decoration: underline; margin-top: 4px;">${item.linkText || item.link}</a>` : ''}
                    `;
                    attributionsContainerBody.appendChild(card);
                });
            })
            .catch(error => {
                attributionsContainerBody.innerHTML = `<p style="color: #e74c3c; text-align: center;">Error al cargar las atribuciones: ${error.message}</p>`;
            });
    }
});

btnCloseAttributions?.addEventListener('click', () => {
    attributionsPanel.classList.add('hidden');
    controlCenterPanel.classList.remove('hidden');
});
