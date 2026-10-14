// script.js

// 1. Cargar preferencias guardadas en localStorage apuntando a la carpeta styles/[span_0](start_span)[span_0](end_span)
const savedStyle = localStorage.getItem('otromundo_style') || 'styles/osm.json';
const savedCursorShow = localStorage.getItem('otromundo_cursor_show') !== 'false';
const savedCursorSize = localStorage.getItem('otromundo_cursor_size') || '75';
const savedPitch = localStorage.getItem('otromundo_pitch') || '0';

// 2. Inicialización del mapa con MapLibre GL JS[span_1](start_span)[span_1](end_span)
const map = new maplibregl.Map({
    container: 'map',
    style: savedStyle, 
    center: [-5.9304, 37.3414], // Montequinto / Sevilla[span_2](start_span)[span_2](end_span)
    zoom: 12,
    pitch: parseFloat(savedPitch),
    attributionControl: false
});

// Control de geolocalización[span_3](start_span)[span_3](end_span)
const geolocateControl = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserLocation: true
});
map.addControl(geolocateControl);

// --- LÓGICA DEL PANEL DESLIZANTE DE MAPAS Y BARRA INFERIOR ---[span_4](start_span)[span_4](end_span)
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
    bottomToolbar.classList.add('hidden');
});

function closeLayerSelector() {
    modalSelector.classList.remove('active');
    bottomToolbar.classList.remove('hidden');
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
    });
});

// --- LÓGICA DE LA BARRA INFERIOR (GPS y Zoom) ---[span_5](start_span)[span_5](end_span)
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

// --- LÓGICA DEL CENTRO DE CONTROL Y AJUSTES ---[span_6](start_span)[span_6](end_span)
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

// Función global para acordeón[span_7](start_span)[span_7](end_span)
window.toggleAccordion = function(headerElement) {
    const card = headerElement.closest('.card-accordion');
    if (!card) return;
    
    card.classList.toggle('open');
    card.classList.toggle('expanded');

    const content = card.querySelector('.accordion-content');
    if (content) {
        if (card.classList.contains('open') || card.classList.contains('expanded')) {
            content.style.maxHeight = content.scrollHeight + "px";
        } else {
            content.style.maxHeight = null;
        }
    }
};

// Controles de Ajustes[span_8](start_span)[span_8](end_span)
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

// Botón flotante de recentrado GPS[span_9](start_span)[span_9](end_span)
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
