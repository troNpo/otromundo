**Planificador de Rutas Outdoor**

<p align="center">
  <img width="250" alt="Otromundo Logo" src="https://github.com/user-attachments/assets/9519962a-c2d6-40c3-a099-10fdc840b939" />
</p>

> *Pasando los bocetos de mi cabeza a códigos.*
> 
https://tronpo.github.io/otromundo/
**Otromundo** es una aplicación web progresiva (PWA) de cartografía y planificación de rutas al aire libre (*outdoor*), diseñada con un enfoque web moderno, rápido y optimizado para dispositivos móviles en línea. Permite trazar rutas en tiempo real utilizando múltiples perfiles de enrutamiento, visualizar perfiles de elevación interactivos y gestionar waypoints, con total compatibilidad para ser empaquetada como una aplicación nativa para Android (APK).

---

## 🚀 Enfoque y Características de la PWA

* **Diseño Adaptado a Entornos Outdoor**: Interfaz minimalista en modo oscuro con paneles laterales deslizantes (*drawers*), modo especial para zurdos/diestros y controles verticales ergonómicos optimizados para uso con una sola mano.
* **Enrutamiento Avanzado en Línea (BRouter)**: Cálculo de rutas en tiempo real adaptado a diferentes disciplinas (*Senderismo/Montaña, Trekking, MTB, Gravel y Carretera*).
* **Perfil de Elevación Dinámico**: Gráfica de altitud interactiva con degradado cian, cálculo de distancias, desnivel acumulado (subida/bajada) y tiempos estimados.
* **Gestión Integral de Waypoints**: Puntos de ruta numerados con círculos, renombrado en línea protegido, centrado directo en mapa y borrado rápido.
* **Arquitectura PWA / APK Ready**: Estructura compatible con estándares web para instalación directa desde el navegador o empaquetado nativo en APK.

---

## 📈 Fases de Desarrollo

* **Fase 0**: Visor con MapLibre GL JS y renderizado de capas y estilos base.
* **Fase 1**: Planificador de rutas outdoor en línea, integración con BRouter, cálculo de desniveles y perfiles de elevación SVG.
* **Fase 2**: Optimización UI/UX móvil, paneles laterales, modo zurdos, gestión de waypoints y empaquetado PWA/APK.

---

## 🛠️ Tecnologías Principales

* **[MapLibre GL JS](https://maplibre.org/)** - Renderizado de mapas vectoriales y ráster de alto rendimiento.
* **[BRouter](https://brouter.de/)** - Motor de cálculo de rutas y perfiles de enrutamiento outdoor.
* **PWA Manifest & Service Worker** - Integración web y empaquetado nativo (APK).

---

## 🗺️ Atribuciones y Fuentes de Datos

Este proyecto se apoya en potentes librerías de código abierto y servicios cartográficos oficiales:

* **[MapLibre GL JS](https://maplibre.org/)**: Librería principal de renderizado de mapas vectoriales y 3D de código abierto.
* **Mapterhorn**: Herramientas y procesamiento para la generación de mallas de terreno y elevación 3D.
* **[OpenStreetMap (OSM)](https://www.openstreetmap.org/)**: Base de datos geoespacial colaborativa mundial que alimenta la cartografía base.
* **[Nominatim](https://nominatim.org/)**: Motor de búsqueda y geocodificación oficial de OpenStreetMap utilizado para la localización de lugares.
* **[IGN (Instituto Geográfico Nacional)](https://www.ign.es/)**: Proveedor de servicios de mapas ráster y fuentes oficiales de cartografía y elevación.
* **[Esri](https://www.esri.com/)**: Proveedor de capas de imágenes satelitales y cartografía base global.
* **[Flaticon (UIcons)](https://www.flaticon.com/)**: Proveedor de la iconografía de interfaz para los botones, menús y barras de navegación.
