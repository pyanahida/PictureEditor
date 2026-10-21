(function(global) {
  'use strict';

  const CONTROLS = [
    { id: 'exposure',   label: 'exposure' },
    { id: 'brightness', label: 'brightness' },
    { id: 'contrast',   label: 'contrast' },
    { id: 'clarity',    label: 'clarity' },
    { id: 'highlights', label: 'highlights' },
    { id: 'shadows',    label: 'shadows' },
    { id: 'whites',     label: 'whites' },
    { id: 'blacks',     label: 'blacks' },
    { id: 'saturation', label: 'saturation' },
    { id: 'vibrance',   label: 'vibrance' }
  ];

  const HSL_COLORS = [
    { name: 'red',    hue: 0 },
    { name: 'orange', hue: 30 },
    { name: 'yellow', hue: 60 },
    { name: 'green',  hue: 120 },
    { name: 'blue',   hue: 240 },
    { name: 'purple', hue: 280 }
  ];

  const HSL_PARAMS = [
    { id: 'hue',        label: 'hue' },
    { id: 'saturation', label: 'saturation' },
    { id: 'luminance',  label: 'luminance' }
  ];

  const POSTERIZATION_PARAMS = [
    { id: 'highlights', label: 'highlights' },
    { id: 'shadows',    label: 'shadows' }
  ];

  const CURVE_CHANNELS = [
    { id: 'w', label: 'W' },
    { id: 'r', label: 'R' },
    { id: 'g', label: 'G' },
    { id: 'b', label: 'B' }
  ];

  const inputs = {};
  const hslInputs = {};
  const postInputs = {};
  
  const curvesState = {
    w: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    r: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    g: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    b: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
  };
  let activeCurveChannel = 'w';
  let selectedPointIndex = -1;
  const canvasRefs = {};
  const SIZE = 240;

  function buildControls(container) {
    CONTROLS.forEach(cfg => {
      const row = document.createElement('div');
      row.className = 'control-row';

      const label = document.createElement('label');
      label.className = 'control-label';
      label.setAttribute('for', `ctrl-${cfg.id}`);
      label.textContent = cfg.label;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = `ctrl-${cfg.id}`;
      slider.className = 'control-slider';
      slider.min = '-100';
      slider.max = '100';
      slider.step = '1';
      slider.value = '0';

      const valueEl = document.createElement('span');
      valueEl.className = 'control-value';
      valueEl.textContent = '0';
      slider.addEventListener('input', () => {
        valueEl.textContent = slider.value;
      });

      row.appendChild(label);
      row.appendChild(slider);
      row.appendChild(valueEl);
      container.appendChild(row);

      inputs[cfg.id] = slider;
    });
  }

  function buildHslGrid(container) {
    HSL_COLORS.forEach(c => { hslInputs[c.name] = {}; });
    
    const table = document.createElement('table');
    table.className = 'param-table';
    
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    trHead.appendChild(document.createElement('th'));
    HSL_COLORS.forEach(c => {
      const th = document.createElement('th');
      th.textContent = c.name;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    HSL_PARAMS.forEach(p => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = p.label;
      tr.appendChild(th);

      HSL_COLORS.forEach(c => {
        const td = document.createElement('td');
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'hsl-slider';
        slider.min = '-100';
        slider.max = '100';
        slider.step = '1';
        slider.value = '0';

        if (p.id === 'hue') {
          const h = c.hue;
          slider.style.background = `linear-gradient(to right, hsl(${h - 30}, 80%, 50%), hsl(${h}, 80%, 50%), hsl(${h + 30}, 80%, 50%))`;
        } else if (p.id === 'saturation') {
          const h = c.hue;
          slider.style.background = `linear-gradient(to right, hsl(${h}, 0%, 60%), hsl(${h}, 100%, 50%))`;
        } else if (p.id === 'luminance') {
          const h = c.hue;
          slider.style.background = `linear-gradient(to right, hsl(${h}, 80%, 20%), hsl(${h}, 80%, 50%), hsl(${h}, 80%, 80%))`;
        }

        const valEl = document.createElement('span');
        valEl.className = 'hsl-val';
        valEl.textContent = '0';

        slider.addEventListener('input', () => {
          valEl.textContent = slider.value;
        });

        td.appendChild(slider);
        td.appendChild(valEl);
        tr.appendChild(td);

        hslInputs[c.name][p.id] = slider;
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function buildPostGrid(container) {
    HSL_COLORS.forEach(c => { postInputs[c.name] = {}; });

    const table = document.createElement('table');
    table.className = 'param-table';
    
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    trHead.appendChild(document.createElement('th'));
    POSTERIZATION_PARAMS.forEach(p => {
      const th = document.createElement('th');
      th.textContent = p.label;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    HSL_COLORS.forEach(c => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = c.name;
      tr.appendChild(th);

      POSTERIZATION_PARAMS.forEach(p => {
        const td = document.createElement('td');

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'hsl-slider';
        slider.min = '0';
        slider.max = '100';
        slider.step = '1';
        slider.value = '0';

        const h = c.hue;
        if (p.id === 'highlights') {
          slider.style.background = `linear-gradient(to right, hsl(${h}, 15%, 60%), hsl(${h}, 80%, 70%))`;
        } else if (p.id === 'shadows') {
          slider.style.background = `linear-gradient(to right, hsl(${h}, 15%, 40%), hsl(${h}, 80%, 30%))`;
        }

        const valEl = document.createElement('span');
        valEl.className = 'hsl-val';
        valEl.textContent = '0';

        slider.addEventListener('input', () => {
          valEl.textContent = slider.value;
        });

        td.appendChild(slider);
        td.appendChild(valEl);
        tr.appendChild(td);

        postInputs[c.name][p.id] = slider;
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function buildCurves(container, deleteBtn) {
    CURVE_CHANNELS.forEach(c => {
      const wrap = document.createElement('div');
      wrap.className = 'curve-chart-wrap';

      const title = document.createElement('div');
      title.className = 'curve-title';
      title.textContent = c.label;

      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      canvas.className = 'curve-canvas';

      wrap.appendChild(title);
      wrap.appendChild(canvas);
      container.appendChild(wrap);

      canvasRefs[c.id] = canvas;
      setupCurveCanvas(c.id, canvas, deleteBtn);
    });
    
    redrawAllCurves();
  }

  function setupCurveCanvas(channel, canvas, deleteBtn) {
    const ctx = canvas.getContext('2d');
    let isDragging = false;
    let dragIndex = -1;

    function getMousePos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      let clientX = e.clientX;
      let clientY = e.clientY;
      
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
      
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function findPoint(pos) {
      const pts = curvesState[channel];
      const hitRadius = 15;
      for (let i = 0; i < pts.length; i++) {
        const px = (pts[i].x / 255) * SIZE;
        const py = SIZE - (pts[i].y / 255) * SIZE;
        const dist = Math.hypot(pos.x - px, pos.y - py);
        if (dist <= hitRadius) return i;
      }
      return -1;
    }

    function handleDown(e) {
      if (e.type === 'touchstart') e.preventDefault();
      activeCurveChannel = channel;
      const pos = getMousePos(e);
      let idx = findPoint(pos);

      if (idx === -1) {
        const newX = Math.round((pos.x / SIZE) * 255);
        const newY = Math.round(255 - (pos.y / SIZE) * 255);
        
        const pts = curvesState[channel].slice();
        let insertIdx = pts.findIndex(p => p.x > newX);
        if (insertIdx === -1) insertIdx = pts.length;
        
        if (newX > pts[0].x && newX < pts[pts.length - 1].x) {
          const left = pts[insertIdx - 1];
          const right = pts[insertIdx];
          if (newX - left.x > 3 && right.x - newX > 3) {
            pts.splice(insertIdx, 0, { x: newX, y: newY });
            curvesState[channel] = pts;
            idx = insertIdx;
          }
        }
      }
      
      if (idx !== -1) {
        selectedPointIndex = idx;
        isDragging = true;
        dragIndex = idx;
        redrawAllCurves();
        deleteBtn.disabled = (idx === 0 || idx === curvesState[channel].length - 1);
      } else {
        selectedPointIndex = -1;
        redrawAllCurves();
        deleteBtn.disabled = true;
      }
    }

    function handleMove(e) {
      if (!isDragging) return;
      if (e.type === 'touchmove') e.preventDefault();
      
      const pos = getMousePos(e);
      const pts = curvesState[channel];
      if (dragIndex < 0 || dragIndex >= pts.length) return;

      let newY = Math.round(255 - (pos.y / SIZE) * 255);
      newY = Math.max(0, Math.min(255, newY));
      pts[dragIndex].y = newY;
      
      redrawAllCurves();
    }

    function handleUp(e) {
      if (e.type === 'touchend') e.preventDefault();
      isDragging = false;
      dragIndex = -1;
    }

    canvas.addEventListener('mousedown', handleDown);
    canvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    
    canvas.addEventListener('touchstart', handleDown, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleUp, { passive: false });
    canvas.addEventListener('touchcancel', handleUp, { passive: false });
  }

  function redrawAllCurves() {
    CURVE_CHANNELS.forEach(c => {
      const canvas = canvasRefs[c.id];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const pts = curvesState[c.id];

      ctx.clearRect(0, 0, SIZE, SIZE);

      ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const p = (SIZE / 4) * i;
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(SIZE, p); ctx.stroke();
      }

      ctx.beginPath();
      const sortedPts = [...pts].sort((a, b) => a.x - b.x);
      for (let i = 0; i < SIZE; i++) {
        const val = global.Utils.evalCurve(sortedPts, (i / SIZE) * 255);
        const px = i;
        const py = SIZE - (val / 255) * SIZE;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      
      let color = '#888';
      if (c.id === 'r') color = '#e53935';
      if (c.id === 'g') color = '#43a047';
      if (c.id === 'b') color = '#1e88e5';
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      pts.forEach((pt, i) => {
        const px = (pt.x / 255) * SIZE;
        const py = SIZE - (pt.y / 255) * SIZE;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = (activeCurveChannel === c.id && selectedPointIndex === i) ? '#ff9800' : '#fff';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });
  }

  function deleteSelectedPoint() {
    if (selectedPointIndex < 0) return;
    const pts = curvesState[activeCurveChannel];
    if (selectedPointIndex > 0 && selectedPointIndex < pts.length - 1) {
      pts.splice(selectedPointIndex, 1);
      selectedPointIndex = -1;
      redrawAllCurves();
    }
  }

  function getValues() {
    const out = {};
    CONTROLS.forEach(cfg => {
      const v = parseFloat(inputs[cfg.id].value);
      out[cfg.id] = isNaN(v) ? 0 : Math.max(-100, Math.min(100, Math.round(v)));
    });
    
    out.hsl = {};
    let hslIdentity = true;
    HSL_COLORS.forEach(c => {
      out.hsl[c.name] = {};
      HSL_PARAMS.forEach(p => {
        const v = parseFloat(hslInputs[c.name][p.id].value);
        const val = isNaN(v) ? 0 : Math.max(-100, Math.min(100, Math.round(v)));
        out.hsl[c.name][p.id] = val;
        if (val !== 0) hslIdentity = false;
      });
    });
    out.hslIdentity = hslIdentity;

    out.post = {};
    let postIdentity = true;
    HSL_COLORS.forEach(c => {
      out.post[c.name] = {};
      POSTERIZATION_PARAMS.forEach(p => {
        const v = parseFloat(postInputs[c.name][p.id].value);
        const val = isNaN(v) ? 0 : Math.max(0, Math.min(100, Math.round(v)));
        out.post[c.name][p.id] = val;
        if (val !== 0) postIdentity = false;
      });
    });
    out.postIdentity = postIdentity;

    out.curves = {};
    let curvesIdentity = true;
    CURVE_CHANNELS.forEach(c => {
      const pts = curvesState[c.id];
      const isDefault = pts.length === 2 && 
                        pts[0].x === 0 && pts[0].y === 0 && 
                        pts[1].x === 255 && pts[1].y === 255;
      if (!isDefault) curvesIdentity = false;
      out.curves[c.id] = JSON.parse(JSON.stringify(pts));
    });
    out.curvesIdentity = curvesIdentity;

    return out;
  }

  function loadValues(data) {
    CONTROLS.forEach(cfg => {
      if (data[cfg.id] !== undefined) {
        const val = Math.max(-100, Math.min(100, data[cfg.id]));
        inputs[cfg.id].value = val;
        inputs[cfg.id].nextElementSibling.textContent = val;
      }
    });

    if (data.hsl) {
      HSL_COLORS.forEach(c => {
        if (data.hsl[c.name]) {
          HSL_PARAMS.forEach(p => {
            if (data.hsl[c.name][p.id] !== undefined) {
              const val = Math.max(-100, Math.min(100, data.hsl[c.name][p.id]));
              hslInputs[c.name][p.id].value = val;
              hslInputs[c.name][p.id].nextElementSibling.textContent = val;
            }
          });
        }
      });
    }

    if (data.post) {
      HSL_COLORS.forEach(c => {
        if (data.post[c.name]) {
          POSTERIZATION_PARAMS.forEach(p => {
            if (data.post[c.name][p.id] !== undefined) {
              const val = Math.max(0, Math.min(100, data.post[c.name][p.id]));
              postInputs[c.name][p.id].value = val;
              postInputs[c.name][p.id].nextElementSibling.textContent = val;
            }
          });
        }
      });
    }

    if (data.curves) {
      CURVE_CHANNELS.forEach(c => {
        if (data.curves[c.id] && Array.isArray(data.curves[c.id])) {
          curvesState[c.id] = data.curves[c.id];
        }
      });
      redrawAllCurves();
    }
  }

  function isIdentity(values) {
    const baseIdentity = CONTROLS.every(cfg => values[cfg.id] === 0);
    return baseIdentity && values.hslIdentity && values.postIdentity && values.curvesIdentity;
  }

  global.UI = {
    buildControls,
    buildHslGrid,
    buildPostGrid,
    buildCurves,
    deleteSelectedPoint,
    getValues,
    loadValues,
    isIdentity
  };

})(window);
