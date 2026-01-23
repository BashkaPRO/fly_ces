import * as Cesium from 'cesium';

let viewer;

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
		shouldAnimate: false, // Don't animate in background
	});

	// Performance Optimizations
	viewer.scene.requestRenderMode = true;
	viewer.scene.maximumRenderTimeChange = Infinity;
	viewer.scene.globe.maximumScreenSpaceError = 8; // Lower quality for better performance
	viewer.resolutionScale = 0.8; // Reduce internal resolution slightly
	
	// Better Sky and Lighting
	viewer.scene.globe.enableLighting = true;
	viewer.scene.highDynamicRange = false;
	viewer.scene.postProcessStages.fxaa.enabled = true;
	viewer.scene.skyAtmosphere = new Cesium.SkyAtmosphere();
	
	viewer.scene.fog.enabled = true;
	viewer.scene.fog.density = 0.0001;

	// Hide Cesium logo/credit for clean UI
	viewer._cesiumWidget._creditContainer.style.display = "none";

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
	
	// Manually trigger render since requestRenderMode is true
	viewer.scene.requestRender();
}

export function getViewer() {
	return viewer;
}
