import * as THREE from 'three';
import * as Cesium from 'cesium';
import { movePosition } from '../utils/math';

export class WeaponSystem {
	constructor(viewer, scene, planeMesh) {
		this.viewer = viewer;
		this.scene = scene;
		this.planeMesh = planeMesh;

		this.weapons = [
			{ id: 'gun', name: 'M61 VULCAN', ammo: Infinity, reloadTime: 0, lastFire: 0 },
			{ id: 'missile', name: 'AIM-9 SIDEWINDER', ammo: 91, reloadTime: 2.5, lastFire: 0 },
			{ id: 'flare', name: 'FLARE', ammo: 15, reloadTime: 0.2, lastFire: 0 }
		];

		this.currentWeaponIndex = 0;
		this.bullets = [];
		this.missiles = [];
		this.flares = [];
		this.smokeParticles = [];

		this.gunHeat = 0;
		this.maxGunHeat = 100;
		this.gunHeatPerShot = 1.2;
		this.gunCoolRate = 35;
		this.isGunOverheated = false;

		this.smokeGeom = new THREE.SphereGeometry(1, 6, 6);
		this.bulletGeom = new THREE.BoxGeometry(0.1, 10.0, 0.1);
		this.alignForward = new THREE.Matrix4().makeRotationX(Math.PI / 2);
		this.bulletGeom = new THREE.BoxGeometry(0.1, 10.0, 0.1);
		this.bulletGeom.applyMatrix4(this.alignForward);

		this.scratchCartesian = new Cesium.Cartesian3();
		this.scratchMatrix = new Cesium.Matrix4();
		this.scratchHPR = new Cesium.HeadingPitchRoll();
		this.threeMatrix = new THREE.Matrix4();
		this.scratchMat4 = new Cesium.Matrix4();

		this.lastGunFireTime = 0;
		this.gunFireRate = 0.05;

		this.missileSide = 1;
	}

	_getProjectileSpawnData(playerState, offsetX, offsetY, offsetZ) {
		const viewer = this.viewer;
		const camera = viewer.camera;
		const m = this.planeMesh.matrixWorld;

		const camToWorld = (v3) => {
			const res = new Cesium.Cartesian3();
			Cesium.Cartesian3.add(camera.positionWC, Cesium.Cartesian3.multiplyByScalar(camera.right, v3.x, new Cesium.Cartesian3()), res);
			Cesium.Cartesian3.add(res, Cesium.Cartesian3.multiplyByScalar(camera.up, v3.y, new Cesium.Cartesian3()), res);
			Cesium.Cartesian3.add(res, Cesium.Cartesian3.multiplyByScalar(camera.direction, -v3.z, new Cesium.Cartesian3()), res);
			return res;
		};

		const p0 = new THREE.Vector3(offsetX, offsetY, offsetZ).applyMatrix4(m);
		const pF = new THREE.Vector3(offsetX, offsetY, offsetZ - 1.0).applyMatrix4(m);
		const pU = new THREE.Vector3(offsetX, offsetY + 1.0, offsetZ).applyMatrix4(m);

		const w0 = camToWorld(p0);
		const wF = camToWorld(pF);
		const wU = camToWorld(pU);

		const carto = Cesium.Cartographic.fromCartesian(w0);

		const worldForward = Cesium.Cartesian3.subtract(wF, w0, new Cesium.Cartesian3());
		Cesium.Cartesian3.normalize(worldForward, worldForward);
		const worldUp = Cesium.Cartesian3.subtract(wU, w0, new Cesium.Cartesian3());
		Cesium.Cartesian3.normalize(worldUp, worldUp);

		const enuMat = Cesium.Transforms.eastNorthUpToFixedFrame(w0);
		const invEnu = Cesium.Matrix4.inverse(enuMat, new Cesium.Matrix4());

		const lf = Cesium.Matrix4.multiplyByPointAsVector(invEnu, worldForward, new Cesium.Cartesian3());
		const lu = Cesium.Matrix4.multiplyByPointAsVector(invEnu, worldUp, new Cesium.Cartesian3());

		const heading = Cesium.Math.toDegrees(Math.atan2(lf.x, lf.y));
		const pitch = Cesium.Math.toDegrees(Math.asin(Cesium.Math.clamp(lf.z, -1, 1)));

		const hRad = Cesium.Math.toRadians(heading);
		const roll = Cesium.Math.toDegrees(Math.atan2(
			-lu.x * Math.cos(hRad) - lu.y * Math.sin(hRad),
			lu.z
		));

		return {
			lon: Cesium.Math.toDegrees(carto.longitude),
			lat: Cesium.Math.toDegrees(carto.latitude),
			alt: carto.height,
			heading, pitch, roll
		};
	}

	getCurrentWeapon() {
		return this.weapons[this.currentWeaponIndex];
	}

	nextWeapon() {
		this.currentWeaponIndex = (this.currentWeaponIndex + 1) % (this.weapons.length - 1);
	}

	selectWeapon(index) {
		if (index >= 0 && index < this.weapons.length) {
			this.currentWeaponIndex = index;
		}
	}

	fire(playerState) {
		const weapon = this.getCurrentWeapon();
		const now = performance.now() / 1000;

		if (weapon.id === 'gun') {
			if (this.isGunOverheated) return;
			if (now - this.lastGunFireTime > this.gunFireRate) {
				this.fireBullet(playerState);
				this.lastGunFireTime = now;
				this.gunHeat += this.gunHeatPerShot;
				if (this.gunHeat >= this.maxGunHeat) this.isGunOverheated = true;
			}
		} else if (weapon.id === 'missile') {
			if (weapon.ammo > 0 && now - weapon.lastFire > weapon.reloadTime) {
				this.fireMissile(playerState);
				weapon.ammo--;
				weapon.lastFire = now;
			}
		}
	}

	fireFlare(playerState) {
		const flareWeapon = this.weapons.find(w => w.id === 'flare');
		const now = performance.now() / 1000;
		if (flareWeapon.ammo > 0 && now - flareWeapon.lastFire > flareWeapon.reloadTime) {
			this.spawnFlare(playerState);
			flareWeapon.ammo--;
			flareWeapon.lastFire = now;
		}
	}

	fireBullet(playerState) {
		const mat = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.9 });
		const mesh = new THREE.Mesh(this.bulletGeom, mat);
		mesh.matrixAutoUpdate = false;
		this.scene.add(mesh);

		const spawn = this._getProjectileSpawnData(playerState, 0, -0.1, -5.5);

		this.bullets.push({
			mesh: mesh,
			lon: spawn.lon, lat: spawn.lat, alt: spawn.alt,
			heading: spawn.heading, pitch: spawn.pitch, roll: spawn.roll,
			speed: playerState.speed + 1600,
			lifeTime: 1.5
		});
	}

	fireMissile(playerState) {
		const group = new THREE.Group();
		const bodyGeom = new THREE.CylinderGeometry(0.1, 0.1, 2.0, 8);
		bodyGeom.applyMatrix4(this.alignForward);
		const body = new THREE.Mesh(
			bodyGeom,
			new THREE.MeshStandardMaterial({ color: 0xdddddd })
		);
		group.add(body);

		const flameGeom = new THREE.ConeGeometry(0.25, 0.8, 8);
		flameGeom.translate(0, -1.2, 0);
		flameGeom.applyMatrix4(this.alignForward);
		const flame = new THREE.Mesh(
			flameGeom,
			new THREE.MeshBasicMaterial({ color: 0xffaa00 })
		);
		group.add(flame);

		group.matrixAutoUpdate = false;
		this.scene.add(group);

		const spawn = this._getProjectileSpawnData(playerState, this.missileSide * 1.5, -0.3, -1.0);

		this.missiles.push({
			mesh: group, flame: flame,
			lon: spawn.lon, lat: spawn.lat, alt: spawn.alt,
			heading: spawn.heading, pitch: spawn.pitch, roll: spawn.roll,
			speed: playerState.speed + 600,
			lifeTime: 8.0, smokeTimer: 0
		});

		this.missileSide *= -1;
	}

	spawnFlare(playerState) {
		const group = new THREE.Group();
		const flare = new THREE.Mesh(
			new THREE.SphereGeometry(0.5, 8, 8),
			new THREE.MeshBasicMaterial({ color: 0xffffff })
		);
		group.add(flare);

		const light = new THREE.PointLight(0xffaa00, 40, 100);
		group.add(light);

		group.matrixAutoUpdate = false;
		this.scene.add(group);

		const spawn = this._getProjectileSpawnData(playerState, 0, -0.5, 4.0);

		const side = (Math.random() - 0.5) * 60;
		this.flares.push({
			mesh: group,
			lon: spawn.lon, lat: spawn.lat, alt: spawn.alt,
			heading: spawn.heading + side,
			pitch: spawn.pitch - 20 - Math.random() * 20,
			roll: spawn.roll,
			speed: playerState.speed * 0.5 + 60,
			lifeTime: 4.0, smokeTimer: 0
		});
	}

	createSmoke(lon, lat, alt, size = 1.0, life = 2.0, color = 0xffffff) {
		const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.4 });
		const mesh = new THREE.Mesh(this.smokeGeom, mat);
		mesh.matrixAutoUpdate = false;
		this.scene.add(mesh);

		this.smokeParticles.push({
			mesh: mesh,
			lon: lon, lat: lat, alt: alt,
			heading: 0, pitch: 0, speed: 0,
			lifeTime: life, maxLife: life, baseSize: size
		});
	}

	update(dt, playerState) {
		const viewMatrix = this.viewer.camera.viewMatrix;

		if (this.gunHeat > 0) {
			this.gunHeat = Math.max(0, this.gunHeat - this.gunCoolRate * dt);
		}
		if (this.isGunOverheated && this.gunHeat < 15) {
			this.isGunOverheated = false;
		}

		this._updateList(this.bullets, dt, viewMatrix);

		this._updateList(this.missiles, dt, viewMatrix, (m) => {
			m.smokeTimer += dt;
			if (m.smokeTimer > 0.03) {
				this.createSmoke(m.lon, m.lat, m.alt, 0.5, 3.0, 0xeeeeee);
				m.smokeTimer = 0;
			}
			if (m.flame) m.flame.scale.setScalar(0.8 + Math.random() * 0.6);
		});

		this._updateList(this.flares, dt, viewMatrix, (f) => {
			f.pitch -= 10 * dt;
			f.speed *= 0.98;
			f.smokeTimer += dt;
			if (f.smokeTimer > 0.08) {
				this.createSmoke(f.lon, f.lat, f.alt, 0.4, 1.5, 0xffaa00);
				f.smokeTimer = 0;
			}
			const intensity = f.lifeTime / 4.0;
			if (f.mesh.children[1]) f.mesh.children[1].intensity = intensity * 40;
			f.mesh.children[0].material.color.setHex(intensity > 0.5 ? 0xffffff : 0xffaa00);
		});

		this._updateList(this.smokeParticles, dt, viewMatrix, (s) => {
			s.alt += 0.8 * dt;
			const prog = 1.0 - (s.lifeTime / s.maxLife);
			s.mesh.scale.setScalar(s.baseSize * (1.0 + prog * 5.0));
			s.mesh.material.opacity = (1.0 - prog) * 0.4;
		});
	}

	_updateList(list, dt, viewMatrix, extra) {
		for (let i = list.length - 1; i >= 0; i--) {
			const p = list[i];
			if (typeof p.lon !== 'number' || typeof p.lat !== 'number' || isNaN(p.lon) || isNaN(p.lat)) {
				this.scene.remove(p.mesh);
				list.splice(i, 1);
				continue;
			}

			const newPos = movePosition(p.lon, p.lat, p.alt, p.heading || 0, p.pitch || 0, (p.speed || 0) * dt);
			p.lon = newPos.lon; p.lat = newPos.lat; p.alt = newPos.alt;

			if (extra) extra(p);

			p.lifeTime -= dt;
			if (p.lifeTime <= 0) {
				this.scene.remove(p.mesh);
				list.splice(i, 1);
				continue;
			}

			const cartPos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt, undefined, this.scratchCartesian);
			this.scratchHPR.heading = Cesium.Math.toRadians(p.heading || 0);
			this.scratchHPR.pitch = Cesium.Math.toRadians(p.pitch || 0);
			this.scratchHPR.roll = Cesium.Math.toRadians(p.roll || 0);

			const modelMat = Cesium.Transforms.headingPitchRollToFixedFrame(
				cartPos,
				this.scratchHPR,
				Cesium.Ellipsoid.WGS84,
				Cesium.Transforms.eastNorthUpToFixedFrame,
				this.scratchMatrix
			);

			Cesium.Matrix4.multiply(viewMatrix, modelMat, this.scratchMat4);

			for (let j = 0; j < 16; j++) {
				this.threeMatrix.elements[j] = this.scratchMat4[j];
			}

			p.mesh.matrixAutoUpdate = false;
			p.mesh.matrix.copy(this.threeMatrix);
			p.mesh.matrixWorld.copy(p.mesh.matrix);
		}
	}
}
