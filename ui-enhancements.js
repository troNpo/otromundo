// ==========================================
// UI-ENHANCEMENTS.JS - Diana inteligente en PC, Botón Finalizar (Estado Dual Corporativo) y Control 2D/3D independiente
// ==========================================

const UIEnhancementsManager = {
  isMouseDetected: false,
  isRouteFinalized: false,
  
  init() {
    this.setupCrosshairMouseDetection();
    this.setupFinishFloatingButton();
    this.setupCompassAnd2D3DControls();
  },
  
  // ==========================================
  // 1. OCULTAR DIANA CENTRAL SI SE DETECTA RATÓN
  // ==========================================
  setupCrosshairMouseDetection() {
    const isFinePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    if (isFinePointer) {
      this.isMouseDetected = true;
      this.applyCrosshairVisibility();
    }
    
    window.addEventListener("mousemove", (e) => {
      if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      if (!this.isMouseDetected) {
        this.isMouseDetected = true;
        this.applyCrosshairVisibility();
      }
    }, { passive: true });
    
    window.addEventListener("touchstart", () => {
      if (this.isMouseDetected && !isFinePointer) {
        this.isMouseDetected = false;
        this.applyCrosshairVisibility();
      }
    }, { passive: true });
  },
  
  applyCrosshairVisibility() {
    const selectors = [
      "#center-crosshair",
      ".center-crosshair",
      "#planner-crosshair",
      ".map-crosshair",
      "#crosshair"
    ];
    
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.display = this.isMouseDetected ? "none" : "";
      });
    });
  },
  
  // ==========================================
  // 2. BOTÓN FLOTANTE "FINALIZAR / REANUDAR EDICIÓN" (ESTILO CORPORATIVO INVERTIDO)
  // ==========================================
  setupFinishFloatingButton() {
    if (document.getElementById("planner-btn-finish")) return;
    
    const btnFinish = document.createElement("button");
    btnFinish.id = "planner-btn-finish";
    btnFinish.type = "button";
    btnFinish.className = "planner-float-btn";
    btnFinish.title = "Finalizar edición de ruta";
    
    // Estado Edición Activa (Estilo corporativo estándar: fondo oscuro #121214, borde cian #00e5ff, icono cian)
    btnFinish.style.cssText = `
            position: fixed;
            bottom: 196px;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(18, 18, 20, 0.9);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1.5px solid #00e5ff;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            cursor: pointer;
            transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
        `;
    
    const checkIconHtml = `<img src="ui-icons/fi-rr-check.svg" width="20" height="20" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg); pointer-events: none; display: block;" alt="Finalizar">`;
    const pencilIconHtml = `<img src="ui-icons/fi-rr-pencil.svg" width="19" height="19" style="filter: brightness(0); pointer-events: none; display: block;" alt="Editar">`;
    
    btnFinish.innerHTML = checkIconHtml;
    document.body.appendChild(btnFinish);
    
    // Bloquear inserción de nuevos puntos o puntos intermedios mientras la ruta está finalizada
    const hookPlannerMethods = setInterval(() => {
      const planner = window.RoutePlanner;
      if (planner && typeof planner.addPoint === "function" && !planner._finishHooked) {
        planner._finishHooked = true;
        
        const originalAddPoint = planner.addPoint.bind(planner);
        planner.addPoint = (...args) => {
          if (this.isRouteFinalized) {
            planner.showToast?.("Ruta finalizada. Pulsa el lápiz para seguir editando");
            return;
          }
          return originalAddPoint(...args);
        };
        
        if (typeof planner.insertIntermediatePoint === "function") {
          const originalInsertPoint = planner.insertIntermediatePoint.bind(planner);
          planner.insertIntermediatePoint = (...args) => {
            if (this.isRouteFinalized) {
              planner.showToast?.("Ruta finalizada. Pulsa el lápiz para seguir editando");
              return;
            }
            return originalInsertPoint(...args);
          };
        }
      }
    }, 200);
    
    const applyFinalizedVisualState = () => {
      const planner = window.RoutePlanner;
      const lockBtn = document.getElementById("planner-btn-touch-lock");
      
      if (this.isRouteFinalized) {
        // Estado Finalizado (Colores corporativos invertidos: fondo cian #00e5ff, icono negro, borde oscuro)
        btnFinish.style.background = "#00e5ff";
        btnFinish.style.borderColor = "#121214";
        btnFinish.style.boxShadow = "0 4px 16px rgba(0, 229, 255, 0.5)";
        btnFinish.title = "Ruta finalizada (Pulsa para volver a editar)";
        btnFinish.innerHTML = pencilIconHtml;
        
        if (lockBtn) lockBtn.style.visibility = "hidden";
        if (planner?._cursorMarker) {
          planner._cursorMarker.remove();
          planner._cursorMarker = null;
        }
        if (window.map && window.map.getLayer("cursor-helper-layer")) {
          window.map.setLayoutProperty("cursor-helper-layer", "visibility", "none");
        }
      } else {
        // Estado Edición Activa (Colores corporativos base: fondo oscuro #121214, borde cian #00e5ff, icono cian)
        btnFinish.style.background = "rgba(18, 18, 20, 0.9)";
        btnFinish.style.borderColor = "#00e5ff";
        btnFinish.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5)";
        btnFinish.title = "Finalizar ruta";
        btnFinish.innerHTML = checkIconHtml;
        
        if (lockBtn) lockBtn.style.visibility = "visible";
        if (window.map && window.map.getLayer("cursor-helper-layer")) {
          window.map.setLayoutProperty("cursor-helper-layer", "visibility", "visible");
        }
        planner?.updateDynamicCursorLine?.();
      }
    };
    
    btnFinish.addEventListener("click", (e) => {
      e.stopPropagation();
      this.isRouteFinalized = !this.isRouteFinalized;
      applyFinalizedVisualState();
      
      if (this.isRouteFinalized) {
        window.RoutePlanner?.showToast?.("Ruta finalizada (edición bloqueada)");
      } else {
        window.RoutePlanner?.showToast?.("Edición de ruta reactivada");
      }
    });
    
    // Sincronizar posición y visibilidad respecto al candado
    const syncFinishButtonState = () => {
      const planner = window.RoutePlanner;
      const lockBtn = document.getElementById("planner-btn-touch-lock");
      if (!planner || !btnFinish) return;
      
      const hasRoute = Array.isArray(planner.points) && planner.points.length >= 2;
      
      if (!hasRoute && this.isRouteFinalized) {
        this.isRouteFinalized = false;
        applyFinalizedVisualState();
      }
      
      btnFinish.style.display = hasRoute ? "flex" : "none";
      
      if (lockBtn) {
        const lockRect = lockBtn.getBoundingClientRect();
        if (lockRect.width > 0) {
          btnFinish.style.left = `${lockRect.left}px`;
          btnFinish.style.top = `${lockRect.top - 54}px`;
          btnFinish.style.bottom = "auto";
        }
      }
    };
    
    setInterval(syncFinishButtonState, 200);
  },
  
  // ==========================================
  // 3. BRÚJULA (SOLO NORTE) + BOTÓN FLOTANTE 2D / 3D
  // ==========================================
  setupCompassAnd2D3DControls() {
    const waitForMap = setInterval(() => {
      const mapObj = window.map;
      if (!mapObj || typeof mapObj.on !== "function") return;
      clearInterval(waitForMap);
      
      // A) Interceptar el clic en la brújula nativa de MapLibre para resetear SOLO el norte (bearing: 0) sin tocar el pitch 3D
      document.addEventListener("click", (e) => {
        const compassBtn = e.target.closest(".maplibregl-ctrl-compass");
        if (compassBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          mapObj.easeTo({
            bearing: 0,
            pitch: mapObj.getPitch(),
            duration: 350
          });
        }
      }, true);
      
      // B) Crear el botón flotante 2D / 3D alineado en el eje superior izquierdo (debajo del botón de info)
      if (document.getElementById("otromundo-btn-2d3d")) return;
      
      const btn2D3D = document.createElement("button");
      btn2D3D.id = "otromundo-btn-2d3d";
      btn2D3D.type = "button";
      btn2D3D.title = "Alternar vista 2D / 3D";
      btn2D3D.style.cssText = `
                position: absolute;
                top: 120px;
                left: 19px;
                width: 34px;
                height: 34px;
                border-radius: 50%;
                background: rgba(18, 18, 20, 0.9);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1.5px solid #00e5ff;
                color: #00e5ff;
                font-family: sans-serif;
                font-size: 0.72rem;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9;
                cursor: pointer;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
                user-select: none;
                padding: 0;
            `;
      
      const updateButtonLabel = () => {
        const currentPitch = mapObj.getPitch();
        btn2D3D.innerText = currentPitch > 15 ? "2D" : "3D";
      };
      
      updateButtonLabel();
      mapObj.on("pitch", updateButtonLabel);
      mapObj.on("pitchend", updateButtonLabel);
      
      btn2D3D.addEventListener("click", (e) => {
        e.stopPropagation();
        const isCurrently3D = mapObj.getPitch() > 15;
        mapObj.easeTo({
          pitch: isCurrently3D ? 0 : 60,
          duration: 450
        });
      });
      
      document.body.appendChild(btn2D3D);
    }, 150);
  }
};

window.UIEnhancementsManager = UIEnhancementsManager;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => UIEnhancementsManager.init());
} else {
  UIEnhancementsManager.init();
}