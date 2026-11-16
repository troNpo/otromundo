// ==========================================
// ORUX-INTEGRATION.JS - Sincronización Avanzada con OruxMaps (Intents + Mapas Estilizados)
// ==========================================

const OruxIntegrationManager = {
    init() {
        this.injectIntegrationCard();
    },
    
    // Inyecta la tarjeta de integración arriba del todo en el panel lateral de opciones
    injectIntegrationCard() {
        const optionsDrawerBody = document.querySelector("#side-panel-planner-options .side-drawer-body");
        if (!optionsDrawerBody || document.getElementById("planner-orux-integration-card")) return;
        
        const card = document.createElement("div");
        card.id = "planner-orux-integration-card";
        card.style.cssText = `
            background: #000000; 
            border: 1.5px solid #ff3b30; 
            border-radius: 14px; 
            padding: 14px; 
            display: flex; 
            align-items: center; 
            gap: 12px; 
            cursor: pointer; 
            box-shadow: 0 4px 16px rgba(255, 59, 48, 0.2);
            transition: all 0.2s ease;
            margin-bottom: 4px;
        `;
        
        card.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <img src="ui-icons/logo_rojo.png" width="28" height="28" style="object-fit: contain; display: block;" alt="OruxMaps">
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: bold; color: #ff3b30; font-size: 0.9rem; margin-bottom: 2px;">Integración con OruxMaps</div>
                <div style="color: #aaa; font-size: 0.78rem; line-height: 1.3;">GeoIntents y descarga de mapa vectorial OtroMundo.map.json</div>
            </div>
            <div style="color: #ff3b30; font-size: 1rem; font-weight: bold;">›</div>
        `;
        
        card.addEventListener("click", () => {
            this.openModal();
            document.getElementById("side-panel-planner-options")?.classList.remove("active");
        });
        
        optionsDrawerBody.insertBefore(card, optionsDrawerBody.firstChild);
    },
    
    // Construye y abre el modal desplegable con las dos herramientas
    openModal() {
        document.getElementById("orux-integration-modal")?.remove();
        
        const modalHTML = `
        <div id="orux-integration-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 20000; display: flex; align-items: center; justify-content: center; padding: 16px; pointer-events: auto;">
            <div style="background: #121214; border: 1.5px solid #ff3b30; border-radius: 18px; width: 100%; max-width: 440px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.8); color: #fff; font-family: sans-serif;">
                
                <!-- Cabecera -->
                <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; background: rgba(255, 59, 48, 0.08);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="ui-icons/logo_rojo.png" width="24" height="24" style="object-fit: contain; display: block;">
                        <h3 style="margin: 0; color: #ff3b30; font-size: 1.05rem;">Integración OruxMaps</h3>
                    </div>
                    <button id="btn-close-orux-integration-modal" style="background: transparent; border: none; color: #aaa; font-size: 1.2rem; cursor: pointer; padding: 4px;">✕</button>
                </div>

                <!-- Contenido con scroll -->
                <div style="padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; font-size: 0.85rem;">
                    
                    <!-- SECCIÓN 1: INTENTS OruxMaps -->
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                        <div style="font-weight: bold; color: #ff3b30; display: flex; align-items: center; gap: 6px;">
                            <span>1. Configurar GeoIntents de Acceso desde OruxMaps</span>
                        </div>
                        <div style="color: #ccc; font-size: 0.80rem; line-height: 1.4;">
                            Copia esta URL para crear GeoIntents en OruxMaps. Podrás usar "compartir posición" para abrir cualquier punto directamente en el planificador OtroMundo:
                        </div>
                        
                        <div style="display: flex; gap: 6px;">
                            <input type="text" id="orux-intent-url-input" readonly value="https://tronpo.github.io/otromundo/?lat=[lat]&lon=[lon]" style="background: #09090b; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #00e5ff; font-family: monospace; font-size: 0.78rem; padding: 8px 10px; flex: 1; outline: none;">
                            <button id="btn-copy-orux-intent" style="background: #ff3b30; color: #fff; border: none; border-radius: 8px; padding: 0 12px; font-weight: bold; font-size: 0.8rem; cursor: pointer; white-space: nowrap;">Copiar</button>
                        </div>
                        <div id="orux-intent-copied-msg" style="color: #4caf50; font-size: 0.75rem; display: none;">¡URL copiada al portapapeles!</div>
                    </div>

                    <!-- SECCIÓN 2: MAPA OtroMundo.map.json -->
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                        <div style="font-weight: bold; color: #ff3b30; display: flex; align-items: center; gap: 6px;">
                            <span>2. Exportar Estilo para OruxMaps</span>
                        </div>
                        <div style="color: #ccc; font-size: 0.80rem; line-height: 1.4;">
                            Introduce tu clave de MapTiler para generar y descargar el archivo <code style="color: #00e5ff;">OtroMundo.map.json</code> listo para colocar en la carpeta de mapas de OruxMaps.
                        </div>

                        <!-- Nota de compatibilidad -->
                        <div style="background: rgba(0, 229, 255, 0.08); border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 8px; padding: 8px 10px; font-size: 0.75rem; color: #00e5ff; line-height: 1.35;">
                            Compatible con la suscripción a Mapbox. OruxMaps NG / OruxMaps GP / OruxMaps iOS.
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                            <label style="color: #aaa; font-size: 0.75rem;">Tu MapTiler API Key (Opcional):</label>
                            <input type="text" id="orux-maptiler-key-input" placeholder="Pega tu clave o déjalo vacío para editarlo tú..." style="background: #09090b; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; font-size: 0.82rem; padding: 8px 10px; outline: none;">
                        </div>

                        <button id="btn-download-orux-json" style="background: #00e5ff; color: #121212; border: none; border-radius: 10px; padding: 10px; font-weight: bold; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; box-shadow: 0 4px 12px rgba(0,229,255,0.3);">
                            <img src="ui-icons/fi-rr-file-download.svg" width="18" height="18" style="filter: brightness(0);" alt="Descargar">
                            <span>Descargar OtroMundo.map.json</span>
                        </button>
                        <div style="color: #888; font-size: 0.72rem; text-align: center; line-height: 1.3;">
                            Si lo dejas en blanco, se descargará con el marcador <code style="color: #aaa;">{{API_KEY}}</code> para que lo edites manualmente.
                        </div>
                    </div>

                </div>

            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const closeModal = () => document.getElementById('orux-integration-modal')?.remove();
        
        document.getElementById('btn-close-orux-integration-modal').addEventListener('click', closeModal);
        document.getElementById('orux-integration-modal').addEventListener('click', (e) => {
            if (e.target.id === 'orux-integration-modal') closeModal();
        });
        
        // Copiar Intent
        document.getElementById('btn-copy-orux-intent').addEventListener('click', () => {
            const input = document.getElementById('orux-intent-url-input');
            input.select();
            input.setSelectionRange(0, 99999);
            document.execCommand('copy');
            
            const msg = document.getElementById('orux-intent-copied-msg');
            msg.style.display = 'block';
            setTimeout(() => { msg.style.display = 'none'; }, 2500);
        });
        
        // Descargar JSON con o sin API Key inyectada
        document.getElementById('btn-download-orux-json').addEventListener('click', async () => {
            const apiKeyInput = document.getElementById('orux-maptiler-key-input').value.trim();
            
            try {
                const response = await fetch('styles/otromundo.json');
                if (!response.ok) throw new Error("No se pudo cargar el archivo base");
                
                let styleText = await response.text();
                
                if (apiKeyInput) {
                    styleText = styleText.replace(/\{\{API_KEY\}\}/g, apiKeyInput);
                } else {
                    styleText = styleText.replace(/(\?key=|&key=)[^"&'\s}]+/g, '$1{{API_KEY}}');
                }
                
                const blob = new Blob([styleText], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'OtroMundo.map.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                if (window.RoutePlanner && typeof window.RoutePlanner.showToast === 'function') {
                    const msg = apiKeyInput ?
                        "OtroMundo.map.json descargado con tu API Key" :
                        "Plantilla OtroMundo.map.json descargada (sin API Key)";
                    window.RoutePlanner.showToast(msg);
                }
                closeModal();
            } catch (err) {
                console.error("Error al empaquetar el mapa para OruxMaps:", err);
                if (window.RoutePlanner && typeof window.RoutePlanner.showToast === 'function') {
                    window.RoutePlanner.showToast("Error al generar el archivo. Comprueba tu conexión.");
                }
            }
        });
    }
};

window.OruxIntegrationManager = OruxIntegrationManager;
document.addEventListener("DOMContentLoaded", () => {
    OruxIntegrationManager.init();
});