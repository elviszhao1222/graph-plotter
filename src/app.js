import { Plotter } from './plotter.js';
import { createAccount, login, logout, onAuthStateChanged, getCurrentUser } from './auth.js';

(function () {
	const canvas = document.getElementById('plot-canvas');
	const xMinInput = document.getElementById('domain-min');
	const xMaxInput = document.getElementById('domain-max');
	const resetViewBtn = document.getElementById('reset-view-btn');
	const exportBtn = document.getElementById('export-btn');
	const importFile = document.getElementById('import-file');
	const errorDiv = document.getElementById('error');
	const sidebar = document.getElementById('series-sidebar');
	const seriesList = document.getElementById('series-list');
	const addSeriesBtn = document.getElementById('add-series-btn');
	const variablesList = document.getElementById('variables-list');
	const addVarBtn = document.getElementById('add-var-btn');

	// Auth elements
	const loginOpenBtn = document.getElementById('login-open-btn');
	const logoutBtn = document.getElementById('logout-btn');
	const userLabel = document.getElementById('user-label');
	const authBackdrop = document.getElementById('auth-backdrop');
	const authModal = document.getElementById('auth-modal');
	const modalClose = document.getElementById('modal-close');
	const tabLogin = document.getElementById('tab-login');
	const tabSignup = document.getElementById('tab-signup');
	const authEmail = document.getElementById('auth-email');
	const authPassword = document.getElementById('auth-password');
	const loginBtn = document.getElementById('login-btn');
	const signupBtn = document.getElementById('signup-btn');
	const authError = document.getElementById('auth-error');

	const plotter = new Plotter(canvas);
	const tooltip = document.getElementById('intercept-tooltip');

	function setError(message) {
		if (message) {
			errorDiv.textContent = message;
			errorDiv.hidden = false;
			plotter.draw(message);
		} else {
			errorDiv.hidden = true;
			plotter.draw();
		}
	}

	function compileExpression(exprText, varValues = {}) {
		// Use math.js to compile expression f(x) with variable context
		const node = math.parse(exprText);
		const code = node.compile();
		return (x) => {
			const value = code.evaluate({ x, ...varValues });
			return typeof value === 'number' ? value : Number(value);
		};
	}

	function compileExpression2D(exprText, varValues = {}) {
		// For relations: F(x,y) with variables
		const node = math.parse(exprText);
		const code = node.compile();
		return (x, y) => {
			const value = code.evaluate({ x, y, ...varValues });
			return typeof value === 'number' ? value : Number(value);
		};
	}

	function getVariableValues() {
		const vars = {};
		for (const v of variablesConfigs) {
			if (v.name && v.name.trim()) vars[v.name.trim()] = v.value;
		}
		return vars;
	}

	const palette = ['#3fa7ff', '#ff6b6b', '#6ee7b7', '#fbbf24', '#c084fc', '#f472b6', '#60a5fa'];

	let seriesConfigs = [];
	let variablesConfigs = [];

	function defaultVariable() {
		return {
			id: 'v' + Math.random().toString(36).slice(2, 9),
			name: '',
			value: 1,
			min: -10,
			max: 10,
			step: 0.1,
		};
	}

	function renderVariables() {
		variablesList.innerHTML = '';
		for (const v of variablesConfigs) {
			const item = document.createElement('div');
			item.className = 'variable-item';
			item.dataset.id = v.id;

			const nameRow = document.createElement('div');
			nameRow.className = 'variable-name-row';
			const nameInput = document.createElement('input');
			nameInput.type = 'text';
			nameInput.placeholder = 'Variable name (e.g., a, b)';
			nameInput.value = v.name || '';
			nameRow.appendChild(nameInput);
			item.appendChild(nameRow);

			const valueRow = document.createElement('div');
			valueRow.className = 'variable-value-row';
			const slider = document.createElement('input');
			slider.type = 'range';
			slider.className = 'variable-slider';
			slider.min = v.min;
			slider.max = v.max;
			slider.step = v.step;
			slider.value = v.value;
			valueRow.appendChild(slider);
			const valueInput = document.createElement('input');
			valueInput.type = 'number';
			valueInput.className = 'variable-value-input';
			valueInput.value = v.value;
			valueInput.step = v.step;
			valueRow.appendChild(valueInput);
			const delBtn = document.createElement('button');
			delBtn.className = 'variable-delete';
			delBtn.textContent = '×';
			valueRow.appendChild(delBtn);
			item.appendChild(valueRow);

			// Handlers
			nameInput.addEventListener('input', () => {
				v.name = nameInput.value;
				saveAndReplot();
			});
			slider.addEventListener('input', () => {
				v.value = Number(slider.value);
				valueInput.value = v.value;
				saveAndReplot();
			});
			valueInput.addEventListener('input', () => {
				const val = Number(valueInput.value);
				if (!isNaN(val)) {
					v.value = Math.max(v.min, Math.min(v.max, val));
					slider.value = v.value;
					valueInput.value = v.value;
					saveAndReplot();
				}
			});
			delBtn.addEventListener('click', () => {
				variablesConfigs = variablesConfigs.filter(x => x.id !== v.id);
				renderVariables();
				saveAndReplot();
			});

			variablesList.appendChild(item);
		}
	}

	addVarBtn.addEventListener('click', () => {
		variablesConfigs.push(defaultVariable());
		renderVariables();
	});

	// ===== Calculator =====
	function renderLatex(el, tex) {
		try {
			katex.render(tex, el, { throwOnError: false });
		} catch (e) {
			el.textContent = tex; // fallback to plain text
		}
	}

	function numericalIntegral(fn, a, b, n = 1000) {
		// Simpson's rule
		if (n % 2 !== 0) n++;
		const h = (b - a) / n;
		let sum = fn(a) + fn(b);
		for (let i = 1; i < n; i++) {
			const x = a + i * h;
			sum += (i % 2 === 0 ? 2 : 4) * fn(x);
		}
		return (h / 3) * sum;
	}

	// Calculator tab switching
	const calcTabs = document.querySelectorAll('.calc-tab');
	const calcContents = document.querySelectorAll('.calc-content');
	calcTabs.forEach(tab => {
		tab.addEventListener('click', () => {
			const targetTab = tab.dataset.tab;
			calcTabs.forEach(t => t.classList.remove('active'));
			calcContents.forEach(c => c.classList.remove('active'));
			tab.classList.add('active');
			document.getElementById(`calc-${targetTab}`).classList.add('active');
		});
	});

	// Integration calculator
	const calcIntegralExpr = document.getElementById('calc-integral-expr');
	const calcIntegralA = document.getElementById('calc-integral-a');
	const calcIntegralB = document.getElementById('calc-integral-b');
	const calcIntegralBtn = document.getElementById('calc-integral-btn');
	const calcIntegralResult = document.getElementById('calc-integral-result');
	calcIntegralBtn.addEventListener('click', () => {
		try {
			const expr = calcIntegralExpr.value.trim();
			const a = Number(calcIntegralA.value);
			const b = Number(calcIntegralB.value);
			if (!expr || !Number.isFinite(a) || !Number.isFinite(b)) {
				calcIntegralResult.textContent = 'Invalid input';
				return;
			}
			const varValues = getVariableValues();
			const fn = compileExpression(expr, varValues);
			const result = numericalIntegral(fn, a, b);
			const latex = `\\int_{${a}}^{${b}} ${expr.replace(/\*/g, ' \\cdot ')} \\, dx = ${result.toFixed(6)}`;
			renderLatex(calcIntegralResult, latex);
		} catch (e) {
			calcIntegralResult.textContent = 'Error: ' + e.message;
		}
	});

	// Summation calculator
	const calcSumExpr = document.getElementById('calc-sum-expr');
	const calcSumStart = document.getElementById('calc-sum-start');
	const calcSumEnd = document.getElementById('calc-sum-end');
	const calcSumBtn = document.getElementById('calc-sum-btn');
	const calcSumResult = document.getElementById('calc-sum-result');
	calcSumBtn.addEventListener('click', () => {
		try {
			const expr = calcSumExpr.value.trim();
			const start = Number(calcSumStart.value);
			const end = Number(calcSumEnd.value);
			if (!expr || !Number.isFinite(start) || !Number.isFinite(end) || start > end) {
				calcSumResult.textContent = 'Invalid input';
				return;
			}
			const varValues = getVariableValues();
			// Replace k with x for compilation
			const exprForCompile = expr.replace(/k/g, 'x');
			const fn = compileExpression(exprForCompile, varValues);
			let sum = 0;
			for (let k = Math.floor(start); k <= Math.floor(end); k++) {
				sum += fn(k);
			}
			const latex = `\\sum_{k=${start}}^{${end}} ${expr.replace(/\*/g, ' \\cdot ')} = ${sum.toFixed(6)}`;
			renderLatex(calcSumResult, latex);
		} catch (e) {
			calcSumResult.textContent = 'Error: ' + e.message;
		}
	});

	// Differentiation calculator
	const calcDiffExpr = document.getElementById('calc-diff-expr');
	const calcDiffX = document.getElementById('calc-diff-x');
	const calcDiffBtn = document.getElementById('calc-diff-btn');
	const calcDiffResult = document.getElementById('calc-diff-result');
	calcDiffBtn.addEventListener('click', () => {
		try {
			const expr = calcDiffExpr.value.trim();
			const x = Number(calcDiffX.value);
			if (!expr || !Number.isFinite(x)) {
				calcDiffResult.textContent = 'Invalid input';
				return;
			}
			const varValues = getVariableValues();
			const fn = compileExpression(expr, varValues);
			const h = 1e-6;
			const derivative = (fn(x + h) - fn(x - h)) / (2 * h);
			const fx = fn(x);
			const latex = `\\frac{d}{dx}\\left[${expr.replace(/\*/g, ' \\cdot ')}\\right]\\Big|_{x=${x}} = ${derivative.toFixed(6)}`;
			renderLatex(calcDiffResult, latex);
		} catch (e) {
			calcDiffResult.textContent = 'Error: ' + e.message;
		}
	});

	function debounce(fn, delay) {
		let t = null;
		return function(...args) {
			if (t) clearTimeout(t);
			t = setTimeout(() => fn.apply(this, args), delay);
		};
	}

	const debouncedReplot = debounce(() => {
		replotFromInputs();
	}, 200);

	function saveAndReplot() {
		debouncedReplot();
	}

	function defaultSeries(name = '') {
		return {
			id: 's' + Math.random().toString(36).slice(2, 9),
			name,
			type: 'cartesian', // cartesian | polar | relation
			expr: 'sin(x)',
			visible: true,
			color: palette[(seriesConfigs.length) % palette.length],
			derivative: false,
		};
	}

	function renderSidebar() {
		seriesList.innerHTML = '';
		for (const s of seriesConfigs) {
			const item = document.createElement('div');
			item.className = 'series-item';
			item.dataset.id = s.id;
			const colorEl = document.createElement('div');
			colorEl.className = 'series-color';
			colorEl.style.background = s.color;
			item.appendChild(colorEl);

			const nameWrap = document.createElement('div');
			nameWrap.className = 'series-name';
			const nameInput = document.createElement('input');
			nameInput.type = 'text';
			nameInput.placeholder = 'Name (optional)';
			nameInput.value = s.name || '';
			nameWrap.appendChild(nameInput);
			const typeSel = document.createElement('select');
			['cartesian','polar','relation'].forEach(t => {
				const opt = document.createElement('option');
				opt.value = t; opt.textContent = t;
				if (t === s.type) opt.selected = true;
				typeSel.appendChild(opt);
			});
			nameWrap.appendChild(typeSel);
			item.appendChild(nameWrap);

			const exprWrap = document.createElement('div');
			exprWrap.className = 'series-expr';
			const exprInputRow = document.createElement('div');
			const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = toHexColor(s.color); exprInputRow.appendChild(colorInput);
			const exprInput = document.createElement('input'); exprInput.type = 'text'; exprInput.placeholder = s.type === 'cartesian' ? 'y = f(x)' : (s.type === 'polar' ? 'r = g(θ)' : 'F(x,y) = 0'); exprInput.value = s.expr; exprInputRow.appendChild(exprInput);
			exprWrap.appendChild(exprInputRow);
			const exprPreview = document.createElement('div');
			exprPreview.className = 'expr-preview';
			exprWrap.appendChild(exprPreview);
			item.appendChild(exprWrap);
			
			// Render LaTeX preview
			function updatePreview() {
				if (exprInput.value.trim()) {
					try {
						let latex = exprInput.value.replace(/\*/g, ' \\cdot ').replace(/θ/g, '\\theta');
						if (s.type === 'cartesian') latex = `${s.name ? s.name + ':' : ''} y = ${latex}`;
						else if (s.type === 'polar') latex = `${s.name ? s.name + ':' : ''} r = ${latex}`;
						else latex = `${s.name ? s.name + ':' : ''} ${latex} = 0`;
						renderLatex(exprPreview, latex);
						exprPreview.style.display = 'flex';
					} catch (e) {
						exprPreview.style.display = 'none';
					}
				} else {
					exprPreview.style.display = 'none';
				}
			}
			updatePreview();

			const actions = document.createElement('div');
			actions.className = 'series-actions';
			const vis = document.createElement('input'); vis.type = 'checkbox'; vis.checked = s.visible; actions.appendChild(vis);
			const visLbl = document.createElement('label'); visLbl.textContent = 'Vis'; actions.appendChild(visLbl);
			const der = document.createElement('input'); der.type = 'checkbox'; der.checked = s.derivative; actions.appendChild(der);
			const derLbl = document.createElement('label'); derLbl.textContent = 'Deriv'; actions.appendChild(derLbl);
			const del = document.createElement('button'); del.textContent = 'Delete'; actions.appendChild(del);
			item.appendChild(actions);

			// Handlers
			nameInput.addEventListener('input', () => { s.name = nameInput.value; saveAndReplot(); });
			typeSel.addEventListener('change', () => { s.type = typeSel.value; exprInput.placeholder = s.type === 'cartesian' ? 'y = f(x)' : (s.type === 'polar' ? 'r = g(θ)' : 'F(x,y) = 0'); saveAndReplot(); renderSidebar(); });
			vis.addEventListener('change', () => { s.visible = vis.checked; saveAndReplot(); });
			der.addEventListener('change', () => { s.derivative = der.checked; saveAndReplot(); });
			del.addEventListener('click', () => { seriesConfigs = seriesConfigs.filter(x => x.id !== s.id); saveAndReplot(); renderSidebar(); });
			colorInput.addEventListener('input', () => { s.color = colorInput.value; saveAndReplot(); });
			exprInput.addEventListener('input', () => { s.expr = exprInput.value; updatePreview(); saveAndReplot(); });
			exprInput.addEventListener('change', () => { s.expr = exprInput.value; updatePreview(); replotFromInputs(); });

			seriesList.appendChild(item);
		}
	}

	function toHexColor(c) {
		// assumes already hex or rgb; keep simple
		return /^#/.test(c) ? c : '#3fa7ff';
	}

	addSeriesBtn.addEventListener('click', () => {
		seriesConfigs.push(defaultSeries());
		renderSidebar();
		saveAndReplot();
	});

	function replotFromInputs() {
		const xMin = Number(xMinInput.value);
		const xMax = Number(xMaxInput.value);
		if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) {
			setError('x min/max must be numbers.');
			return;
		}
		try {
			const varValues = getVariableValues();
			const compiledSeries = [];
			for (const s of seriesConfigs) {
				if (!s.visible) continue;
				if (s.type === 'cartesian') {
					const fn = compileExpression(s.expr, varValues);
					compiledSeries.push({ type: 'cartesian', color: s.color, visible: true, name: s.name, expr: s.expr, fn });
					if (s.derivative) {
						const h = 1e-4;
						const dfn = (x) => (fn(x + h) - fn(x - h)) / (2 * h);
						compiledSeries.push({ type: 'cartesian', color: s.color, visible: true, name: (s.name||s.expr)+"'", expr: `d/dx ${s.expr}`, fn: dfn });
					}
				} else if (s.type === 'polar') {
					const rfn = compileExpression(s.expr.replace(/θ/g, 'x'), varValues);
					compiledSeries.push({ type: 'polar', color: s.color, visible: true, name: s.name, expr: s.expr, rfn });
				} else if (s.type === 'relation') {
					// F(x,y)=0 -> compile as function(x,y) with variables
					const F = compileExpression2D(s.expr, varValues);
					compiledSeries.push({ type: 'relation', color: s.color, visible: true, name: s.name, expr: s.expr, F });
				}
			}
			plotter.setDomain(xMin, xMax);
			plotter.setSeries(compiledSeries);
			savePerUserConfig(xMin, xMax);
			setError('');
		} catch (e) {
			setError(e.message || String(e));
		}
	}

	// no plot button; sidebar changes trigger replot
	resetViewBtn.addEventListener('click', () => {
		// Restore default view around origin
		xMinInput.value = -10;
		xMaxInput.value = 10;
		plotter.setDomain(-10, 10);
		plotter.setYRange(-6, 6);
		plotter.draw();
	});

	// Export / Import config (per account)
	exportBtn.addEventListener('click', () => {
		const u = getCurrentUser();
		const data = collectCurrentConfig();
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `graph-plotter-${u ? u.email.replace(/[^a-z0-9_.-]/gi, '_') : 'guest'}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	});
	importFile.addEventListener('change', async (e) => {
		const file = e.target.files && e.target.files[0];
		if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text);
			applyConfig(data);
		} catch (err) {
			setError('Invalid file format.');
		}
		importFile.value = '';
	});

	function collectCurrentConfig() {
		const xMin = Number(xMinInput.value);
		const xMax = Number(xMaxInput.value);
		return collectUserConfig(xMin, xMax);
	}

	function applyConfig(cfg) {
		if (!cfg || !Array.isArray(cfg.series)) throw new Error('Bad config');
		xMinInput.value = cfg.xMin ?? -10;
		xMaxInput.value = cfg.xMax ?? 10;
		seriesConfigs = cfg.series.map(s => ({
			id: s.id || ('s' + Math.random().toString(36).slice(2, 9)),
			name: s.name || '',
			type: s.type || 'cartesian',
			expr: s.expr || 'sin(x)',
			visible: s.visible !== false,
			color: s.color || palette[0],
			derivative: !!s.derivative,
		}));
		if (Array.isArray(cfg.variables)) {
			variablesConfigs = cfg.variables.map(v => ({
				id: v.id || ('v' + Math.random().toString(36).slice(2, 9)),
				name: v.name || '',
				value: v.value ?? 1,
				min: v.min ?? -10,
				max: v.max ?? 10,
				step: v.step ?? 0.1,
			}));
		}
		renderVariables();
		renderSidebar();
		replotFromInputs();
	}

	// Interactions: zoom (wheel) and pan (drag)
	let isPanning = false;
	let lastX = 0;
	let lastY = 0;

	function handleWheel(e) {
		// Normalize delta across devices (pixels vs lines)
		e.preventDefault();
		const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines->px approx
		const base = 1.035; // gentle zoom per event
		let scale = Math.pow(base, -delta / 100);
		// Clamp per-event zoom to avoid big jumps
		scale = Math.min(1.08, Math.max(1 / 1.08, scale));
		// Always zoom from canvas center
		const sx = canvas.clientWidth / 2;
		const sy = canvas.clientHeight / 2;
		plotter.zoomAt(sx, sy, scale);
	}
	canvas.addEventListener('wheel', handleWheel, { passive: false });
	// Also listen on the wrapper to catch events when canvas has no focus
	canvas.parentElement.addEventListener('wheel', handleWheel, { passive: false });

	canvas.addEventListener('mousedown', (e) => {
		isPanning = true;
		lastX = e.clientX;
		lastY = e.clientY;
	});
	document.addEventListener('mouseup', () => { isPanning = false; });
	document.addEventListener('mousemove', (e) => {
		if (!isPanning) return;
		const dx = (e.clientX - lastX);
		const dy = (e.clientY - lastY);
		lastX = e.clientX;
		lastY = e.clientY;
		plotter.panBy(dx, dy);
	});

	// Sidebar resizer
	const resizer = document.getElementById('sidebar-resizer');
	let resizing = false;
	resizer.addEventListener('mousedown', (e) => { resizing = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); });
	document.addEventListener('mouseup', () => { resizing = false; document.body.style.cursor = ''; });
	document.addEventListener('mousemove', (e) => {
		if (!resizing) return;
		const minW = 220, maxW = Math.min(560, window.innerWidth - 320);
		const sidebarLeft = sidebar.getBoundingClientRect().left;
		const newW = Math.max(minW, Math.min(maxW, e.clientX - sidebarLeft));
		sidebar.style.width = newW + 'px';
		resizeCanvasToFill();
	});

    // Tooltip for intercepts (hover + click-to-pin)
    let pinnedIntercept = null;
    function showTooltipForIntercept(intercept, sx, sy) {
        tooltip.hidden = false;
        const { x, y, type, color, labels, seriesI, seriesJ } = intercept;
        let title = 'intercept';
        if (type === 'x') title = 'x-intercept';
        else if (type === 'y') title = 'y-intercept';
        else if (type === 'ff') title = 'intersection';
        let subtitle = '';
        if (type === 'ff' && labels) {
            const la = (labels.a || `f${seriesI+1}`).toString();
            const lb = (labels.b || `f${seriesJ+1}`).toString();
            subtitle = `<div style="color:#9aa4b2;max-width:220px">${la} = ${lb}</div>`;
        }
        let content = `${title}${subtitle}`;
        content += `<br><b style="color:${color};">(${x.toFixed(4)}, ${y.toFixed(4)})</b>`;
        tooltip.innerHTML = content;
        // Place tooltip near but slightly offset from dot (above+right if possible)
        let tipX = sx + 14;
        let tipY = sy - 36;
        const tw = 144, th = 44;
        tipX = Math.min(Math.max(tipX, 4), canvas.clientWidth - tw);
        tipY = Math.min(Math.max(tipY, 2), canvas.clientHeight - th - 1);
        tooltip.style.left = (canvas.offsetLeft + tipX) + 'px';
        tooltip.style.top = (canvas.offsetTop + tipY) + 'px';
    }

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        if (pinnedIntercept) {
            const p = plotter.worldToScreen(pinnedIntercept.x, pinnedIntercept.y);
            showTooltipForIntercept(pinnedIntercept, p.x, p.y);
            return;
        }
        const hit = plotter.getInterceptAtScreen(sx, sy, 12);
        if (hit && hit.intercept) showTooltipForIntercept(hit.intercept, hit.intercept.sx, hit.intercept.sy);
        else tooltip.hidden = true;
    });
    canvas.addEventListener('mouseleave', () => { tooltip.hidden = true; pinnedIntercept = null; });
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const hit = plotter.getInterceptAtScreen(sx, sy, 12);
        if (hit && hit.intercept) {
            pinnedIntercept = hit.intercept;
            showTooltipForIntercept(pinnedIntercept, hit.intercept.sx, hit.intercept.sy);
        } else {
            pinnedIntercept = null;
            tooltip.hidden = true;
        }
    });

	// Resize canvas to fill available space
	function resizeCanvasToFill() {
		const parent = canvas.parentElement;
		const width = parent.clientWidth;
		const height = Math.max(200, window.innerHeight - document.querySelector('.topbar').offsetHeight);
		canvas.style.width = width + 'px';
		canvas.style.height = height + 'px';
		plotter.resizeToDisplaySize();
	}
	window.addEventListener('resize', resizeCanvasToFill);
	resizeCanvasToFill();

	// Initial state: one default series
	seriesConfigs = [defaultSeries('f1')];
	renderVariables();
	renderSidebar();
	replotFromInputs();

	// ===== Auth UI =====
	function openModal(mode) {
		setAuthMode(mode);
		authError.hidden = true;
		authError.textContent = '';
		authBackdrop.hidden = false;
		authModal.hidden = false;
		setTimeout(() => authEmail.focus(), 0);
	}
	function closeModal() {
		authBackdrop.hidden = true;
		authModal.hidden = true;
	}
	function setAuthMode(mode) {
		const isLogin = mode !== 'signup';
		tabLogin.classList.toggle('active', isLogin);
		tabSignup.classList.toggle('active', !isLogin);
		loginBtn.hidden = !isLogin;
		signupBtn.hidden = isLogin;
	}

	loginOpenBtn.addEventListener('click', () => openModal('login'));
	logoutBtn.addEventListener('click', () => logout());
	modalClose.addEventListener('click', closeModal);
	authBackdrop.addEventListener('click', closeModal);
	tabLogin.addEventListener('click', () => setAuthMode('login'));
	tabSignup.addEventListener('click', () => setAuthMode('signup'));

	async function doLogin() {
		try {
			authError.hidden = true;
			await login(authEmail.value, authPassword.value);
			closeModal();
		} catch (e) {
			authError.textContent = e.message || String(e);
			authError.hidden = false;
		}
	}
	async function doSignup() {
		try {
			authError.hidden = true;
			await createAccount(authEmail.value, authPassword.value);
			closeModal();
		} catch (e) {
			authError.textContent = e.message || String(e);
			authError.hidden = false;
		}
	}
	loginBtn.addEventListener('click', doLogin);
	signupBtn.addEventListener('click', doSignup);
	[authEmail, authPassword].forEach(el => el.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			if (!loginBtn.hidden) doLogin(); else doSignup();
		}
	}));

	// Update topbar based on auth state
	onAuthStateChanged((user) => {
		if (user) {
			userLabel.textContent = user.email;
			userLabel.hidden = false;
			logoutBtn.hidden = false;
			loginOpenBtn.hidden = true;
			// Load saved config for this user
			const saved = localStorage.getItem('gp_cfg_' + user.email);
			if (saved) {
				try { applyConfig(JSON.parse(saved)); } catch (_) {}
			}
		} else {
			userLabel.hidden = true;
			logoutBtn.hidden = true;
			loginOpenBtn.hidden = false;
		}
	});

	// Save current function per-user on changes
	function savePerUser(series, xMin, xMax) {
		const u = getCurrentUser();
		if (!u) return;
		const cfg = collectUserConfig(xMin, xMax);
		localStorage.setItem('gp_cfg_' + u.email, JSON.stringify(cfg));
	}

	function collectUserConfig(xMin = Number(xMinInput.value), xMax = Number(xMaxInput.value)) {
		return {
			xMin, xMax,
			series: seriesConfigs.map(s => ({ id: s.id, name: s.name, type: s.type, expr: s.expr, visible: s.visible, color: s.color, derivative: s.derivative })),
			variables: variablesConfigs.map(v => ({ id: v.id, name: v.name, value: v.value, min: v.min, max: v.max, step: v.step }))
		};
	}

	function savePerUserConfig(xMin, xMax) { savePerUser([], xMin, xMax); }
})();


