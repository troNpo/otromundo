// ==========================================
// MÓDULO DE ORIENTACIÓN Y GEOCODIFICACIÓN NOMINATIM (OSM)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnBannerSearch = document.getElementById('btn-banner-search');
    const inputBannerSearch = document.getElementById('input-banner-search');
    const searchResultsDropdown = document.getElementById('visor-search-dropdown');
    const scaleText = document.getElementById('scale-text');
    const compassIcon = document.getElementById('compass-icon');
    
    let searchTimeout = null;
    let searchMarker = null; 
    let searchPopup = null;  
    let activePlaceCoords = null; 

    // Si los elementos de búsqueda están listos, inicializamos
    if (btnBannerSearch && inputBannerSearch && searchResultsDropdown) {
        // 1. Alternar expansión del input de búsqueda al pulsar la lupa
        btnBannerSearch.addEventListener('click', (e) => {
            e.stopPropagation();
            inputBannerSearch.classList.toggle('hidden');
            if (!inputBannerSearch.classList.contains('hidden')) {
                inputBannerSearch.focus();
            } else {
                searchResultsDropdown.classList.add('hidden');
                inputBannerSearch.value = '';
            }
        });

        // 2. Escuchar la entrada de texto en tiempo real con retardo (debounce)
        inputBannerSearch.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(searchTimeout);

            if (query.length < 3) {
                searchResultsDropdown.classList.add('hidden');
                searchResultsDropdown.innerHTML = '';
                return;
            }

            searchTimeout = setTimeout(() => {
                executeNominatimSearch(query);
            }, 300);
        });

        // 3. Capturar Enter en el teclado táctil móvil
        inputBannerSearch.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const query = inputBannerSearch.value.trim();
                if (query.length >= 3) {
                    clearTimeout(searchTimeout);
                    executeNominatimSearch(query);
                    inputBannerSearch.blur(); 
                }
            }
        });
    }

    // Función adaptada a Nominatim (OSM)
    async function executeNominatimSearch(query) {
        if (!searchResultsDropdown) return;
        searchResultsDropdown.innerHTML = `<div class="search-result-item" style="color: #eab308; padding: 12px; background: #121212;">Buscando en Nominatim...</div>`;
        searchResultsDropdown.classList.remove('hidden');

        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=8&countrycodes=es`;
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Xpain-Maps-App' }
            });
            const data = await response.json();
            
            const results = data.map(item => {
                let targetZoom = 15; 
                const classType = item.class;
                const type = item.type;

                if (classType === 'boundary' || type === 'administrative' || type === 'city' || type === 'town') {
                    targetZoom = 13;
                } else if (type === 'peak' || classType === 'natural' || type === 'volcano') {
                    targetZoom = 12.5; 
                } else if (targetZoom > 14) {
                    targetZoom = 14; 
                }

                return {
                    name: item.display_name,
                    lon: parseFloat(item.lon),
                    lat: parseFloat(item.lat),
                    zoom: targetZoom
                };
            }).filter(r => !isNaN(r.lon) && !isNaN(r.lat));

            renderSearchResults(results);

        } catch (error) {
            console.error("Error en Nominatim:", error);
            if (searchResultsDropdown) {
                searchResultsDropdown.innerHTML = `<div class="search-result-item" style="color: #dc2626; padding: 12px; background: #121212;">Error de conexión con Nominatim</div>`;
                searchResultsDropdown.classList.remove('hidden');
            }
        }
    }

    // Renderizar los resultados con zoom limitado y marcador con popup inteligente
    function renderSearchResults(results) {
        if (!searchResultsDropdown) return;
        searchResultsDropdown.innerHTML = '';
        searchResultsDropdown.classList.remove('hidden');

        if (!results || results.length === 0) {
            searchResultsDropdown.innerHTML = '<div class="search-result-item" style="color: #9ca3af; padding: 12px; background: #121212;">No se encontraron resultados</div>';
            return;
        }

        results.forEach(place => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = place.name;
            
            div.addEventListener('click', () => {
                if (typeof map !== 'undefined' && map.flyTo) {
                    activePlaceCoords = [place.lon, place.lat];

                    map.flyTo({
                        center: activePlaceCoords,
                        zoom: place.zoom,
                        duration: 2000
                    });

                    if (searchMarker) searchMarker.remove();
                    if (searchPopup) searchPopup.remove();

                    const el = document.createElement('div');
                    el.className = 'search-marker-pin';
                    el.style.width = '20px';
                    el.style.height = '20px';
                    el.style.backgroundColor = '#dc2626';
                    el.style.border = '2px solid #ffffff';
                    el.style.borderRadius = '50%';
                    el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                    el.style.cursor = 'pointer';

                    const popupContent = document.createElement('div');
                    popupContent.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(18, 18, 18, 0.95); backdrop-filter: blur(8px); color: #ffffff; padding: 6px 12px 6px 14px; border-radius: 9999px; font-family: sans-serif; font-size: 13px; max-width: 280px; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.4);";
                    
                    const textSpan = document.createElement('span');
                    textSpan.style.cssText = "overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;";
                    textSpan.textContent = place.name;
                    textSpan.title = place.name;

                    const trashBtn = document.createElement('button');
                    trashBtn.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 50%;";
                    trashBtn.innerHTML = `<img src="ui-icons/fi-rr-trash.svg" style="width: 16px; height: 16px; display: block;" alt="Borrar">`;
                    trashBtn.title = "Borrar marcador";

                    trashBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        if (searchMarker) { searchMarker.remove(); searchMarker = null; }
                        if (searchPopup) { searchPopup.remove(); searchPopup = null; }
                        activePlaceCoords = null;
                    });

                    popupContent.appendChild(textSpan);
                    popupContent.appendChild(trashBtn);

                    searchPopup = new maplibregl.Popup({
                        closeButton: false,
                        closeOnClick: false,
                        offset: 25
                    }).setDOMContent(popupContent);

                    searchMarker = new maplibregl.Marker(el)
                        .setLngLat(activePlaceCoords)
                        .setPopup(searchPopup)
                        .addTo(map);

                    searchMarker.togglePopup();

                    el.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        searchMarker.togglePopup();
                    });
                }

                searchResultsDropdown.classList.add('hidden');
                if (inputBannerSearch) {
                    inputBannerSearch.classList.add('hidden');
                    inputBannerSearch.value = place.name;
                }
            });
            
            searchResultsDropdown.appendChild(div);
        });
    }

    // Cerrar el desplegable al hacer clic fuera
    document.addEventListener('click', (e) => {
        const searchContainer = document.getElementById('banner-search-container') || (btnBannerSearch ? btnBannerSearch.parentElement : null);
        if (searchContainer && !searchContainer.contains(e.target) && searchResultsDropdown && !searchResultsDropdown.contains(e.target)) {
            searchResultsDropdown.classList.add('hidden');
        }
    });

    // ==========================================
    // INTEGRACIÓN BRÚJULA, ESCALA Y CONTROL DE POPUP
    // ==========================================
    if (typeof map !== 'undefined') {
        map.on('load', updateMapMetrics);
        map.on('move', () => {
            updateMapMetrics();
            checkPopupVisibilityByCenter();
        });
        map.on('zoom', updateMapMetrics);

        if (compassIcon && compassIcon.parentElement) {
            compassIcon.parentElement.addEventListener('click', () => {
                map.resetNorth({ duration: 1000 });
            });
        }
    }

    function checkPopupVisibilityByCenter() {
        if (!searchMarker || !searchPopup || !activePlaceCoords) return;

        const mapCenter = map.getCenter();
        const distance = Math.hypot(mapCenter.lng - activePlaceCoords[0], mapCenter.lat - activePlaceCoords[1]);
        const threshold = 0.015 / Math.pow(2, map.getZoom() - 10); 

        const isVisible = searchPopup.isOpen();
        if (distance > threshold && isVisible) {
            searchPopup.remove(); 
        } else if (distance <= threshold && !isVisible && searchMarker) {
            searchPopup.addTo(map); 
        }
    }

    function updateMapMetrics() {
        if (!map) return;

        const bearing = map.getBearing();
        if (compassIcon) {
            compassIcon.style.transform = `rotate(${-bearing}deg)`;
        }

        if (scaleText) {
            const center = map.getCenter();
            const zoom = map.getZoom();
            const resolution = (156543.03392 * Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom);
            const scaleMeters = resolution * 60; 

            if (scaleMeters >= 1000) {
                scaleText.textContent = (scaleMeters / 1000).toFixed(1) + ' km';
            } else {
                scaleText.textContent = Math.round(scaleMeters) + ' m';
            }
        }
    }
});
