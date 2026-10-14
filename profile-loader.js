// profile-loader.js

let perfilActualNombre = "hiking";
let datosPerfilActual = null;
let jsonMaestroCache = null;

// Claves para localStorage
const getStorageKeyHidden = (perfil) => `om_poi_hidden_${perfil}`;
const getStorageKeyCustom = (perfil) => `om_poi_custom_${perfil}`;

document.addEventListener("DOMContentLoaded", () => {
    // Configurar eventos del modo edición
    const btnEditMode = document.getElementById("btn-edit-mode");
    const editActionsGroup = document.querySelector(".edit-actions-group");
    const btnValidateEdit = document.getElementById("btn-validate-edit");
    const btnRestoreEdit = document.getElementById("btn-restore-edit");
    const btnAddCustomCat = document.getElementById("btn-add-custom-cat");

    if (btnEditMode) {
        btnEditMode.addEventListener("click", () => {
            const isEditing = document.body.classList.toggle("is-editing");
            if (editActionsGroup) {
                editActionsGroup.style.display = isEditing ? "flex" : "none";
            }
        });
    }

    if (btnValidateEdit) {
        btnValidateEdit.addEventListener("click", () => {
            document.body.classList.remove("is-editing");
            if (editActionsGroup) editActionsGroup.style.display = "none";
        });
    }

    if (btnRestoreEdit) {
        btnRestoreEdit.addEventListener("click", () => {
            if (confirm("¿Deseas restaurar la visibilidad y categorías por defecto de este perfil?")) {
                localStorage.removeItem(getStorageKeyHidden(perfilActualNombre));
                localStorage.removeItem(getStorageKeyCustom(perfilActualNombre));
                cargarPerfilJSON(perfilActualNombre);
            }
        });
    }

    if (btnAddCustomCat) {
        btnAddCustomCat.addEventListener("click", () => {
            abrirModalSelectorMaestro();
        });
    }
});

async function cargarPerfilJSON(nombrePerfil) {
    perfilActualNombre = nombrePerfil;
    const container = document.getElementById("category-container");
    container.innerHTML = "<p style='color: #ffa726; padding: 15px;'>Cargando categorías del perfil...</p>";

    const archivosJson = {
        hiking: "poi-mapping-hiking.json",
        ciclo: "poi-mapping-ciclo.json",
        mtb: "poi-mapping-mtb.json"
    };

    const archivo = archivosJson[nombrePerfil] || "poi-mapping-hiking.json";

    try {
        const response = await fetch(`./${archivo}`);
        if (!response.ok) {
            throw new Error(`No se pudo cargar ${archivo} (Error HTTP: ${response.status})`);
        }

        const data = await response.json();
        datosPerfilActual = data;
        
        // Fusionar con elementos personalizados guardados en localStorage si existen
        fusionarConCustomsLocales(nombrePerfil);
        
        renderizarArbolDesdeJSON(datosPerfilActual);
    } catch (error) {
        console.error("Error al cargar el perfil JSON:", error);
        container.innerHTML = `<p style='color: #ff5252; padding: 15px;'>Error al cargar categorías: ${error.message}</p>`;
    }
}

function fusionarConCustomsLocales(nombrePerfil) {
    if (!datosPerfilActual) return;
    const clavePerfil = Object.keys(datosPerfilActual)[0];
    if (!datosPerfilActual[clavePerfil] || !datosPerfilActual[clavePerfil].subcategorias) return;
    
    const subcategorias = datosPerfilActual[clavePerfil].subcategorias;

    try {
        const customsGuardados = JSON.parse(localStorage.getItem(getStorageKeyCustom(nombrePerfil))) || {};
        Object.keys(customsGuardados).forEach(subKey => {
            if (subcategorias[subKey]) {
                customsGuardados[subKey].elementos.forEach(elemCustom => {
                    const existe = subcategorias[subKey].elementos.some(e => e.tag === elemCustom.tag);
                    if (!existe) {
                        subcategorias[subKey].elementos.push(elemCustom);
                    }
                });
            } else {
                subcategorias[subKey] = customsGuardados[subKey];
            }
        });
    } catch (e) {
        console.error("Error al fusionar elementos personalizados:", e);
    }
}

function renderizarArbolDesdeJSON(jsonData) {
    const container = document.getElementById("category-container");
    container.innerHTML = "";

    const clavePerfil = Object.keys(jsonData)[0];
    const datosPerfil = jsonData[clavePerfil];

    // Verificación robusta para asegurar que accedemos al nivel de subcategorías correctamente
    const subcategorias = datosPerfil && datosPerfil.subcategorias ? datosPerfil.subcategorias : jsonData;

    if (!subcategorias || Object.keys(subcategorias).length === 0) {
        container.innerHTML = "<p style='color: #ff5252; padding: 15px;'>Estructura de JSON no válida o vacía.</p>";
        return;
    }

    const ocultosGuardados = JSON.parse(localStorage.getItem(getStorageKeyHidden(perfilActualNombre))) || [];

    Object.keys(subcategorias).forEach(subKey => {
        const subCat = subcategorias[subKey];
        if (!subCat) return;

        const nodeDiv = document.createElement("div");
        nodeDiv.className = "category-node";
        nodeDiv.setAttribute("data-subkey", subKey);

        if (ocultosGuardados.includes(subKey)) {
            nodeDiv.classList.add("category-hidden-by-user");
        }

        const rowDiv = document.createElement("div");
        rowDiv.className = "category-row";

        const hasElements = subCat.elementos && subCat.elementos.length > 0;
        const nombreCategoria = subCat.nombre_es || subKey;

        rowDiv.innerHTML = `
            <div class="category-left">
                <button class="btn-toggle-visibility" title="Ocultar/Mostrar categoría">
                    <img src="./ui-icons/fi-rr-eye.svg" alt="Visibilidad">
                </button>
                <input type="checkbox" class="cat-checkbox">
                <span>${nombreCategoria}</span>
            </div>
            <div class="category-arrow" style="width: 16px; height: 16px; display: inline-block; transition: transform 0.2s ease; margin-left: auto; flex-shrink: 0; ${hasElements ? '' : 'visibility: hidden;'}">
                <img src="./ui-icons/fi-rr-angle-circle-right.svg" alt="Desplegar" style="width: 100%; height: 100%; filter: brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%); display: block;">
            </div>
        `;

        const btnEye = rowDiv.querySelector(".btn-toggle-visibility");
        btnEye.addEventListener("click", (e) => {
            e.stopPropagation();
            nodeDiv.classList.toggle("category-hidden-by-user");
            guardarEstadoVisibilidad();
        });

        const checkbox = rowDiv.querySelector("input[type='checkbox']");
        const childrenDiv = document.createElement("div");
        childrenDiv.className = "category-children";

        if (hasElements) {
            rowDiv.addEventListener("click", (e) => {
                if (e.target === checkbox || e.target.closest('.btn-toggle-visibility')) return;
                nodeDiv.classList.toggle("active");
            });

            subCat.elementos.forEach(elem => {
                const [tagKey, tagValue] = elem.tag.includes("=") ? elem.tag.split("=").map(s => s.trim()) : [elem.tag.trim(), "yes"];

                const mapRow = document.createElement("div");
                mapRow.className = "category-row category-leaf";
                mapRow.innerHTML = `
                    <div class="category-left">
                        <input type="checkbox" class="subcat-checkbox" data-key="${tagKey}" data-value="${tagValue}">
                        <span>${elem.nombre_es}</span>
                    </div>
                `;
                childrenDiv.appendChild(mapRow);
            });
        }

        nodeDiv.appendChild(rowDiv);
        if (hasElements) {
            nodeDiv.appendChild(childrenDiv);
        }

        checkbox.addEventListener("change", () => {
            const descendantChecks = nodeDiv.querySelectorAll("input[type='checkbox']");
            descendantChecks.forEach(ch => {
                ch.checked = checkbox.checked;
            });
        });

        container.appendChild(nodeDiv);
    });
}

function guardarEstadoVisibilidad() {
    const ocultos = [];
    document.querySelectorAll(".category-node").forEach(node => {
        if (node.classList.contains("category-hidden-by-user")) {
            ocultos.push(node.getAttribute("data-subkey"));
        }
    });
    localStorage.setItem(getStorageKeyHidden(perfilActualNombre), JSON.stringify(ocultos));
}

// Lógica para el modal o selector de adición desde el JSON maestro (poi-mapping.json)
async function abrirModalSelectorMaestro() {
    if (!jsonMaestroCache) {
        try {
            const res = await fetch("./poi-mapping.json");
            if (!res.ok) throw new Error("No se pudo cargar poi-mapping.json maestro");
            jsonMaestroCache = await res.json();
        } catch (e) {
            alert("Error al cargar el archivo maestro de categorías: " + e.message);
            return;
        }
    }

    let modal = document.getElementById("master-json-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "master-json-modal";
        modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;";

        modal.innerHTML = `
            <div style="background:#121212;border:1px solid var(--primary-cyan);width:100%;max-width:500px;max-height:80vh;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;color:#e0e0e0;box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
                <div style="padding:14px 18px;background:rgba(0, 229, 255, 0.12);color:var(--primary-cyan);border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;font-weight:600;">
                    <span>Añadir puntos de interés</span>
                    <button id="close-master-modal" style="background:transparent;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;justify-content:center;">
                        <img src="./ui-icons/fi-rr-cross-small.svg" alt="Cerrar" style="width:20px;height:20px;filter:brightness(0) saturate(100%) invert(77%) sepia(87%) saturate(1637%) hue-rotate(155deg) brightness(103%) contrast(101%);">
                    </button>
                </div>
                <div style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);background:#1a1a1a;">
                    <input type="text" id="master-search-filter" placeholder="Buscar categoría en maestro..." style="width:100%;padding:10px 12px;background:#121212;border:1px solid var(--border-color);color:white;border-radius:10px;outline:none;">
                </div>
                <div id="master-modal-content" style="flex:1;overflow-y:auto;padding:15px;background:#121212;"></div>
                <div style="padding:12px 18px;background:#161616;text-align:right;border-top:1px solid var(--border-color);">
                    <button id="btn-save-master-selection" style="background:var(--primary-cyan);color:#121212;border:none;padding:10px 20px;border-radius:10px;font-weight:bold;cursor:pointer;">Añadir seleccionados</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector("#close-master-modal").addEventListener("click", () => {
            modal.style.display = "none";
        });

        modal.querySelector("#master-search-filter").addEventListener("input", (e) => {
            const filtro = e.target.value.toLowerCase().trim();
            const filas = modal.querySelectorAll(".master-item-row");
            
            filas.forEach(row => {
                const texto = row.textContent.toLowerCase();
                if (texto.includes(filtro)) {
                    row.style.display = "flex";
                    const grupoPadre = row.closest("div[style*='margin-bottom']");
                    if (grupoPadre) grupoPadre.style.display = "block";
                } else {
                    row.style.display = "none";
                }
            });

            modal.querySelectorAll("#master-modal-content > div").forEach(grupo => {
                const visibles = grupo.querySelectorAll(".master-item-row[style*='flex']");
                if (filtro === "") {
                    grupo.style.display = "block";
                } else {
                    grupo.style.display = visibles.length > 0 ? "block" : "none";
                }
            });
        });

        modal.querySelector("#btn-save-master-selection").addEventListener("click", () => {
            procesarSeleccionMaestro(modal);
            modal.style.display = "none";
            cargarPerfilJSON(perfilActualNombre);
        });
    }

    poblarContenidoModalMaestro(modal);
    modal.style.display = "flex";
}

function poblarContenidoModalMaestro(modal) {
    const contentContainer = modal.querySelector("#master-modal-content");
    contentContainer.innerHTML = "";

    Object.keys(jsonMaestroCache).forEach(claveMaster => {
        const bloqueMaster = jsonMaestroCache[claveMaster];
        if (!bloqueMaster.subcategorias) return;

        const subcatsMaster = bloqueMaster.subcategorias;

        Object.keys(subcatsMaster).forEach(subKey => {
            const subCat = subcatsMaster[subKey];
            
            const groupDiv = document.createElement("div");
            groupDiv.style.marginBottom = "14px";
            
            const titleDiv = document.createElement("div");
            titleDiv.style.cssText = "font-weight:600;color:var(--primary-cyan);margin-bottom:6px;font-size:0.9rem;border-bottom:1px solid rgba(0,229,255,0.15);padding-bottom:4px;";
            titleDiv.textContent = subCat.nombre_es;
            groupDiv.appendChild(titleDiv);

            if (subCat.elementos) {
                subCat.elementos.forEach(elem => {
                    const itemRow = document.createElement("label");
                    itemRow.className = "master-item-row";
                    itemRow.style.cssText = "display:flex;align-items:center;gap:10px;padding:6px 0;font-size:0.85rem;cursor:pointer;color:#e0e0e0;";
                    
                    itemRow.innerHTML = `
                        <input type="checkbox" data-subkey="${subKey}" data-subname="${subCat.nombre_es}" data-tag="${elem.tag}" data-namees="${elem.nombre_es}">
                        <span>${elem.nombre_es}</span>
                    `;
                    groupDiv.appendChild(itemRow);
                });
            }

            contentContainer.appendChild(groupDiv);
        });
    });
}

function procesarSeleccionMaestro(modal) {
    const checkboxes = modal.querySelectorAll("input[type='checkbox']:checked");
    if (checkboxes.length === 0) return;

    let customsGuardados = JSON.parse(localStorage.getItem(getStorageKeyCustom(perfilActualNombre))) || {};

    checkboxes.forEach(chk => {
        const subKey = chk.getAttribute("data-subkey");
        const subName = chk.getAttribute("data-subname");
        const tag = chk.getAttribute("data-tag");
        const nombreEs = chk.getAttribute("data-namees");

        if (!customsGuardados[subKey]) {
            customsGuardados[subKey] = {
                nombre_es: subName,
                elementos: []
            };
        }

        const yaExiste = customsGuardados[subKey].elementos.some(e => e.tag === tag);
        if (!yaExiste) {
            customsGuardados[subKey].elementos.push({
                tag: tag,
                nombre_es: nombreEs
            });
        }
    });

    localStorage.setItem(getStorageKeyCustom(perfilActualNombre), JSON.stringify(customsGuardados));
}

// --- FILTRADO EN VIVO DEL ÁRBOL DE CATEGORÍAS PRINCIPAL ---
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        const treeSearchInput = document.getElementById("tree-search-filter");
        if (treeSearchInput) {
            treeSearchInput.addEventListener("input", (e) => {
                const filtro = e.target.value.toLowerCase().trim();
                const nodos = document.querySelectorAll("#category-container .category-node");

                nodos.forEach(node => {
                    const textoNodo = node.textContent.toLowerCase();
                    const hojas = node.querySelectorAll(".category-leaf");
                    let coincideHoja = false;

                    hojas.forEach(hoja => {
                        const textoHoja = hoja.textContent.toLowerCase();
                        if (textoHoja.includes(filtro)) {
                            hoja.style.display = "flex";
                            coincideHoja = true;
                        } else {
                            hoja.style.display = filtro === "" ? "flex" : "none";
                        }
                    });

                    if (textoNodo.includes(filtro) || coincideHoja || filtro === "") {
                        node.style.display = "block";
                        if (filtro !== "") {
                            node.classList.add("active");
                        } else {
                            node.classList.remove("active");
                        }
                    } else {
                        node.style.display = "none";
                    }
                });
            });
        }
    }, 500);
});
