import * as THREE from 'three';
import { initCesium, setCameraToPlane, getViewer } from './world/cesiumWorld';
import { PlanePhysics } from './plane/planePhysics';
import { PlaneController } from './plane/planeController';
import { movePosition } from './utils/math';
import { HUD } from './ui/hud';
import * as Cesium from 'cesium';

// Game States
const States = {
	MENU: 'MENU',
	PICK_SPAWN: 'PICK_SPAWN',
	FLYING: 'FLYING',
	PAUSED: 'PAUSED',
	CRASHED: 'CRASHED'
};

let currentState = States.MENU;

// Flight State
let state = {
	lon: 106.8272,
	lat: -6.1754,
	alt: 1000,
	heading: 0,
	pitch: 0,
	roll: 0,
	speed: 0,
	throttle: 0
};

let scene, camera, renderer;
let planeModel;
let physics = new PlanePhysics();
let controller = new PlaneController();
let hud = new HUD();

// DOM Elements
const mainMenu = document.getElementById('mainMenu');
const pauseMenu = document.getElementById('pauseMenu');
const crashMenu = document.getElementById('crashMenu');
const uiContainer = document.getElementById('uiContainer');
const threeContainer = document.getElementById('threeContainer');
const spawnInstruction = document.getElementById('spawnInstruction');
const confirmSpawnBtn = document.getElementById('confirmSpawnBtn');

let spawnMarker = null;

function initThree() {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

	renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setClearColor(0x000000, 0); // Ensure full transparency
	threeContainer.appendChild(renderer.domElement);
	
	threeContainer.classList.add('hidden'); // Start hidden

	const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
	scene.add(ambientLight);
	const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
	directionalLight.position.set(5, 10, 5);
	scene.add(directionalLight);

	const geometry = new THREE.BoxGeometry(2, 0.5, 4);
	const material = new THREE.MeshBasicMaterial({ 
		color: 0xff0000,
		wireframe: false
	});
	planeModel = new THREE.Mesh(geometry, material);
	scene.add(planeModel);

	// Position relative to cockpit view
	planeModel.position.set(0, -1.2, -6);
}

function update(dt) {
	if (currentState !== States.FLYING) return;

	const input = controller.update();
	const physicsResult = physics.update(input, dt);

	state.speed = physicsResult.speed;
	state.pitch = physicsResult.pitch;
	state.roll = physicsResult.roll;
	state.heading = physicsResult.heading;

	const newPos = movePosition(state.lon, state.lat, state.alt, state.heading, state.pitch, state.speed * dt);
	state.lon = newPos.lon;
	state.lat = newPos.lat;
	state.alt = newPos.alt;

	// Check for crash
	checkCrash();

	// New HUD Update
	hud.update(state);

	setCameraToPlane(state.lon, state.lat, state.alt, state.heading, state.pitch, state.roll);

	if (planeModel) {
		planeModel.rotation.z = THREE.MathUtils.degToRad(-state.roll);
		planeModel.rotation.x = THREE.MathUtils.degToRad(state.pitch);
	}
}

let lastCrashCheck = 0;
let flightStartTime = 0;

function checkCrash() {
	if (currentState !== States.FLYING) return;
	
	const now = Date.now();
	if (now - lastCrashCheck < 100) return; // Only check 10 times per second
	lastCrashCheck = now;

	// Grace period: ignore crashes for first 3 seconds to allow terrain to load
	if (now - flightStartTime < 3000) return;

	const viewer = getViewer();
	if (!viewer) return;

	const cartographic = Cesium.Cartographic.fromDegrees(state.lon, state.lat);
	const terrainHeight = viewer.scene.globe.getHeight(cartographic);

	if (terrainHeight !== undefined && state.alt <= terrainHeight + 5) {
		currentState = States.CRASHED;
		uiContainer.classList.add('hidden');
		threeContainer.classList.add('hidden');
		crashMenu.classList.remove('hidden');
	}
}

function animate() {
	requestAnimationFrame(animate);
	
	if (currentState === States.FLYING || currentState === States.PAUSED) {
		update(0.016);
		threeContainer.classList.remove('hidden');
		renderer.render(scene, camera);
	} else {
		threeContainer.classList.add('hidden');
	}
}

// UI Handlers
document.getElementById('startBtn').onclick = () => {
	mainMenu.classList.add('hidden');
	enterSpawnPicking();
};

document.getElementById('optionsBtn').onclick = () => {
	alert('Options: \n- Controls: WASD/Arrows\n- Camera: Follow\n- Sensitivity: 1.0\n(Work in Progress)');
};

document.getElementById('resumeBtn').onclick = () => {
	pauseMenu.classList.add('hidden');
	uiContainer.classList.remove('hidden');
	currentState = States.FLYING;
};

document.getElementById('restartBtn').onclick = () => {
	pauseMenu.classList.add('hidden');
	enterSpawnPicking();
};

document.getElementById('quitBtn').onclick = () => {
	location.reload();
};

document.getElementById('respawnBtn').onclick = () => {
	crashMenu.classList.add('hidden');
	enterSpawnPicking();
};

function enterSpawnPicking() {
	spawnInstruction.classList.remove('hidden');
	threeContainer.classList.add('hidden');
	uiContainer.classList.add('hidden');
	currentState = States.PICK_SPAWN;
	confirmSpawnBtn.classList.add('hidden');
	
	if (spawnMarker) {
		const viewer = getViewer();
		viewer.entities.remove(spawnMarker);
		spawnMarker = null;
	}

	const viewer = getViewer();
	viewer.camera.flyTo({
		destination: Cesium.Cartesian3.fromDegrees(state.lon, state.lat, 15000),
		duration: 1.5
	});
}

// Spawn logic
function setupSpawnPicker() {
	const viewer = getViewer();
	const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
	
	handler.setInputAction((click) => {
		if (currentState !== States.PICK_SPAWN) return;
		
		const ray = viewer.camera.getPickRay(click.position);
		const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
		
		if (cartesian) {
			const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
			const lon = Cesium.Math.toDegrees(cartographic.longitude);
			const lat = Cesium.Math.toDegrees(cartographic.latitude);
			
			// Ensure terrain height is at least sea level (0) for safety
			const terrainHeight = Math.max(0, cartographic.height);
			
			// Update pending state
			state.lon = lon;
			state.lat = lat;
			state.alt = terrainHeight + 1500; // Start at ~5000ft (1500m) for breathing room
			
			// Visual marker
			if (spawnMarker) {
				viewer.entities.remove(spawnMarker);
			}
			spawnMarker = viewer.entities.add({
				position: cartesian,
				point: {
					pixelSize: 15,
					color: Cesium.Color.RED,
					outlineColor: Cesium.Color.WHITE,
					outlineWidth: 2
				},
				label: {
					text: "Target Spawn Location",
					font: "14pt sans-serif",
					style: Cesium.LabelStyle.FILL_AND_OUTLINE,
					outlineWidth: 2,
					verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
					pixelOffset: new Cesium.Cartesian2(0, -20)
				}
			});

			confirmSpawnBtn.classList.remove('hidden');
		}
	}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

document.getElementById('confirmSpawnBtn').onclick = () => {
	const viewer = getViewer();
	if (spawnMarker) {
		viewer.entities.remove(spawnMarker);
		spawnMarker = null;
	}

	// Cancel teleport/flyTo and set camera immediately
	viewer.camera.cancelFlight();

	state.speed = 150;
	state.pitch = 0;
	state.roll = 0;
	state.heading = 0;
	
	// Reset physics and HUD timer
	physics = new PlanePhysics();
	hud.resetTime();
	hud.resizeMinimap(); 
	flightStartTime = Date.now();
	
	// Force immediate camera sync
	setCameraToPlane(state.lon, state.lat, state.alt, state.heading, state.pitch, state.roll);
	
	spawnInstruction.classList.add('hidden');
	confirmSpawnBtn.classList.add('hidden');
	uiContainer.classList.remove('hidden');
	threeContainer.classList.remove('hidden');

	// Resize HUD after showing it so offsetWidth/Height are non-zero
	setTimeout(() => {
		hud.resizeMinimap();
	}, 10);

	currentState = States.FLYING;
};

// Keyboard for Pause
window.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
		if (currentState === States.FLYING) {
			currentState = States.PAUSED;
			uiContainer.classList.add('hidden');
			pauseMenu.classList.remove('hidden');
		} else if (currentState === States.PAUSED) {
			currentState = States.FLYING;
			pauseMenu.classList.add('hidden');
			uiContainer.classList.remove('hidden');
		}
	}
});

const viewer = initCesium();
initThree();
setupSpawnPicker();

// Ensure everything is hidden at start
uiContainer.classList.add('hidden');
threeContainer.classList.add('hidden');

animate();

window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
