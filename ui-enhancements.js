// ==========================================
// UI-ENHANCEMENTS.JS - Diana inteligente en PC (visible en móvil), Botón Finalizar y Control 2D/3D
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
  // 1. OCULTAR DIANA CENTRAL SOLO EN PC (VISIBLE EN MÓVIL)
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
      }
      this.applyCrosshairVisibility();
    }, { passive: true });
    
    window.addEventListener("touchstart", () => {
      if (this.isMouseDetected && !isFinePointer) {
        this.isMouseDetected = false;
        this.applyCrosshairVisibility();
      }
    }, { passive: true });

    const observer = new MutationObserver(() => {
      if (this.isMouseDetected && isFinePointer) {
        this.applyCrosshairVisibility();
      }
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  },
  
  applyCrosshairVisibility() {
    const isFinePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    // Si estamos en móvil/táctil, nos aseguramos de que la diana NUNCA se oculte
    const shouldHide = this.isMouseDetected && isFinePointer;

    const selectors = [
      "#center-crosshair",
      ".center-crosshair",
      "#planner-crosshair",
      ".map-crosshair",
      "#crosshair",
      "#map-center-target",
      ".map-center-target",
      "[id*='crosshair']",
      "[class*='crosshair']",
      "[id*='reticle']",
      "[class*='reticle']",
      "[id*='diana']",
      "[class*='diana']"
    ];
    
    const foundElements = new Set();
    selectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => foundElements.add(el));
      } catch (e) {}
    });

    if (foundElements.size === 0) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      document.querySelectorAll("div, svg, img").forEach(el => {
        if (el.id === "map" || el.closest("#map")) return;
        const style = window.getComputedStyle(el);
        if ((style.position === "fixed" || style.position === "absolute") && style.pointerEvents === "none") {
          const rect = el.getBoundingClientRect();
          if (rect.width > 10 && rect.width < 90 && rect.height > 10 && rect.height < 90) {
            const elCenterX = rect.left + rect.width / 2;
            const elCenterY = rect.top + rect.height / 2;
            if (Math.abs(elCenterX - centerX) < 12 && Math.abs(elCenterY - centerY) < 12) {
              foundElements.add(el);
            }
          }
        }
      });
    }

    foundElements.forEach(el => {
      if (shouldHide) {
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("opacity", "0", "important");
      } else {
        el.style.removeProperty("display");
        el.style.removeProperty("opacity");
      }
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

    const updateMarkersLockState = (locked) => {
      const planner = window.RoutePlanner;
      if (!planner || !Array.isArray(planner.markers)) return;

      planner.markers.forEach(marker => {
        if (typeof marker.setDraggable === "function") {
          marker.setDraggable(!locked);
        }
        const el = marker.getElement?.();
        if (el) {
          el.style.cursor = locked ? "default" : "grab";
          el.style.pointerEvents = locked ? "none" : "auto";
        }
      });
    };
    
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

        if (typeof planner.renderMarkers === "function") {
          const originalRenderMarkers = planner.renderMarkers.bind(planner);
          planner.renderMarkers = (...args) => {
            const res = originalRenderMarkers(...args);
            if (this.isRouteFinalized) {
              updateMarkersLockState(true);
            }
            return res;
          };
        }
      }
    }, 200);
    
    const applyFinalizedVisualState = () => {
      const planner = window.RoutePlanner;
      const lockBtn = document.getElementById("planner-btn-touch-lock");
      
      if (this.isRouteFinalized) {
        btnFinish.style.background = "#00e5ff";
        btnFinish.style.borderColor = "#121214";
        btnFinish.style.boxShadow = "0 4px 16px rgba(0, 229, 255, 0.5)";
        btnFinish.title = "Ruta finalizada (Pulsa para volver a editar)";
        btnFinish.innerHTML = pencilIconHtml;
        
        updateMarkersLockState(true);

        if (lockBtn) lockBtn.style.visibility = "hidden";
        if (planner?._cursorMarker) {
          planner._cursorMarker.remove();
          planner._cursorMarker = null;
        }
        if (window.map && window.map.getLayer("cursor-helper-layer")) {
          window.map.setLayoutProperty("cursor-helper-layer", "visibility", "none");
        }
      } else {
        btnFinish.style.background = "rgba(18, 18, 20, 0.9)";
        btnFinish.style.borderColor = "#00e5ff";
        btnFinish.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5)";
        btnFinish.title = "Finalizar ruta";
        btnFinish.innerHTML = checkIconHtml;

        updateMarkersLockState(false);
        
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
