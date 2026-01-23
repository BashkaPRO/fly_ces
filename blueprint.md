# 🛩️ Web Flight Simulator Blueprint

## 1. Project Objectives

Build a web-based flight simulator with the following features:
- Real-world 3D world (terrain) based on CesiumJS.
- Arcade-style aircraft controls.
- Full game flow: Main Menu -> Location Selection -> Simulation.
- Authentic military HUD UI with custom fonts.

------------------------------------------------------------------------

## 2. Core Technologies

### 2.1 Rendering & World

-   **CesiumJS**
    -   3D globe + real-world terrain.
    -   Performance optimization using `requestRenderMode`.
-   **Three.js**
    -   3D aircraft models (GLTF/Custom Mesh).
    -   Dynamic lighting and atmosphere (Fog, Ambient Lighting).

### 2.2 UI & UX

-   **Custom Overlay System**
    -   Main Menu: Start & Options.
    -   Spawn Mode: Interactive map click selection.
    -   Pause Menu: ESC/P key support.
    -   Crash Recovery: Respawn & Restart system.

### 2.3 Controls & Physics

-   **Keyboard Controls**
    -   W/S/Shift/Ctrl: Throttle Control.
    -   Arrows: Pitch & Roll.
    -   A/D: Yaw/Rudder.
-   **Arcade Physics Loop**
    -   Custom physics handler in `planePhysics.js`.
    -   Terrain collision handling.

------------------------------------------------------------------------

## 3. Project Folder Structure

    /web-flight-simulator
    │
    ├── /public
    │   ├── index.html
    │   ├── /assets
    │   │   ├── /fonts (ACES07_Regular.ttf)
    │   │   ├── /hud
    │   │   └── /skybox
    │
    ├── /src
    │   ├── main.js (Game State Controller)
    │
    │   ├── /world
    │   │   ├── cesiumWorld.js (Terrain & Environment)
    │
    │   ├── /plane
    │   │   ├── planePhysics.js
    │   │   └── planeController.js
    │
    │   ├── /ui
    │   │   └── hud.js (Minimap, Compass, Instruments)
    │
    │   └── /utils
    │       └── math.js (Flight math)

------------------------------------------------------------------------

## 4. Game Flow

1.  **Main Menu**: User is greeted with a title screen.
2.  **Spawn Selection**: User picks any coordinate in the world.
3.  **Transition**: Camera glides smoothly from map into the aircraft.
4.  **Simulation**: User flies freely with active HUD instruments.
5.  **Pause/Crash**: Interactive menus to restart or change locations.

------------------------------------------------------------------------

## 5. Roadmap & Development

-   **Phase 1 (Completed)**: Basic simulation, terrain, and keyboard controls.
-   **Phase 2 (Completed)**: UI Menu, Spawn Selection, Transitions, and Fonts.
-   **Phase 3 (Next)**: Integration of MediaPipe Hands for webcam gesture control.
-   **Phase 4 (Next)**: Engine sound effects, volumetric clouds, and simple mission systems.

------------------------------------------------------------------------

## 6. Target Specifications

- Modern browser (Chrome/Edge/Firefox) with WebGL 2.0.
- Hardware with 8GB RAM and stable internet connection (for Cesium terrain data streaming).

