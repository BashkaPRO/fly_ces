import { setMinimapCamera, getMiniViewer } from '../world/cesiumWorld';

export class HUD {
	constructor() {
		this.speedElem = document.getElementById('speed');
		this.altElem = document.getElementById('altitude');
		this.timeElem = document.getElementById('time');
		this.aircraftElem = document.getElementById('aircraft');
		this.fpsElem = document.getElementById('fps');
		this.localDateTimeElem = document.getElementById('local-datetime');
		this.coordsElem = document.getElementById('coords');
		this.minimapCanvas = document.getElementById('minimap');
		this.miniCtx = this.minimapCanvas.getContext('2d');
		this.uiContainer = document.getElementById('uiContainer');
		this.compassTape = document.getElementById('compass-tape');
		this.headingDisplay = document.getElementById('heading-display');

		this.regionNotif = document.getElementById('region-notification');
		this.regionNameElem = document.getElementById('region-name');
		this.regionTimeout = null;

		this.vignette = document.getElementById('transition-vignette');

		this.startTime = Date.now();

		this.smoothedPitch = 0;
		this.smoothedRoll = 0;
		this.smoothedHeading = 0;
		this.smoothedThrottle = 0;
		this.smoothedYaw = 0;
		this.smoothedBoostScale = 1.0;
		this.currentShakeX = 0;
		this.currentShakeY = 0;

		this.minimapRange = 1;

		this.createHorizon();
		this.createCompass();
		this.resizeMinimap();
		window.addEventListener('resize', () => this.resizeMinimap());
	}

	createCompass() {
		if (!this.compassTape) return;

		const step = 5;
		const pixelsPerDegree = 4;

		this.compassTape.innerHTML = '';

		for (let i = -360; i <= 720; i += step) {
			const tick = document.createElement('div');
			tick.className = 'compass-tick';

			const isMajor = i % 10 === 0;
			const isCardinal = i % 90 === 0;

			tick.style.left = `${(i + 360) * pixelsPerDegree}px`;
			tick.style.height = isMajor ? '10px' : '5px';

			if (isMajor) {
				const label = document.createElement('div');
				label.className = 'compass-label';
				label.style.left = `${(i + 360) * pixelsPerDegree}px`;

				let degree = i % 360;
				if (degree < 0) degree += 360;

				let text = Math.round(degree).toString().padStart(3, '0');
				if (Math.round(degree) === 0 || Math.round(degree) === 360) text = 'N';
				else if (Math.round(degree) === 90) text = 'E';
				else if (Math.round(degree) === 180) text = 'S';
				else if (Math.round(degree) === 270) text = 'W';

				label.innerText = text;
				this.compassTape.appendChild(label);
			}

			this.compassTape.appendChild(tick);
		}
	}

	resetTime() {
		this.startTime = Date.now();
	}

	setMinimapRange(range) {
		this.minimapRange = range;
	}

	showRegion(name) {
		if (this.regionTimeout) {
			clearTimeout(this.regionTimeout);
		}

		this.regionNameElem.innerText = name;
		this.regionNotif.classList.remove('hidden');
		this.regionNotif.classList.remove('region-exit');

		this.regionTimeout = setTimeout(() => {
			this.regionNotif.classList.add('region-exit');
			this.regionTimeout = setTimeout(() => {
				this.regionNotif.classList.add('hidden');
				this.regionTimeout = null;
			}, 1000);
		}, 4000);
	}

	resizeMinimap() {
		this.minimapCanvas.width = this.minimapCanvas.offsetWidth;
		this.minimapCanvas.height = this.minimapCanvas.offsetHeight;

		const miniViewer = getMiniViewer();
		if (miniViewer) {
			miniViewer.resize();
		}
	}

	createHorizon() {
		if (!document.getElementById('horizon-container')) {
			const ui = document.getElementById('uiContainer');
			const horizon = document.createElement('div');
			horizon.id = 'horizon-container';
			horizon.style.cssText = `
				position: absolute;
				top: 50%;
				left: 50%;
				width: 600px;
				height: 600px;
				transform: translate(-50%, -50%);
				pointer-events: none;
				overflow: hidden;
			`;

			const crosshair = document.createElement('div');
			crosshair.style.cssText = `
				position: absolute;
				top: 50%;
				left: 50%;
				width: 40px;
				height: 2px;
				background: #0f0;
				transform: translate(-50%, -50%);
			`;
			const innerCross = document.createElement('div');
			innerCross.style.cssText = `
				position: absolute;
				top: 50%;
				left: 50%;
				width: 2px;
				height: 10px;
				background: #0f0;
				transform: translate(-50%, -50%);
			`;
			crosshair.appendChild(innerCross);
			horizon.appendChild(crosshair);

			const pitchLines = document.createElement('div');
			pitchLines.id = 'pitch-lines';
			pitchLines.style.cssText = `
				position: absolute;
				width: 100%;
				height: 100%;
			`;

			for (let i = -90; i <= 90; i += 10) {
				if (i === 0) continue;
				const line = document.createElement('div');
				line.style.cssText = `
					position: absolute;
					left: 30%;
					width: 40%;
					height: 1px;
					background: rgba(0, 255, 0, 0.5);
					top: ${50 - i}% ;
					text-align: center;
					font-size: 10px;
				`;
				line.innerText = i;
				pitchLines.appendChild(line);
			}

			horizon.appendChild(pitchLines);
			ui.appendChild(horizon);
		}
	}

	update(state) {
		const lerpFactor = 0.5;

		const lerpAngle = (current, target, factor) => {
			let diff = target - current;
			while (diff < -180) diff += 360;
			while (diff > 180) diff -= 360;
			return current + diff * factor;
		};

		const getAngleDiff = (target, current) => {
			let diff = target - current;
			while (diff < -180) diff += 360;
			while (diff > 180) diff -= 360;
			return diff;
		};

		const normalizeAngle = (a) => {
			while (a <= -180) a += 360;
			while (a > 180) a -= 360;
			return a;
		};

		this.smoothedPitch = lerpAngle(this.smoothedPitch, state.pitch, lerpFactor);
		this.smoothedRoll = lerpAngle(this.smoothedRoll, state.roll, lerpFactor);
		this.smoothedHeading = lerpAngle(this.smoothedHeading, state.heading || 0, lerpFactor);
		this.smoothedThrottle = this.smoothedThrottle + ((state.throttle || 0) - this.smoothedThrottle) * (lerpFactor * 0.4);
		this.smoothedYaw = this.smoothedYaw + ((state.yaw || 0) - this.smoothedYaw) * lerpFactor;

		this.smoothedPitch = normalizeAngle(this.smoothedPitch);
		this.smoothedRoll = normalizeAngle(this.smoothedRoll);
		this.smoothedHeading = normalizeAngle(this.smoothedHeading);

		const baseZoom = this.minimapRange * 1500;
		const speedFactor = this.minimapRange * 2;
		let zoomAlt = baseZoom + (state.speed * speedFactor);
		if (state.isBoosting) zoomAlt *= 1.2;
		this.currentZoom = zoomAlt;
		setMinimapCamera(state.lon, state.lat, zoomAlt, this.smoothedHeading);

		const isBoosting = state.isBoosting || false;
		if (this.vignette) {
			this.vignette.style.opacity = isBoosting ? "1" : "0";
		}

		const pitchDiff = getAngleDiff(state.pitch, this.smoothedPitch);
		const rollDiff = getAngleDiff(state.roll, this.smoothedRoll);
		const yawDiff = (state.yaw || 0) - this.smoothedYaw;
		const throttleDiff = (state.throttle || 0) - this.smoothedThrottle;

		if (this.uiContainer) {
			const maxTilt = 15;
			const tiltX = Math.max(-maxTilt, Math.min(maxTilt, pitchDiff * 0.8));
			const tiltY = Math.max(-maxTilt, Math.min(maxTilt, -rollDiff * 0.3 + yawDiff * 5.0));

			const maxShift = 50;
			const shiftX = Math.max(-maxShift, Math.min(maxShift, -rollDiff * 1.5 - yawDiff * 20.0));
			const shiftY = Math.max(-maxShift, Math.min(maxShift, pitchDiff * 3.0 + throttleDiff * 15.0));

			const targetBoostScale = isBoosting ? 1.02 : 1.0;
			this.smoothedBoostScale = this.smoothedBoostScale + (targetBoostScale - this.smoothedBoostScale) * 0.1;

			const scale = (1 + (throttleDiff * 0.25)) * this.smoothedBoostScale;

			if (isBoosting) {
				const time = Date.now() * 0.05;
				this.currentShakeX = Math.sin(time * 1.5) * 2 + Math.cos(time * 2.1) * 1.5;
				this.currentShakeY = Math.cos(time * 1.7) * 2 + Math.sin(time * 2.3) * 1.5;
			} else {
				this.currentShakeX *= 0.85;
				this.currentShakeY *= 0.85;
			}

			this.uiContainer.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translate(${shiftX + this.currentShakeX}px, ${shiftY + this.currentShakeY}px) scale(${scale})`;
		}

		this.speedElem.innerText = Math.round(state.speed).toString().padStart(3, '0');

		let compassHeading = this.smoothedHeading;
		while (compassHeading < 0) compassHeading += 360;
		while (compassHeading >= 360) compassHeading -= 360;

		if (this.headingDisplay) {
			let displayHeading = Math.round(compassHeading);
			if (displayHeading === 360) displayHeading = 0;

			let cardinal = '';
			if (displayHeading >= 337.5 || displayHeading < 22.5) cardinal = 'N';
			else if (displayHeading >= 22.5 && displayHeading < 67.5) cardinal = 'NE';
			else if (displayHeading >= 67.5 && displayHeading < 112.5) cardinal = 'E';
			else if (displayHeading >= 112.5 && displayHeading < 157.5) cardinal = 'SE';
			else if (displayHeading >= 157.5 && displayHeading < 202.5) cardinal = 'S';
			else if (displayHeading >= 202.5 && displayHeading < 247.5) cardinal = 'SW';
			else if (displayHeading >= 247.5 && displayHeading < 292.5) cardinal = 'W';
			else if (displayHeading >= 292.5 && displayHeading < 337.5) cardinal = 'NW';

			this.headingDisplay.innerText = `${displayHeading.toString().padStart(3, '0')} ${cardinal}`;
		}

		if (this.compassTape) {
			const pixelsPerDegree = 4;
			const centerOffset = 160;
			const targetPosOnTape = (compassHeading + 360) * pixelsPerDegree;
			const offset = centerOffset - targetPosOnTape;
			this.compassTape.style.transform = `translateX(${offset}px)`;
		}

		const altFeet = Math.max(0, Math.round(state.alt * 3.28084));
		this.altElem.innerText = altFeet.toString().padStart(5, '0');

		const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
		const h = Math.floor(elapsed / 3600);
		const m = Math.floor((elapsed % 3600) / 60);
		const s = elapsed % 60;
		this.timeElem.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

		const now = new Date();
		const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
		const tzOffsetHours = Math.round((state.lon || 0) / 15);
		const localDate = new Date(utc + (3600000 * tzOffsetHours));

		if (this.localDateTimeElem) {
			const yyyy = localDate.getFullYear();
			const mm = (localDate.getMonth() + 1).toString().padStart(2, '0');
			const dd = localDate.getDate().toString().padStart(2, '0');
			const hh = localDate.getHours().toString().padStart(2, '0');
			const min = localDate.getMinutes().toString().padStart(2, '0');
			const ss = localDate.getSeconds().toString().padStart(2, '0');

			this.localDateTimeElem.innerText = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`;
		}

		if (this.coordsElem) {
			const latDir = state.lat >= 0 ? 'N' : 'S';
			const lonDir = state.lon >= 0 ? 'E' : 'W';
			this.coordsElem.innerText = `POS: ${Math.abs(state.lat).toFixed(4)}°${latDir} ${Math.abs(state.lon).toFixed(4)}°${lonDir}`;
		}

		const pitchLines = document.getElementById('pitch-lines');
		const horizon = document.getElementById('horizon-container');
		if (pitchLines && horizon) {
			horizon.style.transform = `translate(-50%, -50%) rotate(${-this.smoothedRoll}deg)`;
			pitchLines.style.transform = `translateY(${this.smoothedPitch * 6}px)`;
		}

		this.drawMinimap(state);
	}

	drawMinimap(state) {
		if (!this.miniCtx || !this.minimapCanvas) return;

		const ctx = this.miniCtx;
		const w = this.minimapCanvas.width || 250;
		const h = this.minimapCanvas.height || 250;
		const centerX = w / 2;
		const centerY = h / 2;
		const radius = Math.min(centerX, centerY) - 10;

		ctx.clearRect(0, 0, w, h);

		ctx.save();
		ctx.translate(centerX, centerY);

		const heading = this.smoothedHeading;
		ctx.rotate(-heading * Math.PI / 180);

		ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
		ctx.lineWidth = 1.5;

		const metersPerGrid = this.minimapRange * 1000;
		const verticalMeters = (this.currentZoom || (this.minimapRange * 1500)) * 1.1547;
		const gridSize = (metersPerGrid * h) / verticalMeters;

		const limit = radius * 2;
		for (let x = 0; x <= limit; x += gridSize) {
			ctx.beginPath();
			ctx.moveTo(x, -limit); ctx.lineTo(x, limit); ctx.stroke();
			if (x > 0) {
				ctx.beginPath();
				ctx.moveTo(-x, -limit); ctx.lineTo(-x, limit); ctx.stroke();
			}
		}
		for (let y = 0; y <= limit; y += gridSize) {
			ctx.beginPath();
			ctx.moveTo(-limit, y); ctx.lineTo(limit, y); ctx.stroke();
			if (y > 0) {
				ctx.beginPath();
				ctx.moveTo(-limit, -y); ctx.lineTo(limit, -y); ctx.stroke();
			}
		}

		ctx.fillStyle = '#0f0';
		ctx.font = 'bold 18px AceCombat';
		ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
		ctx.shadowBlur = 4;
		ctx.textAlign = 'center';

		const directions = [
			{ label: 'N', angle: 0 },
			{ label: 'E', angle: 90 },
			{ label: 'S', angle: 180 },
			{ label: 'W', angle: 270 }
		];

		directions.forEach(dir => {
			const rad = dir.angle * Math.PI / 180;
			const dx = Math.sin(rad) * radius;
			const dy = -Math.cos(rad) * radius;

			ctx.save();
			ctx.translate(dx, dy);
			ctx.rotate(this.smoothedHeading * Math.PI / 180);
			ctx.fillText(dir.label, 0, 5);
			ctx.restore();
		});

		ctx.restore();

		ctx.save();
		ctx.translate(centerX, centerY);
		ctx.fillStyle = '#0f0';
		ctx.shadowBlur = 0;
		ctx.beginPath();
		ctx.moveTo(0, -12);
		ctx.lineTo(8, 10);
		ctx.lineTo(0, 5);
		ctx.lineTo(-8, 10);
		ctx.closePath();
		ctx.fill();

		ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(0, 0, radius, 0, Math.PI * 2);
		ctx.stroke();

		ctx.restore();

		const sweepTime = (Date.now() / 1500) % 1;
		ctx.strokeStyle = `rgba(0, 255, 0, ${0.6 * (1 - sweepTime)})`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(centerX, centerY, sweepTime * radius, 0, Math.PI * 2);
		ctx.stroke();
	}

	updateFPS(fps) {
		if (this.fpsElem) {
			this.fpsElem.innerText = Math.round(fps).toString();
		}
	}
}
