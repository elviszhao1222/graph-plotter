// Plotter: canvas-based function plotter with grid, axes, pan, and zoom

export class Plotter {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.devicePixelRatio = window.devicePixelRatio || 1;

		// World/view parameters
		this.xMin = -10;
		this.xMax = 10;
		this.yMin = -6;
		this.yMax = 6;

		this.sampleCount = 1200; // base samples; adaptive step used at draw
		this.series = [{ color: '#3fa7ff', fn: (x) => Math.sin(x), visible: true }];

		this.backgroundColor = this.getColorVar('--bg', '#0f1115');
		this.gridColor = this.getColorVar('--grid', '#2a2f3a');
		this.axisColor = this.getColorVar('--axis', '#6b7280');
		this.textColor = this.getColorVar('--text', '#e6e6e6');
		this.accentColor = this.getColorVar('--accent', '#3fa7ff');

		this.resizeObserver = new ResizeObserver(() => this.resizeToDisplaySize());
		this.resizeObserver.observe(this.canvas);
		this.resizeToDisplaySize();
	}

	setFunction(fn) {
		this.series = [{ color: this.accentColor, fn, visible: true }];
		this.draw();
	}

	setSeries(series) {
		this.series = Array.isArray(series) ? series : [];
		this.draw();
	}

	getColorVar(name, fallback) {
		const v = getComputedStyle(document.documentElement).getPropertyValue(name);
		return (v && v.trim()) || fallback;
	}

	setDomain(xMin, xMax) {
		if (xMin === xMax) {
			xMax = xMin + 1e-6;
		}
		this.xMin = Math.min(xMin, xMax);
		this.xMax = Math.max(xMin, xMax);
		this.draw();
	}

	setYRange(yMin, yMax) {
		if (yMin === yMax) {
			yMax = yMin + 1e-6;
		}
		this.yMin = Math.min(yMin, yMax);
		this.yMax = Math.max(yMin, yMax);
		this.draw();
	}

	// Convert between world (math) and screen coordinates
	worldToScreen(x, y) {
		// Use CSS pixels for drawing space (ctx is scaled via setTransform)
		const width = this.canvas.clientWidth;
		const height = this.canvas.clientHeight;
		const sx = ((x - this.xMin) / (this.xMax - this.xMin)) * width;
		const sy = height - ((y - this.yMin) / (this.yMax - this.yMin)) * height;
		return { x: sx, y: sy };
	}

	screenToWorld(sx, sy) {
		const width = this.canvas.clientWidth;
		const height = this.canvas.clientHeight;
		const x = this.xMin + (sx / width) * (this.xMax - this.xMin);
		const y = this.yMin + ((height - sy) / height) * (this.yMax - this.yMin);
		return { x, y };
	}

	// Zoom around a focal point (screen coords)
	zoomAt(screenX, screenY, scale) {
		const before = this.screenToWorld(screenX, screenY);
		const xCenter = before.x;
		const yCenter = before.y;

		const xHalfSpan = (this.xMax - this.xMin) * 0.5 / scale;
		const yHalfSpan = (this.yMax - this.yMin) * 0.5 / scale;

		this.xMin = xCenter - xHalfSpan;
		this.xMax = xCenter + xHalfSpan;
		this.yMin = yCenter - yHalfSpan;
		this.yMax = yCenter + yHalfSpan;
		this.draw();
	}

	// Pan by screen delta
	panBy(deltaScreenX, deltaScreenY) {
		const width = this.canvas.clientWidth;
		const height = this.canvas.clientHeight;
		const dx = (deltaScreenX / width) * (this.xMax - this.xMin);
		const dy = (deltaScreenY / height) * (this.yMax - this.yMin);
		this.xMin -= dx;
		this.xMax -= dx;
		this.yMin += dy;
		this.yMax += dy;
		this.draw();
	}

	resizeToDisplaySize() {
		const cssWidth = Math.floor(this.canvas.clientWidth);
		const cssHeight = Math.floor(this.canvas.clientHeight);
		const dpr = window.devicePixelRatio || 1;
		this.devicePixelRatio = dpr;

		if (this.canvas.width !== cssWidth * dpr || this.canvas.height !== cssHeight * dpr) {
			this.canvas.width = Math.max(1, cssWidth * dpr);
			this.canvas.height = Math.max(1, cssHeight * dpr);
		}
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.draw();
	}

	clear() {
		const ctx = this.ctx;
		const w = this.canvas.clientWidth;
		const h = this.canvas.clientHeight;
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.restore();
		ctx.fillStyle = this.backgroundColor.trim();
		ctx.fillRect(0, 0, w, h);
	}

	// Choose a nice grid spacing based on current scale
	computeNiceStep(span) {
		const raw = span / 10; // target ~10 grid lines
		const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
		const base = raw / pow10;
		let nice;
		if (base < 1.5) nice = 1;
		else if (base < 3.5) nice = 2;
		else if (base < 7.5) nice = 5;
		else nice = 10;
		return nice * pow10;
	}

	drawGridAndAxes() {
		const ctx = this.ctx;
		const w = this.canvas.clientWidth;
		const h = this.canvas.clientHeight;
		const xSpan = this.xMax - this.xMin;
		const ySpan = this.yMax - this.yMin;
		const xStep = this.computeNiceStep(xSpan);
		const yStep = this.computeNiceStep(ySpan);

		ctx.save();
		ctx.strokeStyle = this.gridColor.trim();
		ctx.lineWidth = 1;
		ctx.beginPath();

		const xStart = Math.ceil(this.xMin / xStep) * xStep;
		for (let x = xStart; x <= this.xMax + 1e-9; x += xStep) {
			const s = this.worldToScreen(x, 0);
			ctx.moveTo(Math.round(s.x) + 0.5, 0);
			ctx.lineTo(Math.round(s.x) + 0.5, h);
		}

		const yStart = Math.ceil(this.yMin / yStep) * yStep;
		for (let y = yStart; y <= this.yMax + 1e-9; y += yStep) {
			const s = this.worldToScreen(0, y);
			ctx.moveTo(0, Math.round(s.y) + 0.5);
			ctx.lineTo(w, Math.round(s.y) + 0.5);
		}

		ctx.stroke();

		// Axes
		ctx.strokeStyle = this.axisColor.trim();
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		const sY = this.worldToScreen(0, 0).y;
		if (sY >= 0 && sY <= h) {
			ctx.moveTo(0, Math.round(sY) + 0.5);
			ctx.lineTo(w, Math.round(sY) + 0.5);
		}
		const sX = this.worldToScreen(0, 0).x;
		if (sX >= 0 && sX <= w) {
			ctx.moveTo(Math.round(sX) + 0.5, 0);
			ctx.lineTo(Math.round(sX) + 0.5, h);
		}
		ctx.stroke();

		// Ticks/labels
		ctx.fillStyle = this.textColor.trim();
		ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		for (let x = xStart; x <= this.xMax + 1e-9; x += xStep) {
			if (Math.abs(x) < 1e-12) continue;
			const s = this.worldToScreen(x, 0);
			const label = this.formatNumber(x);
			ctx.fillText(label, s.x, Math.min(h - 14, Math.max(2, sY + 4)));
		}
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		for (let y = yStart; y <= this.yMax + 1e-9; y += yStep) {
			if (Math.abs(y) < 1e-12) continue;
			const s = this.worldToScreen(0, y);
			const label = this.formatNumber(y);
			ctx.fillText(label, Math.min(w - 2, sX - 4), s.y);
		}

		ctx.restore();
	}

	formatNumber(n) {
		const abs = Math.abs(n);
		if ((abs !== 0 && (abs < 1e-3 || abs >= 1e5))) {
			return n.toExponential(2);
		}
		return Math.round(n * 1e6) / 1e6 + '';
	}

	plotFunction() {
		const ctx = this.ctx;
		const w = this.canvas.clientWidth;
		const xSpan = this.xMax - this.xMin;
		const pixelsPerX = w / xSpan;
		const step = Math.max(1 / pixelsPerX, xSpan / this.sampleCount);

		const polylines = this.sampleAllSeries(step);
		for (const pl of polylines) {
			if (!pl.points || pl.points.length === 0) continue;
			ctx.save();
			ctx.strokeStyle = (pl.color || this.accentColor).trim();
			ctx.lineWidth = pl.lineWidth || 2;
			ctx.beginPath();
			let first = true;
			for (const p of pl.points) {
				const s = this.worldToScreen(p.x, p.y);
				if (first) { ctx.moveTo(s.x, s.y); first = false; }
				else { ctx.lineTo(s.x, s.y); }
			}
			ctx.stroke();
			ctx.restore();
		}
	}

	sampleAllSeries(step) {
		const out = [];
		for (const serie of this.series) {
			if (!serie || !serie.visible) continue;
			if (serie.type === 'cartesian' && typeof serie.fn === 'function') {
				out.push({ color: serie.color, points: this.sampleCartesian(serie.fn, step) });
			} else if (serie.type === 'polar' && typeof serie.rfn === 'function') {
				out.push({ color: serie.color, points: this.samplePolar(serie.rfn) });
			} else if (serie.type === 'relation' && typeof serie.F === 'function') {
				for (const seg of this.sampleRelationMarchingSquares(serie.F)) {
					out.push({ color: serie.color, points: seg });
				}
			}
		}
		return out;
	}

	sampleCartesian(fn, step) {
		const pts = [];
		for (let x = this.xMin; x <= this.xMax + 1e-9; x += step) {
			const y = safeEval(fn, x);
			if (Number.isFinite(y)) pts.push({ x, y });
		}
		return pts;
		function safeEval(f, x) { try { return f(x); } catch { return NaN; } }
	}

	samplePolar(rfn) {
		const pts = [];
		const thetaMin = -2 * Math.PI, thetaMax = 2 * Math.PI;
		const N = 1000;
		for (let i = 0; i <= N; i++) {
			const t = thetaMin + (i / N) * (thetaMax - thetaMin);
			const r = safeEval(rfn, t);
			if (!Number.isFinite(r)) { continue; }
			const x = r * Math.cos(t);
			const y = r * Math.sin(t);
			pts.push({ x, y });
		}
		return pts;
		function safeEval(f, x) { try { return f(x); } catch { return NaN; } }
	}

	sampleRelationMarchingSquares(F) {
		// Basic marching squares to extract zero contour
		const segments = [];
		const cols = 48, rows = 32;
		const dx = (this.xMax - this.xMin) / cols;
		const dy = (this.yMax - this.yMin) / rows;
		const values = [];
		for (let j = 0; j <= rows; j++) {
			values[j] = [];
			for (let i = 0; i <= cols; i++) {
				const x = this.xMin + i * dx;
				const y = this.yMin + j * dy;
				values[j][i] = safeEval2(F, x, y);
			}
		}
		function interp(p1, p2, v1, v2) {
			const t = v1 === v2 ? 0.5 : (0 - v1) / (v2 - v1);
			return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
		}
		for (let j = 0; j < rows; j++) {
			for (let i = 0; i < cols; i++) {
				const x = this.xMin + i * dx;
				const y = this.yMin + j * dy;
				const p = [
					{ x: x, y: y },
					{ x: x + dx, y: y },
					{ x: x + dx, y: y + dy },
					{ x: x, y: y + dy },
				];
				const v = [values[j][i], values[j][i + 1], values[j + 1][i + 1], values[j + 1][i]];
				let idx = 0;
				for (let k = 0; k < 4; k++) if (v[k] > 0) idx |= (1 << k);
				if (idx === 0 || idx === 15) continue;
				const edges = [];
				const addEdge = (a, b) => edges.push(interp(p[a], p[b], v[a], v[b]));
				switch (idx) {
					case 1: case 14: addEdge(0,3); addEdge(0,1); break;
					case 2: case 13: addEdge(0,1); addEdge(1,2); break;
					case 3: case 12: addEdge(0,3); addEdge(1,2); break;
					case 4: case 11: addEdge(1,2); addEdge(2,3); break;
					case 5: addEdge(0,1); addEdge(2,3); break;
					case 10: addEdge(0,3); addEdge(1,2); break;
					case 6: case 9: addEdge(0,1); addEdge(3,0); break;
					case 7: case 8: addEdge(2,3); addEdge(3,0); break;
					default: break;
				}
				if (edges.length === 2) segments.push(edges);
			}
		}
		return segments;
		function safeEval2(f, x, y) { try { return f(x, y); } catch { return NaN; } }
	}

	/**
	 * Find x-axis (f(x)=0) and y-axis (f(0)) intercepts inside view for all visible series.
	 * Returns [{seriesIdx, type, x, y, sx, sy, color}].
	 * - type: 'x'|'y'
	 */
	findIntercepts() {
		const intercepts = [];
		const sampleN = Math.max(120, Math.floor(this.sampleCount / 5));
		const y0 = 0;
		for (let i = 0; i < this.series.length; ++i) {
			const serie = this.series[i];
			if (!serie || !serie.visible) continue;
			// X intercepts: scan per step
			let prevX = this.xMin, prevY = safeEval(serie.fn, prevX);
			for (let j = 1; j <= sampleN; ++j) {
				const x = this.xMin + (j / sampleN) * (this.xMax - this.xMin);
				const y = safeEval(serie.fn, x);
				if (Number.isFinite(prevY) && Number.isFinite(y)) {
					if ((prevY === 0 && y === 0) || (prevY * y < 0)) {
						// Crossed x-axis, estimate root by linear interpolation
						const t = prevY === y ? 0.5 : (0 - prevY) / (y - prevY);
						const xr = prevX + t * (x - prevX);
						const intercept = { seriesIdx: i, type: 'x', x: xr, y: 0, color: serie.color };
						const s = this.worldToScreen(xr, 0);
						intercept.sx = s.x; intercept.sy = s.y;
						intercepts.push(intercept);
					}
				}
				prevX = x;
				prevY = y;
			}
			// Y intercept (if in view): x = 0
			if (this.xMin < 0 && this.xMax > 0) {
				let yInt = safeEval(serie.fn, 0);
				if (Number.isFinite(yInt) && yInt >= this.yMin && yInt <= this.yMax) {
					const s = this.worldToScreen(0, yInt);
					intercepts.push({ seriesIdx: i, type: 'y', x: 0, y: yInt, color: serie.color, sx: s.x, sy: s.y });
				}
			}
		}
		return intercepts;
		function safeEval(fn, x) { try { return fn(x); } catch { return NaN;} }
	}

	/**
	 * Find pairwise intersections between visible series within current x-range.
	 * Uses sampling then refines roots by bisection on g(x)=f1(x)-f2(x).
	 * Returns [{seriesI, seriesJ, type:'ff', x, y, sx, sy, color, labels:{a,b}}]
	 */
	findFunctionIntersections() {
		const results = [];
		const visibles = this.series
			.map((s, idx) => ({ s, idx }))
			.filter(v => v.s && v.s.visible && typeof v.s.fn === 'function');
		if (visibles.length < 2) return results;
		const sampleN = Math.min(400, Math.max(120, Math.floor(this.sampleCount / 3)));
		const x0 = this.xMin, x1 = this.xMax;
		const step = (x1 - x0) / sampleN;
		for (let a = 0; a < visibles.length; a++) {
			for (let b = a + 1; b < visibles.length; b++) {
				const S1 = visibles[a];
				const S2 = visibles[b];
				let prevX = x0;
				let prevG = diffSafe(S1.s.fn, S2.s.fn, prevX);
				for (let i = 1; i <= sampleN; i++) {
					const x = x0 + i * step;
					const g = diffSafe(S1.s.fn, S2.s.fn, x);
					if (Number.isFinite(prevG) && Number.isFinite(g) && prevG * g <= 0) {
						const xr = bisectRoot((xx) => diffSafe(S1.s.fn, S2.s.fn, xx), prevX, x, 20);
						if (xr != null && xr >= this.xMin && xr <= this.xMax) {
							const y = safeEval(S1.s.fn, xr);
							if (Number.isFinite(y) && y >= this.yMin && y <= this.yMax) {
								const sc = this.worldToScreen(xr, y);
								results.push({
									seriesI: S1.idx,
									seriesJ: S2.idx,
									type: 'ff',
									x: xr,
									y,
									sx: sc.x,
									sy: sc.y,
									color: S1.s.color || this.accentColor,
									labels: { a: S1.s.expr, b: S2.s.expr }
								});
							}
						}
					}
					prevX = x;
					prevG = g;
				}
			}
		}
		return dedupeClose(results, 6);

		function safeEval(fn, x) { try { return fn(x); } catch { return NaN; } }
		function diffSafe(f, g, x) {
			const a = safeEval(f, x); const b = safeEval(g, x);
			if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
			return a - b;
		}
		function bisectRoot(f, a, b, iters) {
			let fa = f(a); let fb = f(b);
			if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
			if (fa === 0) return a; if (fb === 0) return b;
			if (fa * fb > 0) return null;
			let lo = a, hi = b, flo = fa, fhi = fb;
			for (let k = 0; k < iters; k++) {
				const mid = 0.5 * (lo + hi);
				const fm = f(mid);
				if (!Number.isFinite(fm)) return null;
				if (Math.abs(fm) < 1e-9) return mid;
				if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
			}
			return 0.5 * (lo + hi);
		}
		function dedupeClose(points, threshPx) {
			const out = [];
			for (const p of points) {
				if (!out.some(q => Math.hypot(p.sx - q.sx, p.sy - q.sy) < threshPx)) out.push(p);
			}
			return out;
		}
	}

	/**
	 * Draw intercept dots for all visible series
	 */
	drawInterceptDots() {
		const ctx = this.ctx;
		const intercepts = this.findIntercepts();
		for (const i of intercepts) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(i.sx, i.sy, 6, 0, Math.PI * 2);
			ctx.fillStyle = i.color || this.accentColor;
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2;
			ctx.globalAlpha = 0.92;
			ctx.fill();
			ctx.stroke();
			ctx.restore();
		}
	}

	/** Draw function-function intersection dots */
	drawFunctionIntersectionDots() {
		const ctx = this.ctx;
		const pts = this.findFunctionIntersections();
		for (const p of pts) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(p.sx, p.sy, 6, 0, Math.PI * 2);
			ctx.fillStyle = p.color || this.accentColor;
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2;
			ctx.globalAlpha = 0.92;
			ctx.fill();
			ctx.stroke();
			ctx.restore();
		}
	}

	/**
	 * Given screen coords, returns {intercept, dist} for nearest intercept if within threshold px, else null
	 */
	getInterceptAtScreen(sx, sy, thresholdPx = 12) {
		let nearest = null, minDist = thresholdPx;
		const intercepts = [...this.findIntercepts(), ...this.findFunctionIntersections()];
		for (const i of intercepts) {
			const d = Math.hypot(i.sx - sx, i.sy - sy);
			if (d <= minDist) {
				nearest = i;
				minDist = d;
			}
		}
		return nearest ? { intercept: nearest, dist: minDist } : null;
	}

	draw(errorMessage) {
		this.clear();
		this.drawGridAndAxes();
		if (!errorMessage) {
			try {
				this.plotFunction();
				this.drawInterceptDots();
				this.drawFunctionIntersectionDots();
			} catch (e) {
				this.drawErrorOverlay(e.message || String(e));
			}
		} else {
			this.drawErrorOverlay(errorMessage);
		}
	}

	drawErrorOverlay(message) {
		const ctx = this.ctx;
		const w = this.canvas.clientWidth;
		const h = this.canvas.clientHeight;
		ctx.save();
		ctx.fillStyle = 'rgba(255, 107, 107, 0.08)';
		ctx.fillRect(0, h - 80, Math.min(w, 560), 70);
		ctx.fillStyle = '#ff6b6b';
		ctx.font = '13px system-ui, -apple-system, Segoe UI, Roboto, Arial';
		ctx.textBaseline = 'top';
		ctx.fillText(message, 12, h - 70);
		ctx.restore();
	}
}


