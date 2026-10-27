// overpass-client.js (Gestión de consultas directas a Overpass API para enriquecer PDI)

async function enriquecerPoiConOverpass(poi) {
    // Si el PDI no tiene un ID válido de OSM, salimos
    if (!poi || !poi.id) {
        showToast("⚠️ Este PDI no dispone de un ID de OpenStreetMap válido");
        return null;
    }

    // Determinamos si es un nodo (node) por defecto o si la estructura indica otra cosa
    const elementType = poi.type || "node"; 
    const elementId = poi.id;

    showToast("🔍 Consultando Overpass API...");

    // Consulta Overpass QL optimizada para un elemento específico
    const query = `
        [out:json][timeout:15];
        ${elementType}(${elementId});
        out body;
        >;
        out skel qt;
    `;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error en la red: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.elements || data.elements.length === 0) {
            showToast("⚠️ No se encontraron datos adicionales en Overpass");
            return null;
        }

        // Buscamos el elemento principal que coincida con el ID
        const elementoPrincipal = data.elements.find(el => el.id === elementId) || data.elements[0];
        
        if (elementoPrincipal && elementoPrincipal.tags) {
            // Actualizamos o fusionamos las etiquetas enriquecidas en el objeto del PDI
            poi.tagsEnriquecidas = elementoPrincipal.tags;
            poi.enriquecido = true;

            showToast("✨ ¡PDI enriquecido con éxito desde OSM!");
            return poi.tagsEnriquecidas;
        } else {
            showToast("ℹ️ El elemento no contiene etiquetas adicionales");
            return null;
        }

    } catch (error) {
        console.error("Error al consultar Overpass:", error);
        showToast("❌ Error al conectar con Overpass API");
        return null;
    }
}
