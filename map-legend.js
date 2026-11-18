// ==========================================
// MAP-LEGEND.JS - Panel Lateral Deslizante de Leyenda del Estilo OtroMundo
// ==========================================

const MapLegendManager = {
    init() {
        this.injectLegendButtonInMapsPanel();
        this.setupSideDrawer();
    },

    injectLegendButtonInMapsPanel() {
        const waitForDrawer = setInterval(() => {
            const mapsDrawerBody = document.querySelector("#side-panel-maps .side-drawer-body");
            if (!mapsDrawerBody) return;

            const otromundoCard = mapsDrawerBody.querySelector('input[value="styles/otromundo.json"]')?.closest('.map-option-card') || mapsDrawerBody.querySelector('label');
            if (!otromundoCard || document.getElementById("btn-open-map-legend")) {
                if (otromundoCard && document.getElementById("btn-open-map-legend")) clearInterval(waitForDrawer);
                return;
            }

            otromundoCard.style.display = "flex";
            otromundoCard.style.alignItems = "center";
            otromundoCard.style.justifyContent = "space-between";

            const legendBtn = document.createElement("button");
            legendBtn.id = "btn-open-map-legend";
            legendBtn.type = "button";
            legendBtn.title = "Ver leyenda del estilo OtroMundo";
            legendBtn.style.cssText = `
                background: rgba(0, 229, 255, 0.12);
                border: 1px solid rgba(0, 229, 255, 0.4);
                color: #00e5ff;
                border-radius: 8px;
                padding: 4px 8px;
                font-size: 0.72rem;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 5px;
                cursor: pointer;
                transition: background 0.2s ease, transform 0.15s ease;
                flex-shrink: 0;
            `;

            legendBtn.innerHTML = `
                <img src="ui-icons/fi-rr-map.svg" width="14" height="14" style="filter: brightness(0) saturate(100%) invert(77%); pointer-events: none;" alt="Leyenda">
                <span>Leyenda</span>
            `;

            legendBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById("side-panel-maps")?.classList.remove("active");
                this.openDrawer();
            });

            otromundoCard.appendChild(legendBtn);
            clearInterval(waitForDrawer);
        }, 150);
    },

    // Genera la muestra SVG fiel al estilo MapLibre de cada línea
    renderLineSwatch(options) {
        const {
            color = "#ffffff",
            width = 3,
            dasharray = "",
            casingColor = null,
            casingWidth = 5,
            opacity = 1
        } = options;

        const dashAttr = dasharray ? `stroke-dasharray="${dasharray}"` : "";
        const casingLine = casingColor
            ? `<line x1="4" y1="12" x2="52" y2="12" stroke="${casingColor}" stroke-width="${casingWidth}" stroke-linecap="round" />`
            : "";

        return `
            <svg width="56" height="24" viewBox="0 0 56 24" style="flex-shrink: 0; background: rgba(255,255,255,0.04); border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
                ${casingLine}
                <line x1="4" y1="12" x2="52" y2="12" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-opacity="${opacity}" ${dashAttr} />
            </svg>
        `;
    },

    // Genera la muestra de iconos/símbolos con halo oscuro (#121212) fiel al estilo OtroMundo
    renderSymbolSwatch(color, symbolType = "circle") {
        let shapeSvg = "";
        if (symbolType === "peak") {
            shapeSvg = `<polygon points="12,5 19,18 5,18" fill="${color}" stroke="#121212" stroke-width="2" stroke-linejoin="round" />`;
        } else if (symbolType === "waterfall") {
            shapeSvg = `<polygon points="12,19 19,6 5,6" fill="${color}" stroke="#121212" stroke-width="2" stroke-linejoin="round" />`;
        } else if (symbolType === "square") {
            shapeSvg = `<rect x="6" y="6" width="12" height="12" rx="2" fill="${color}" stroke="#121212" stroke-width="2" />`;
        } else if (symbolType === "cross") {
            shapeSvg = `<path d="M10,5 H14 V10 H19 V14 H14 V19 H10 V14 H5 V10 H10 Z" fill="${color}" stroke="#121212" stroke-width="1.5" />`;
        } else {
            shapeSvg = `<circle cx="12" cy="12" r="5.5" fill="${color}" stroke="#121212" stroke-width="2" />`;
        }

        return `
            <svg width="56" height="24" viewBox="0 0 24 24" style="flex-shrink: 0; background: rgba(255,255,255,0.04); border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
                ${shapeSvg}
            </svg>
        `;
    },

    buildLegendSectionsHTML() {
        const categories = [
            {
                title: "Caminos, Senderos y Vías Outdoor",
                items: [
                    {
                        swatch: this.renderLineSwatch({ color: "#00e5ff", width: 2.5, dasharray: "4,3" }),
                        label: "Senda principal (Path)",
                        sub: "Camino estrecho / sendero sin pavimentar"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#00e6a8", width: 2.2, dasharray: "3,3" }),
                        label: "Senda menor / peatonal (Path minor)",
                        sub: "Sendero secundario o vereda peatonal"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#e67e22", width: 3, dasharray: "5,3" }),
                        label: "Pista forestal / camino ancho (Track)",
                        sub: "Pista agrícola o forestal sin asfaltar"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#ffaa00", width: 2.4, dasharray: "5,3" }),
                        label: "Otros senderos balizados (Other trails)",
                        sub: "Rutas locales sin color específico"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#ff1744", width: 3.4 }),
                        label: "Sendero de Gran Recorrido (GR / Longdistance)",
                        sub: "Red nacional e internacional (iwn / nwn)"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#ffea00", width: 2.6, casingColor: "#121212", casingWidth: 5, dasharray: "1.5,4.5" }),
                        label: "Vía Ferrata",
                        sub: "Tramo equipado con cable y grapas"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#00e5ff", width: 2.2, dasharray: "2.5,2.5", opacity: 0.75 }),
                        label: "Senda / Pista en túnel (Tunnel path)",
                        sub: "Paso subterráneo en sendero o pista"
                    }
                ]
            },
            {
                title: "Senderos Balizados por Color",
                items: [
                    { swatch: this.renderLineSwatch({ color: "#ffea00", width: 3 }), label: "Sendero Amarillo (PR / Local)", sub: "Baliza amarilla" },
                    { swatch: this.renderLineSwatch({ color: "#00e676", width: 3 }), label: "Sendero Verde (SL)", sub: "Baliza verde" },
                    { swatch: this.renderLineSwatch({ color: "#00b0ff", width: 3 }), label: "Sendero Azul", sub: "Baliza azul" },
                    { swatch: this.renderLineSwatch({ color: "#ff6d00", width: 3 }), label: "Sendero Naranja", sub: "Baliza naranja" },
                    { swatch: this.renderLineSwatch({ color: "#ff1744", width: 3 }), label: "Sendero Rojo", sub: "Baliza roja" },
                    { swatch: this.renderLineSwatch({ color: "#d35400", width: 3 }), label: "Sendero Marrón", sub: "Baliza marrón" },
                    { swatch: this.renderLineSwatch({ color: "#d500f9", width: 3 }), label: "Sendero Morado", sub: "Baliza púrpura" },
                    { swatch: this.renderLineSwatch({ color: "#111111", width: 3, casingColor: "rgba(255,255,255,0.45)", casingWidth: 4.5 }), label: "Sendero Negro", sub: "Baliza negra (alta dificultad)" }
                ]
            },
            {
                title: "Rutas Ciclistas (MTB / Cicloturismo)",
                items: [
                    {
                        swatch: this.renderLineSwatch({ color: "#d500f9", width: 3.4 }),
                        label: "Ruta Ciclista Larga Distancia",
                        sub: "Red nacional / EuroVelo (icn / ncn)"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#e040fb", width: 2.6, dasharray: "4,3" }),
                        label: "Ruta Ciclista Local / BTT",
                        sub: "Itinerario ciclista regional o local"
                    }
                ]
            },
            {
                title: "Red Viaria y Túneles",
                items: [
                    { swatch: this.renderLineSwatch({ color: "#ff5500", width: 4.5 }), label: "Autopista / Autovía (Motorway)", sub: "Vía rápida principal" },
                    { swatch: this.renderLineSwatch({ color: "#ff7700", width: 4 }), label: "Vía Rápida / Nacional (Trunk)", sub: "Carretera troncal" },
                    { swatch: this.renderLineSwatch({ color: "#ffaa00", width: 3.5 }), label: "Carretera Primaria (Primary)", sub: "Carretera autonómica o principal" },
                    { swatch: this.renderLineSwatch({ color: "#ffee55", width: 3 }), label: "Carretera Secundaria (Secondary)", sub: "Carretera comarcal" },
                    { swatch: this.renderLineSwatch({ color: "#ffffff", width: 2.5 }), label: "Carretera Terciaria / Local", sub: "Calles y carreteras locales" },
                    { swatch: this.renderLineSwatch({ color: "#e0e0e0", width: 2 }), label: "Vía de Servicio (Service)", sub: "Accesos y caminos pavimentados" },
                    { swatch: this.renderLineSwatch({ color: "#ffaa00", width: 3.2, dasharray: "5,3.5", opacity: 0.8 }), label: "Túnel Carretero (Tunnel)", sub: "Tramo subterráneo de carretera" }
                ]
            },
            {
                title: "Ferrocarriles y Remontes de Montaña",
                items: [
                    {
                        swatch: this.renderLineSwatch({ color: "#ffffff", width: 1.8, casingColor: "#444444", casingWidth: 4, dasharray: "4,4" }),
                        label: "Ferrocarril Principal (Major railway)",
                        sub: "Línea ferroviaria en superficie"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#ffffff", width: 1.6, casingColor: "#555555", casingWidth: 3.6, dasharray: "4,4", opacity: 0.7 }),
                        label: "Túnel Ferroviario (Railway tunnel)",
                        sub: "Tramo subterráneo de tren"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#ffffff", width: 2.4, casingColor: "#666666", casingWidth: 3.8, dasharray: "1,4" }),
                        label: "Tranvía / Tren Ligero (Minor railway)",
                        sub: "Línea metropolitana o tranvía"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#ffffff", width: 2.4, casingColor: "#222222", casingWidth: 4.2, dasharray: "2,3.5" }),
                        label: "Teleférico / Telecabina / Funicular",
                        sub: "Transporte por cable de alta capacidad"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#ffffff", width: 2.2, casingColor: "#333333", casingWidth: 3.8, dasharray: "1.2,3.2" }),
                        label: "Telesilla / Telesquí (Chair & Minor lift)",
                        sub: "Remontes de estación de esquí"
                    }
                ]
            },
            {
                title: "Límites Administrativos y Espacios Protegidos",
                items: [
                    {
                        swatch: this.renderLineSwatch({ color: "#2e7d32", width: 2.6, dasharray: "4,3" }),
                        label: "Espacio Natural Protegido",
                        sub: "Parque Nacional, Parque Natural o Reserva"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#ff3333", width: 2.6, dasharray: "5,3.5" }),
                        label: "Zona Militar (Military limit)",
                        sub: "Perímetro de acceso restringido"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#ffffff", width: 2.8 }),
                        label: "Frontera Internacional (Country border)",
                        sub: "Límite entre países"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#ffaa00", width: 2.5, dasharray: "3,3" }),
                        label: "Frontera en Disputa (Disputed border)",
                        sub: "Límite administrativo litigioso"
                    },
                    {
                        swatch: this.renderLineSwatch({ color: "#ffffff", width: 1.8, dasharray: "5,3", opacity: 0.8 }),
                        label: "Límite Provincial / Municipal",
                        sub: "Divisiones administrativas internas"
                    }
                ]
            },
            {
                title: "Picos, Agua y Puntos de Interés (POIs)",
                items: [
                    {
                        swatch: this.renderSymbolSwatch("#00e5ff", "peak"),
                        label: "Cima / Pico (Peak)",
                        sub: "Nombre y altitud en metros (o pies)"
                    },
                    {
                        swatch: this.renderSymbolSwatch("#ff3d00", "peak"),
                        label: "Volcán (Volcano)",
                        sub: "Cono volcánico con cota"
                    },
                    {
                        swatch: this.renderSymbolSwatch("#00d2ff", "waterfall"),
                        label: "Cascada / Salto de agua (Waterfall)",
                        sub: "Triángulo invertido azul"
                    },
                    {
                        swatch: this.renderSymbolSwatch("#00d2ff", "circle"),
                        label: "Fuente / Agua Potable / Manantial",
                        sub: "Puntos de abastecimiento de agua"
                    },
                    {
                        swatch: this.renderSymbolSwatch("#00e676", "circle"),
                        label: "Refugio / Vivac / Camping / Mirador",
                        sub: "Infraestructura outdoor y acampada"
                    },
                    {
                        swatch: this.renderSymbolSwatch("#00e5ff", "square"),
                        label: "Poste Indicador / Info / Transporte",
                        sub: "Señalización de senderos, estaciones y parkings"
                    },
                    {
                        swatch: this.renderSymbolSwatch("#ffab40", "circle"),
                        label: "Restaurante / Refugio Guardado / Cafetería",
                        sub: "Hostelería y avituallamiento"
                    },
                    {
                        swatch: this.renderSymbolSwatch("#ff9800", "square"),
                        label: "Tienda de Montaña / Outdoor",
                        sub: "Equipamiento deportivo y técnico"
                    },
                    {
                        swatch: this.renderSymbolSwatch("#ff1744", "cross"),
                        label: "Hospital / Rescate en Montaña / Socorro",
                        sub: "Asistencia sanitaria y emergencias"
                    },
                    {
                        swatch: this.renderSymbolSwatch("#ab47bc", "square"),
                        label: "Castillo / Monumento / Patrimonio",
                        sub: "Ruinas, fortalezas y cultura"
                    }
                ]
            }
        ];

        return categories.map(cat => `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="font-weight: bold; color: #00e5ff; font-size: 0.85rem; padding-bottom: 4px; border-bottom: 1px solid rgba(0, 229, 255, 0.25);">
                    ${cat.title}
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${cat.items.map(item => `
                        <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 6px 8px;">
                            ${item.swatch}
                            <div style="display: flex; flex-direction: column; min-width: 0;">
                                <span style="color: #fff; font-weight: 600; font-size: 0.78rem; line-height: 1.25;">${item.label}</span>
                                <span style="color: #999; font-size: 0.7rem; line-height: 1.25;">${item.sub}</span>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `).join("");
    },

    setupSideDrawer() {
        if (document.getElementById("side-panel-legend")) return;

        const drawerHTML = `
        <div id="side-panel-legend" class="side-drawer">
            <div class="side-drawer-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button id="btn-back-legend-to-maps" class="drawer-close-btn" title="Volver a Mapas Base" style="font-size: 1rem;">‹</button>
                    <h3 style="margin: 0;">Leyenda OtroMundo</h3>
                </div>
                <button id="btn-close-legend-drawer" class="drawer-close-btn" title="Cerrar">✕</button>
            </div>
            <div class="side-drawer-body" style="display: flex; flex-direction: column; gap: 16px; overflow-y: auto; padding-bottom: 24px;">
                
                <div style="color: #ccc; line-height: 1.4; font-size: 0.8rem;">
                    Referencia visual de las capas topográficas, altimetrías y elementos vectoriales del mapa base OtroMundo.
                </div>

                <!-- Contenedor de la Imagen Leyenda (Base Satélite) -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; overflow: hidden;">
                    <img src="ui-icons/otromundo-legend.png" alt="Leyenda OtroMundo" style="width: 100%; max-height: 260px; object-fit: contain; border-radius: 8px;">
                    <span style="font-size: 0.7rem; color: #888; text-align: center;">Base ortofoto satélite con superposición vectorial</span>
                </div>

                <!-- Representación Fiel de las Capas Vectoriales -->
                ${this.buildLegendSectionsHTML()}

                <div style="display: flex; flex-direction: column; gap: 6px; background: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 10px; padding: 10px;">
                    <div style="font-weight: bold; color: #00e5ff; font-size: 0.82rem;">💡 Consejos de Lectura</div>
                    <div style="color: #bbb; font-size: 0.75rem; line-height: 1.4;">
                    • Combina el mapa vectorial con la capa de curvas DEM 
                       Las <strong>curvas maestras</strong> muestran cotas de altitud en metros con contraste automático.<br>
                        
                    </div>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', drawerHTML);

        const drawer = document.getElementById("side-panel-legend");

        document.getElementById("btn-close-legend-drawer")?.addEventListener("click", () => {
            drawer?.classList.remove("active");
        });

        document.getElementById("btn-back-legend-to-maps")?.addEventListener("click", () => {
            drawer?.classList.remove("active");
            document.getElementById("side-panel-maps")?.classList.add("active");
        });
    },

    openDrawer() {
        const drawer = document.getElementById("side-panel-legend");
        if (drawer) drawer.classList.add("active");
    }
};

window.MapLegendManager = MapLegendManager;
document.addEventListener("DOMContentLoaded", () => {
    MapLegendManager.init();
});