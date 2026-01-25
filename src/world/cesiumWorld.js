import * as Cesium from 'cesium';

let viewer;
let miniViewer;

export function initCesium() {
	viewer = new Cesium.Viewer("cesiumContainer", {
		terrain: Cesium.Terrain.fromWorldTerrain(),
		timeline: false,
		animation: false,
		baseLayerPicker: false,
		geocoder: false,
		homeButton: false,
		infoBox: false,
		sceneModePicker: false,
		selectionIndicator: false,
		navigationHelpButton: false,
		fullscreenButton: false,
		shouldAnimate: false, 
	});

	// Initialize Minimap Viewer with Flat Satellite Imagery
	miniViewer = new Cesium.Viewer("minimapCesium", {
		terrain: null, // Keeps it flat (no 3D mountains)
		timeline: false,
		animation: false,
		baseLayerPicker: false,
		geocoder: false,
		homeButton: false,
		infoBox: false,
		sceneModePicker: false,
		selectionIndicator: false,
		navigationHelpButton: false,
		fullscreenButton: false,
		shouldAnimate: false,
		skyBox: false,
		skyAtmosphere: false,
		contextOptions: {
			webgl: {
				preserveDrawingBuffer: true
			}
		}
	});

	// Basic optimizations for both
	[viewer, miniViewer].forEach(v => {
		v.scene.requestRenderMode = true;
		v.scene.maximumRenderTimeChange = Infinity;
		v.scene.globe.maximumScreenSpaceError = 8;
		v.resolutionScale = 0.8;
		v._cesiumWidget._creditContainer.style.display = "none";
	});

	// Performance optimizations specifically for minimap
	miniViewer.scene.globe.enableLighting = false;
	if (miniViewer.scene.sun) miniViewer.scene.sun.show = false;
	if (miniViewer.scene.moon) miniViewer.scene.moon.show = false;
	miniViewer.scene.fog.enabled = false;
	miniViewer.scene.highDynamicRange = false; // Disable HDR for performance
	miniViewer.scene.postProcessStages.fxaa.enabled = false; // Disable FXAA for performance
	miniViewer.resolutionScale = 1.0; 
	miniViewer.scene.globe.maximumScreenSpaceError = 2; 
	miniViewer.scene.globe.baseColor = Cesium.Color.BLACK; // Fallback color optimization

	// Better Sky and Lighting for main viewer
	viewer.scene.globe.enableLighting = true;
	viewer.scene.highDynamicRange = false;
	viewer.scene.postProcessStages.fxaa.enabled = true;
	viewer.scene.skyAtmosphere = new Cesium.SkyAtmosphere();
	
	viewer.scene.fog.enabled = true;
	viewer.scene.fog.density = 0.0001;

	return viewer;
}

export function setCameraToPlane(lon, lat, alt, heading, pitch, roll) {
	if (!viewer) return;

	viewer.camera.setView({
		destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
		orientation: {
			heading: Cesium.Math.toRadians(heading),
			pitch: Cesium.Math.toRadians(pitch),
			roll: Cesium.Math.toRadians(roll)
		}
	});
	
	viewer.scene.requestRender();
}

export function setMinimapCamera(lon, lat, altitude, heading) {
	if (!miniViewer) return;

	miniViewer.camera.setView({
		destination: Cesium.Cartesian3.fromDegrees(lon, lat, altitude),
		orientation: {
			heading: Cesium.Math.toRadians(heading),
			pitch: Cesium.Math.toRadians(-90), // Top-down
			roll: 0
		}
	});
	
	miniViewer.scene.requestRender();
}

export function getViewer() {
	return viewer;
}

export function getMiniViewer() {
	return miniViewer;
}
