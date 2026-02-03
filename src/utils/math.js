import * as Cesium from 'cesium';

export function movePosition(lon, lat, alt, heading, pitch, distance) {
	const planePos = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
	const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(planePos);

	const headingRad = Cesium.Math.toRadians(heading);
	const pitchRad = Cesium.Math.toRadians(pitch);

	// Calculate direction vector in ENU coordinates
	// X = East, Y = North, Z = Up
	const dirX = Math.sin(headingRad) * Math.cos(pitchRad);
	const dirY = Math.cos(headingRad) * Math.cos(pitchRad);
	const dirZ = Math.sin(pitchRad);

	const movement = new Cesium.Cartesian3(dirX * distance, dirY * distance, dirZ * distance);
	const newPosCartesian = Cesium.Matrix4.multiplyByPoint(modelMatrix, movement, new Cesium.Cartesian3());

	const newCartographic = Cesium.Cartographic.fromCartesian(newPosCartesian);
	
	return {
		lon: Cesium.Math.toDegrees(newCartographic.longitude),
		lat: Cesium.Math.toDegrees(newCartographic.latitude),
		alt: newCartographic.height
	};
}
