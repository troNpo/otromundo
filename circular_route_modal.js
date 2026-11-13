// ==========================================
// MÓDULO DE RUTA CIRCULAR Y RADAR INTERACTIVO
// (Versión limpia y estable de 5 puntos: Inicio + 4 perimetrales)
// ==========================================
class CircularRouteManager {
    constructor(planner) {
        this.planner = planner;
        this.map = planner.map;
        this.activePoint = null;
        this.modalElement = null;
        this.currentAngle = 0;
        this.currentDist = 15;
        this.currentProfile = planner.profile || 'hiking-mountain';
        this.isSelectingStart = false;

        this.initUI();
    }

    initUI() {
        const modalHTML = `
        <div id="circular-route-modal" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.25); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 30000; display: none; align-items: center; justify-content: center; padding: 16px; pointer-events: auto;">
            <div style="background: rgba(18, 18, 20, 0.72); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1.5px solid rgba(0, 229, 255, 0.5); border-radius: 20px; padding: 18px 20px; width: 100%; max-width: 330px; box-shadow: 0 12px 32px rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; gap: 14px; color: #fff; font-family: sans-serif;">
                
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <div style="font-size: 0.95rem; font-weight: bold; color: #00e5ff; display: flex; align-items: center; gap: 8px;">
                        <img src="./ui-icons/fi-rr-rotate-right.svg" width="18" height="18" style="filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg);" alt="Circular">
                        Configurar Ruta Circular
                    </div>
                    <button id="btn-close-circular-modal" style="background: rgba(255,255,255,0.1); border: none; color: #fff; width: 26px; height: 26px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <!-- Radar Sonar Interactivo con Puntos Cardinales (N, S, E, O) -->
                <div id="radar-wheel" style="position: relative; width: 160px; height: 160px; background: radial-gradient(circle, rgba(0, 229, 255, 0.15) 0%, rgba(10, 30, 35, 0.75) 100%); border: 2px solid #00e5ff; border-radius: 50%; box-shadow: inset 0 0 15px rgba(0, 229, 255, 0.35), 0 0 12px rgba(0, 229, 255, 0.25); cursor: pointer; overflow: hidden; touch-action: none; user-select: none;">
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100px; height: 100px; border: 1px dashed rgba(0, 229, 255, 0.35); border-radius: 50%; pointer-events: none;"></div>
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; border: 1px dashed rgba(0, 229, 255, 0.35); border-radius: 50%; pointer-events: none;"></div>
                    <div style="position: absolute; top: 50%; left: 0; width: 100%; height: 1px; background: rgba(0, 229, 255, 0.25); pointer-events: none;"></div>
                    <div style="position: absolute; top: 0; left: 50%; width: 1px; height: 100%; background: rgba(0, 229, 255, 0.25); pointer-events: none;"></div>
                    
                    <!-- Puntos Cardinales -->
                    <span style="position: absolute; top: 4px; left: 50%; transform: translateX(-50%); font-size: 0.65rem; font-weight: bold; color: #00e5ff; text-shadow: 0 0 4px #121212; pointer-events: none;">N</span>
                    <span style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); font-size: 0.65rem; font-weight: bold; color: rgba(255,255,255,0.7); pointer-events: none;">S</span>
                    <span style="position: absolute; top: 50%; right: 6px; transform: translateY(-50%); font-size: 0.65rem; font-weight: bold; color: rgba(255,255,255,0.7); pointer-events: none;">E</span>
                    <span style="position: absolute; top: 50%; left: 6px; transform: translateY(-50%); font-size: 0.65rem; font-weight: bold; color: rgba(255,255,255,0.7); pointer-events: none;">O</span>

                    <!-- Aguja Directriz -->
                    <div id="radar-needle" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform-origin: center; pointer-events: none; transition: transform 0.05s linear;">
                        <div style="position: absolute; top: 6px; left: 50%; width: 2px; height: 74px; background: #ffffff; transform: translateX(-50%); box-shadow: 0 0 8px #ffffff;"></div>
                    </div>

                    <!-- Centro (Origen) -->
                    <div style="position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; background: #00e5ff; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 8px #00e5ff; pointer-events: none;"></div>
                </div>

                <!-- Badge de Rumbo -->
                <div id="radar-info" style="background: rgba(18, 18, 20, 0.85); border: 1px solid #00e5ff; color: #00e5ff; font-size: 0.72rem; font-weight: bold; padding: 4px 10px; border-radius: 6px; text-align: center; width: 100%;">
                    Rumbo: 0° (Norte) | 15 km
                </div>

                <!-- Deslizador de Distancia Ampliado a 200 km -->
                <div style="width: 100%; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #ddd; font-weight: 500;">
                        <span>Distancia objetivo:</span>
                        <strong id="dist-value" style="color: #00e5ff;">15 km</strong>
                    </div>
                    <input type="range" id="loop-distance-slider" min="5" max="200" value="15" step="1" style="width: 100%; accent-color: #00e5ff; cursor: pointer;">
                </div>

                <!-- Selector de Perfil Sincronizado -->
                <div style="width: 100%; display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 0.78rem; color: #ddd; font-weight: 500;">Perfil de enrutamiento:</label>
                    <select id="loop-profile-select" style="width: 100%; background: rgba(18, 18, 20, 0.85); color: #fff; border: 1px solid rgba(0,229,255,0.4); padding: 7px; border-radius: 8px; font-size: 0.8rem; outline: none;">
                        <option value="hiking-mountain">Senderismo</option>
                        <option value="trekking">Trekking</option>
                        <option value="mtb">MTB</option>
                        <option value="gravel">Gravel</option>
                        <option value="fastbike">Carretera</option>
                    </select>
                </div>

                <!-- Botón Generar -->
                <button id="btn-execute-loop" style="width: 100%; background: #00e5ff; color: #121212; border: none; padding: 10px; border-radius: 10px; font-weight: bold; font-size: 0.85rem; cursor: pointer; margin-top: 4px; box-shadow: 0 4px 12px rgba(0, 229, 255, 0.3);">
                    Generar Bucle Circular
                </button>

            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modalElement = document.getElementById('circular-route-modal');
        this.setupEvents();
    }

    setupEvents() {
        const radarWheel = document.getElementById('radar-wheel');
        const radarNeedle = document.getElementById('radar-needle');
        const radarInfo = document.getElementById('radar-info');
        const distSlider = document.getElementById('loop-distance-slider');
        const distValueLabel = document.getElementById('dist-value');
        const profileSelect = document.getElementById('loop-profile-select');

        let isDragging = false;
        const updateRadar = (clientX, clientY) => {
            const rect = radarWheel.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dx = clientX - centerX;
            const dy = clientY - centerY;

            let rad = Math.atan2(dx, -dy);
            let deg = rad * (180 / Math.PI);
            if (deg < 0) deg += 360;

            this.currentAngle = Math.round(deg);
            radarNeedle.style.transform = `rotate(${this.currentAngle}deg)`;
            this.updateInfoText(radarInfo);
        };

        radarWheel.addEventListener('pointerdown', (e) => { isDragging = true; updateRadar(e.clientX, e.clientY); });
        window.addEventListener('pointermove', (e) => { if (!isDragging) return; updateRadar(e.clientX, e.clientY); });
        window.addEventListener('pointerup', () => { isDragging = false; });

        distSlider.addEventListener('input', (e) => {
            this.currentDist = parseFloat(e.target.value);
            distValueLabel.innerText = `${this.currentDist} km`;
            this.updateInfoText(radarInfo);
        });

        profileSelect.addEventListener('change', (e) => {
            this.syncProfileWithApp(e.target.value);
        });

        document.getElementById('btn-close-circular-modal').addEventListener('click', () => {
            this.modalElement.style.display = 'none';
        });

        document.getElementById('btn-execute-loop').addEventListener('click', () => {
            this.modalElement.style.display = 'none';
            this.generateCircularRoute();
        });
    }

    syncProfileWithApp(newProfile) {
        this.currentProfile = newProfile;
        if (this.planner) {
            this.planner.profile = newProfile;
            this.planner.updateDefaultProfileStatus();

            const mainRadio = document.querySelector(`input[name="brouter-profile"][value="${newProfile}"]`);
            if (mainRadio) {
                mainRadio.checked = true;
            }
        }
    }

    syncModalSelectWithApp() {
        const profileSelect = document.getElementById('loop-profile-select');
        if (this.planner && profileSelect) {
            this.currentProfile = this.planner.profile || 'hiking-mountain';
            profileSelect.value = this.currentProfile;
        }
    }

    updateInfoText(badgeElement) {
        let cardinal = "Norte";
        const a = this.currentAngle;
        if (a > 22.5 && a <= 67.5) cardinal = "NE";
        else if (a > 67.5 && a <= 112.5) cardinal = "Este";
        else if (a > 112.5 && a <= 157.5) cardinal = "SE";
        else if (a > 157.5 && a <= 202.5) cardinal = "Sur";
        else if (a > 202.5 && a <= 247.5) cardinal = "SO";
        else if (a > 247.5 && a <= 292.5) cardinal = "Oeste";
        else if (a > 292.5 && a <= 337.5) cardinal = "NO";

        badgeElement.innerText = `Rumbo: ${a}° (${cardinal}) | ${this.currentDist} km`;
    }

    startSelection() {
        document.getElementById('side-panel-planner-options')?.classList.remove('active');
        this.planner.showToast("Pulsa + o toca en el mapa para el origen del bucle");
        this.isSelectingStart = true;
    }

    handleMapClick(lngLat) {
        if (!this.isSelectingStart) return false;
        this.isSelectingStart = false;
        this.activePoint = lngLat;
        
        this.syncModalSelectWithApp();
        
        this.modalElement.style.display = 'flex';
        return true;
    }

    computeDestinationPoint(startLng, startLat, distanceKm, bearingDeg) {
        const R = 6371;
        const radLat = (startLat * Math.PI) / 180;
        const radLng = (startLng * Math.PI) / 180;
        const radBearing = (bearingDeg * Math.PI) / 180;
        const dDivR = distanceKm / R;

        const destLat = Math.asin(
            Math.sin(radLat) * Math.cos(dDivR) +
            Math.cos(radLat) * Math.sin(dDivR) * Math.cos(radBearing)
        );

        const destLng = radLng + Math.atan2(
            Math.sin(radBearing) * Math.sin(dDivR) * Math.cos(radLat),
            Math.cos(dDivR) - Math.sin(radLat) * Math.sin(destLat)
        );

        return [ (destLng * 180) / Math.PI, (destLat * 180) / Math.PI ];
    }

    async generateCircularRoute() {
        if (!this.activePoint) return;
        
        this.syncProfileWithApp(this.currentProfile);
        this.planner.showToast("Calculando ruta circular con BRouter...");

        const startLng = this.activePoint.lng !== undefined ? this.activePoint.lng : this.activePoint[0];
        const startLat = this.activePoint.lat !== undefined ? this.activePoint.lat : this.activePoint[1];
        
        const circleRadiusKm = this.currentDist / (2 * Math.PI);

        const centerCoords = this.computeDestinationPoint(startLng, startLat, circleRadiusKm, this.currentAngle);
        const initialAngleFromCenter = (this.currentAngle + 180) % 360;

        const waypoints = [];
        const numWaypoints = 4; // 4 puntos perimetrales originales
        const stepAngle = 360 / (numWaypoints + 1);

        for (let i = 1; i <= numWaypoints; i++) {
            const currentWaypointAngle = (initialAngleFromCenter + (i * stepAngle)) % 360;
            const wpCoords = this.computeDestinationPoint(centerCoords[0], centerCoords[1], circleRadiusKm, currentWaypointAngle);
            waypoints.push(wpCoords);
        }

        this.planner.clearAllPoints();
        this.planner.profile = this.currentProfile;
        this.planner.updateDefaultProfileStatus();

        const startPt = [startLng, startLat];
        this.planner.addPoint(startPt, "Inicio");
        
        waypoints.forEach((wp, idx) => {
            this.planner.addPoint(wp, `Vía ${idx + 1}`);
        });

        this.planner.addPoint(startPt, "Fin");
    }
}

window.CircularRouteManager = CircularRouteManager;