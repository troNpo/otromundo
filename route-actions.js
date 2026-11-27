// ==========================================
// MÓDULO DEDICADO: ACCIONES RÁPIDAS DE RUTA
// ==========================================
class RouteActionsManager {
    constructor(planner) {
        this.planner = planner;
        this.hideIntermediatePoints = false;
        this.roundTripMode = "same-path"; // "same-path" | "end-to-start"
    }

    init() {
        if (!this.planner) return;
        this.injectTabButton();
        this.patchPlannerMethods();
    }

    injectTabButton() {
        const pointsTab = document.getElementById("tab-btn-points");
        const segmentsTab = document.getElementById("tab-btn-segments");
        if (!pointsTab || !segmentsTab || !pointsTab.parentElement) return;

        if (document.getElementById("tab-btn-actions")) return;

        const actionsTab = document.createElement("button");
        actionsTab.id = "tab-btn-actions";
        actionsTab.type = "button";
        actionsTab.innerText = "Acciones";
        actionsTab.style.cssText = segmentsTab.style.cssText;
        actionsTab.style.background = "transparent";
        actionsTab.style.color = "#aaa";

        segmentsTab.parentElement.appendChild(actionsTab);

        const resetTabStyles = () => {
            [pointsTab, segmentsTab, actionsTab].forEach(btn => {
                btn.style.background = "transparent";
                btn.style.color = "#aaa";
            });
        };

        pointsTab.addEventListener("click", () => {
            resetTabStyles();
            pointsTab.style.background = "#00e5ff";
            pointsTab.style.color = "#121212";
        });

        segmentsTab.addEventListener("click", () => {
            resetTabStyles();
            segmentsTab.style.background = "#00e5ff";
            segmentsTab.style.color = "#121212";
        });

        actionsTab.addEventListener("click", () => {
            this.planner.activeTab = "actions";
            resetTabStyles();
            actionsTab.style.background = "#00e5ff";
            actionsTab.style.color = "#121212";
            this.renderActionsDrawer();
        });
    }

    patchPlannerMethods() {
        const p = this.planner;

        const originalRenderMarkers = p.renderMarkers.bind(p);
        p.renderMarkers = () => {
            originalRenderMarkers();
            this.applyIntermediateVisibility();
        };

        const originalRenderTab = p.renderActiveDrawerTab.bind(p);
        p.renderActiveDrawerTab = () => {
            if (p.activeTab === "actions") {
                this.renderActionsDrawer();
            } else {
                originalRenderTab();
            }
        };
    }

    applyIntermediateVisibility() {
        const markers = this.planner.markers || [];
        markers.forEach((marker, idx) => {
            const el = marker.getElement && marker.getElement();
            if (!el) return;
            const isIntermediate = idx > 0 && idx < markers.length - 1;
            el.style.display = (this.hideIntermediatePoints && isIntermediate) ? "none" : "flex";
        });
    }

    toggleIntermediatePoints() {
        this.hideIntermediatePoints = !this.hideIntermediatePoints;
        this.applyIntermediateVisibility();
        this.planner.showToast(
            this.hideIntermediatePoints
                ? "Mostrando solo inicio y final"
                : "Mostrando todos los puntos"
        );
        if (this.planner.activeTab === "actions") {
            this.renderActionsDrawer();
        }
    }

    makeRoundTrip() {
        const p = this.planner;
        if (!p.points || p.points.length < 2) {
            p.showToast("Añade al menos 2 puntos para ida y vuelta");
            return;
        }

        if (this.roundTripMode === "end-to-start") {
            const firstPt = p.points[0];
            p.points = [
                ...p.points,
                {
                    coords: [...firstPt.coords],
                    name: "",
                    isCustomName: false
                }
            ];
        } else {
            const returnPoints = p.points.slice(0, -1).reverse().map((pt) => ({
                coords: [...pt.coords],
                name: "",
                isCustomName: false
            }));
            p.points = [...p.points, ...returnPoints];
        }

        p.syncSegmentsArray();
        if (typeof p.refreshAutoPointNames === "function") {
            p.refreshAutoPointNames();
        }
        p.renderMarkers();
        p.renderActiveDrawerTab();
        p.showToast("Ruta de ida y vuelta generada");
        p.calcularRutaBRouter();
    }

    reverseRoute() {
        const p = this.planner;
        if (!p.points || p.points.length < 2) {
            p.showToast("Se necesitan al menos 2 puntos para invertir");
            return;
        }

        p.points = [...p.points].reverse();
        if (Array.isArray(p.segments) && p.segments.length > 0) {
            p.segments = [...p.segments].reverse().map((seg, i) => ({
                ...seg,
                name: `Tramo ${i + 1}`,
                coordinates: Array.isArray(seg.coordinates) ? [...seg.coordinates].reverse() : seg.coordinates
            }));
        }

        if (typeof p.refreshAutoPointNames === "function") {
            p.refreshAutoPointNames();
        }
        p.renderMarkers();
        p.renderActiveDrawerTab();
        p.showToast("Sentido de la ruta invertido");
        p.calcularRutaBRouter();
    }

    removeIntermediateKeepGeometry() {
        const p = this.planner;
        if (!p.points || p.points.length <= 2) {
            p.showToast("No hay puntos intermedios que eliminar");
            return;
        }

        const firstPoint = p.points[0];
        const lastPoint = p.points[p.points.length - 1];
        p.points = [firstPoint, lastPoint];

        const existingCoords =
            p.currentRouteData?.coordinates ||
            p.routesList?.[p.currentRouteIndex]?.coordinates ||
            [];

        const baseColor = p.segments?.[0]?.color || "#00e5ff";
        const baseProfile = p.segments?.[0]?.profile || p.profile;

        p.segments = [{
            name: "Tramo 1",
            color: baseColor,
            profile: baseProfile,
            coordinates: existingCoords
        }];

        if (existingCoords.length >= 2) {
            let totalDistM = 0;
            let totalAscent = 0;
            let totalDescent = 0;

            for (let i = 0; i < existingCoords.length - 1; i++) {
                const c1 = existingCoords[i];
                const c2 = existingCoords[i + 1];
                totalDistM += p.haversine(c1[1], c1[0], c2[1], c2[0]);
                const diff = (c2[2] || 0) - (c1[2] || 0);
                if (diff > 0) totalAscent += diff;
                else totalDescent += Math.abs(diff);
            }

            const distKm = (totalDistM / 1000).toFixed(2);
            const timeStr = p.formatBRouterTime(0, totalDistM, baseProfile);
            const asc = Math.round(totalAscent);
            const desc = Math.round(totalDescent);

            p.routesList = [{
                index: 0,
                coordinates: existingCoords,
                distKm,
                timeStr,
                ascent: asc,
                descent: desc
            }];
            p.currentRouteIndex = 0;
            p.currentRouteData = { coordinates: existingCoords };
            p.updateStats(distKm, timeStr, asc, desc);
            p.paintAllRoutes();
            p.updateSegmentLabels();
            p.renderMinMaxMarkers();
            if (p.isGraphOpen) {
                p.renderElevationGraph(existingCoords);
            }
        }

        if (typeof p.refreshAutoPointNames === "function") {
            p.refreshAutoPointNames();
        }
        p.renderMarkers();
        p.renderActiveDrawerTab();
        p.updateDynamicCursorLine();
        p.showToast("Puntos intermedios eliminados sin alterar el trazado");
    }

    renderActionsDrawer() {
        const container = document.getElementById("planner-points-items-container");
        const countLabel = document.getElementById("planner-points-count");
        if (!container) return;

        if (countLabel) countLabel.innerText = "(4)";
        container.innerHTML = "";

        // Tarjeta unificada: Ida y vuelta (Mismo camino / Final → Principio)
        const rtCard = document.createElement("div");
        rtCard.style.cssText = `
            display: flex; flex-direction: column; gap: 10px;
            background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px; padding: 12px; width: 100%; box-sizing: border-box;
        `;

        const rtHeader = document.createElement("div");
        rtHeader.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 8px;";
        rtHeader.innerHTML = `
            <div>
                <div style="font-size: 0.86rem; font-weight: bold; color: #fff;">Viaje de ida y vuelta</div>
                <div style="font-size: 0.74rem; color: #aaa; margin-top: 2px;">
                    ${this.roundTripMode === "end-to-start"
                        ? "Conecta directamente el último punto con el primero"
                        : "Regresa pasando por los puntos anteriores en orden inverso"}
                </div>
            </div>
        `;
        rtCard.appendChild(rtHeader);

        const modeRow = document.createElement("div");
        modeRow.style.cssText = "display: flex; gap: 6px;";

        [
            { id: "same-path", label: "Mismo camino" },
            { id: "end-to-start", label: "Final → Principio" }
        ].forEach(m => {
            const btn = document.createElement("button");
            btn.type = "button";
            const selected = this.roundTripMode === m.id;
            btn.innerText = m.label;
            btn.style.cssText = `
                flex: 1; padding: 7px 8px; border-radius: 7px; font-size: 0.75rem; font-weight: bold; cursor: pointer;
                border: 1px solid ${selected ? "#00e5ff" : "rgba(255,255,255,0.12)"};
                background: ${selected ? "rgba(0,229,255,0.16)" : "transparent"};
                color: ${selected ? "#00e5ff" : "#ccc"};
            `;
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.roundTripMode = m.id;
                this.renderActionsDrawer();
            });
            modeRow.appendChild(btn);
        });
        rtCard.appendChild(modeRow);

        const runRtBtn = document.createElement("button");
        runRtBtn.type = "button";
        runRtBtn.style.cssText = `
            display: flex; align-items: center; justify-content: space-between; gap: 10px;
            width: 100%; text-align: left; cursor: pointer; box-sizing: border-box;
            background: rgba(0, 229, 255, 0.1); border: 1px solid rgba(0, 229, 255, 0.35);
            border-radius: 8px; padding: 9px 11px; color: #fff;
        `;
        runRtBtn.innerHTML = `
            <span style="font-size: 0.82rem; font-weight: bold; color: #00e5ff;">Aplicar ida y vuelta</span>
            <span style="font-size: 0.72rem; font-weight: bold; padding: 2px 8px; border-radius: 999px; background: rgba(0,229,255,0.18); color: #00e5ff;">→</span>
        `;
        runRtBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.makeRoundTrip();
        });
        rtCard.appendChild(runRtBtn);

        container.appendChild(rtCard);

        const createActionButton = ({ title, subtitle, active = false, danger = false, onClick }) => {
            const btn = document.createElement("button");
            btn.type = "button";
            const borderColor = danger
                ? "rgba(255, 82, 82, 0.35)"
                : active
                    ? "#00e5ff"
                    : "rgba(255,255,255,0.1)";
            const bgColor = active
                ? "rgba(0, 229, 255, 0.12)"
                : "rgba(255,255,255,0.04)";

            btn.style.cssText = `
                display: flex; align-items: center; justify-content: space-between; gap: 10px;
                width: 100%; text-align: left; cursor: pointer; box-sizing: border-box;
                background: ${bgColor}; border: 1px solid ${borderColor};
                border-radius: 10px; padding: 10px 12px; color: #fff;
            `;

            const textWrap = document.createElement("div");
            textWrap.innerHTML = `
                <div style="font-size: 0.86rem; font-weight: bold; color: ${danger ? "#ff6b6b" : "#fff"};">${title}</div>
                <div style="font-size: 0.74rem; color: #aaa; margin-top: 2px;">${subtitle}</div>
            `;

            const badge = document.createElement("span");
            badge.innerText = active ? "ON" : "→";
            badge.style.cssText = `
                font-size: 0.72rem; font-weight: bold; padding: 3px 8px; border-radius: 999px;
                background: ${active ? "#00e5ff" : "rgba(255,255,255,0.08)"};
                color: ${active ? "#121212" : "#00e5ff"}; flex-shrink: 0;
            `;

            btn.appendChild(textWrap);
            btn.appendChild(badge);
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                onClick();
            });
            return btn;
        };

        container.appendChild(createActionButton({
            title: "Invertir sentido de la ruta",
            subtitle: "Invierte el orden de puntos y tramos del recorrido",
            onClick: () => this.reverseRoute()
        }));

        container.appendChild(createActionButton({
            title: "Ocultar puntos intermedios",
            subtitle: "Muestra solo los marcadores de inicio y final",
            active: this.hideIntermediatePoints,
            onClick: () => this.toggleIntermediatePoints()
        }));

        container.appendChild(createActionButton({
            title: "Eliminar puntos intermedios",
            subtitle: "Mantiene inicio y final sin modificar el trazado actual",
            danger: true,
            onClick: () => this.removeIntermediateKeepGeometry()
        }));
    }
}

window.RouteActionsManager = RouteActionsManager;
