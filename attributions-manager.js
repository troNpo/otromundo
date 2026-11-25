(function() {
  "use strict";
  
  var isExpanded = false;
  
   var shortAttributions = {
    "styles/otromundo.json": "OtroMundo • © MapTiler © Esri • 3D Mapterhorn",
    "styles/osm.json": "OpenStreetMap • © OSM • 3D Mapterhorn",
    "styles/otromundotopo.json": "OtroMundoTopo • © MapTiler • 3D Mapterhorn",
"styles/osm.json": "OpenStreetMap • © OSM • 3D Mapterhorn",
    "styles/ignraster.json": "IGN España • © CNIG • 3D Mapterhorn",
    "styles/opentopomaps.json": "OpenTopoMap • © OSM • 3D Mapterhorn",
    "styles/esri.json": "Esri Satélite • © Esri • 3D Mapterhorn",

    "styles/thunderforest-opencyclemap.json": "TF OpenCycleMap • © Thunderforest © OSM • 3D Mapterhorn"
    // Añade aquí el resto de estilos JSON de Thunderforest que hayas creado
  };

  
  function getActiveAttributionText(stylePath) {
    var activeStyle = stylePath;
    if (!activeStyle) {
      try {
        activeStyle = localStorage.getItem("otromundo_style") || "styles/otromundo.json";
      } catch (e) {
        activeStyle = "styles/otromundo.json";
      }
    }
    return shortAttributions[activeStyle] || "OtroMundo • 3D Mapterhorn";
  }
  
  function updatePillText(stylePath) {
    var textEl = document.getElementById("otromundo-attribution-text");
    if (!textEl) return;
    textEl.textContent = getActiveAttributionText(stylePath);
  }
  
  function setExpandedState(expand) {
    isExpanded = expand;
    var pill = document.getElementById("otromundo-map-attribution-pill");
    var textEl = document.getElementById("otromundo-attribution-text");
    var modalBtn = document.getElementById("otromundo-attribution-more");
    if (!pill || !textEl || !modalBtn) return;
    
    if (isExpanded) {
      pill.style.padding = "4px 10px 4px 8px";
      pill.style.borderRadius = "22px";
      textEl.style.maxWidth = "240px";
      textEl.style.opacity = "1";
      textEl.style.marginLeft = "6px";
      modalBtn.style.display = "inline-flex";
    } else {
      pill.style.padding = "7px";
      pill.style.borderRadius = "50%";
      textEl.style.maxWidth = "0px";
      textEl.style.opacity = "0";
      textEl.style.marginLeft = "0px";
      modalBtn.style.display = "none";
    }
  }
  
  function createCollapsiblePill() {
    if (document.getElementById("otromundo-map-attribution-pill")) return;
    
    var pill = document.createElement("div");
    pill.id = "otromundo-map-attribution-pill";
    pill.title = "Atribuciones del mapa";
    
    // Posicionado en la esquina superior izquierda, centrado con el eje de la brújula
    pill.style.position = "absolute";
    pill.style.top = "76px";
    pill.style.left = "19px";
    pill.style.background = "rgba(18, 18, 20, 0.9)";
    pill.style.backdropFilter = "blur(8px)";
    pill.style.webkitBackdropFilter = "blur(8px)";
    pill.style.border = "1.5px solid #00e5ff";
    pill.style.borderRadius = "50%";
    pill.style.padding = "7px";
    pill.style.color = "#cfd8dc";
    pill.style.fontFamily = "sans-serif";
    pill.style.fontSize = "0.66rem";
    pill.style.letterSpacing = "0.2px";
    pill.style.display = "inline-flex";
    pill.style.alignItems = "center";
    pill.style.justifyContent = "center";
    pill.style.zIndex = "9";
    pill.style.cursor = "pointer";
    pill.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.4)";
    pill.style.transition = "all 0.25s ease";
    pill.style.userSelect = "none";
    
    var icon = document.createElement("img");
    icon.src = "ui-icons/fi-rr-info.svg";
    icon.width = 18;
    icon.height = 18;
    icon.alt = "Info";
    icon.style.filter = "brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg)";
    icon.style.flexShrink = "0";
    icon.style.display = "block";
    
    var textEl = document.createElement("span");
    textEl.id = "otromundo-attribution-text";
    textEl.textContent = getActiveAttributionText();
    textEl.style.maxWidth = "0px";
    textEl.style.opacity = "0";
    textEl.style.marginLeft = "0px";
    textEl.style.overflow = "hidden";
    textEl.style.whiteSpace = "nowrap";
    textEl.style.textOverflow = "ellipsis";
    textEl.style.transition = "all 0.25s ease";
    
    var modalBtn = document.createElement("span");
    modalBtn.id = "otromundo-attribution-more";
    modalBtn.textContent = "›";
    modalBtn.title = "Ver detalles completos";
    modalBtn.style.display = "none";
    modalBtn.style.alignItems = "center";
    modalBtn.style.justifyContent = "center";
    modalBtn.style.marginLeft = "6px";
    modalBtn.style.paddingLeft = "6px";
    modalBtn.style.borderLeft = "1px solid rgba(255, 255, 255, 0.15)";
    modalBtn.style.color = "#00e5ff";
    modalBtn.style.fontWeight = "bold";
    modalBtn.style.fontSize = "0.85rem";
    
    modalBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      if (window.RoutePlanner && typeof window.RoutePlanner.loadAttributionsContent === "function") {
        window.RoutePlanner.loadAttributionsContent();
      }
      var modal = document.getElementById("planner-attributions-modal");
      if (modal) {
        modal.style.display = "flex";
      }
    });
    
    pill.addEventListener("click", function(e) {
      e.stopPropagation();
      setExpandedState(!isExpanded);
    });
    
    document.addEventListener("click", function(e) {
      if (isExpanded && !pill.contains(e.target)) {
        setExpandedState(false);
      }
    });
    
    pill.appendChild(icon);
    pill.appendChild(textEl);
    pill.appendChild(modalBtn);
    document.body.appendChild(pill);
  }
  
  function init() {
    createCollapsiblePill();
    updatePillText();
    
    var radios = document.querySelectorAll('input[name="basemap"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener("change", function(e) {
        updatePillText(e.target.value);
      });
    }
  }
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();