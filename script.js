(function() {
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

  const PROFILE = {
    exposure:   { pos: 1.5, neg: 2.0 },
    brightness: { scale: 80 },
    contrast:   { pos: 1.2, neg: 0.8 },
    highlights: { pos: 0.9, neg: 0.7 },
    shadows:    { pos: 0.9, neg: 0.7 },
    whites:     { pos: 0.8, neg: 0.6, pivot: 200, span: 55 },
    blacks:     { pos: 0.8, neg: 0.6, pivot: 55,  span: 55 },
    saturation: { pos: 1.5, neg: 0.8 },
    vibrance:   { scale: 0.8 }
  };

  const fileInput   = document.getElementById('file-input');
  const previewImg  = document.getElementById('preview-img');
  const placeholder = document.getElementById('placeholder');
  const previewBox  = document.getElementById('preview-box');
  const filenameEl  = document.getElementById('filename');
  const applyBtn    = document.getElementById('apply-btn');
  const downloadBtn = document.getElementById('download-btn');
  const controlsEl  = document.getElementById('controls');

  let originalImage = null;
  let originalFile  = null;
  let currentObjectUrl = null;
  let processedDataUrl = null;

  // Build controls
  const inputs = {};
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
    slider.setAttribute('aria-label', cfg.label);

    const valueEl = document.createElement('span');
    valueEl.className = 'control-value';
    valueEl.textContent = '0';
    slider.addEventListener('input', () => {
      valueEl.textContent = slider.value;
    });

    row.appendChild(label);
    row.appendChild(slider);
    row.appendChild(valueEl);
    controlsEl.appendChild(row);

    inputs[cfg.id] = slider;
  });

  function readValues() {
    const out = {};
    CONTROLS.forEach(cfg => {
      const v = parseFloat(inputs[cfg.id].value);
      out[cfg.id] = isNaN(v) ? 0 : Math.max(-100, Math.min(100, Math.round(v)));
    });
    return out;
  }

  function isIdentity(values) {
    return CONTROLS.every(cfg => values[cfg.id] === 0);
  }

  // Color space conversion
  function srgbToLinear(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function linearToSrgb(v) {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, c * 255));
  }

  // Pixel processing
  function processPixels(data, w, h, values) {
    const expF = values.exposure >= 0
      ? 1 + (values.exposure / 100) * PROFILE.exposure.pos
      : 1 / (1 + (-values.exposure / 100) * PROFILE.exposure.neg);

    const brightOff = (values.brightness / 100) * PROFILE.brightness.scale / 255;

    const contrastF = values.contrast >= 0
      ? 1 + (values.contrast / 100) * PROFILE.contrast.pos
      : 1 / (1 + (-values.contrast / 100) * PROFILE.contrast.neg);

    const hlF = values.highlights >= 0
      ? 1 + (values.highlights / 100) * PROFILE.highlights.pos
      : 1 / (1 + (-values.highlights / 100) * PROFILE.highlights.neg);

    const shF = values.shadows >= 0
      ? 1 + (values.shadows / 100) * PROFILE.shadows.pos
      : 1 / (1 + (-values.shadows / 100) * PROFILE.shadows.neg);

    const wP = PROFILE.whites;
    const whF = values.whites >= 0
      ? 1 + (values.whites / 100) * wP.pos
      : 1 / (1 + (-values.whites / 100) * wP.neg);

    const bP = PROFILE.blacks;
    const blF = values.blacks >= 0
      ? 1 + (values.blacks / 100) * bP.pos
      : 1 / (1 + (-values.blacks / 100) * bP.neg);

    const satF = values.saturation >= 0
      ? 1 + (values.saturation / 100) * PROFILE.saturation.pos
      : 1 / (1 + (-values.saturation / 100) * PROFILE.saturation.neg);

    const vibAmount = (values.vibrance / 100) * PROFILE.vibrance.scale;

    for (let i = 0; i < data.length; i += 4) {
      let r = srgbToLinear(data[i]);
      let g = srgbToLinear(data[i + 1]);
      let b = srgbToLinear(data[i + 2]);

      r *= expF; g *= expF; b *= expF;
      r += brightOff; g += brightOff; b += brightOff;

      r = (r - 0.5) * contrastF + 0.5;
      g = (g - 0.5) * contrastF + 0.5;
      b = (b - 0.5) * contrastF + 0.5;

      let rr = linearToSrgb(r);
      let gg = linearToSrgb(g);
      let bb = linearToSrgb(b);

      let luma = 0.299 * rr + 0.587 * gg + 0.114 * bb;

      if (luma > 128) {
        const weight = (luma - 128) / 127;
        rr += (rr * (hlF - 1)) * weight;
        gg += (gg * (hlF - 1)) * weight;
        bb += (bb * (hlF - 1)) * weight;
      }
      if (luma < 128) {
        const weight = (128 - luma) / 128;
        rr += (rr * (shF - 1)) * weight;
        gg += (gg * (shF - 1)) * weight;
        bb += (bb * (shF - 1)) * weight;
      }

      luma = 0.299 * rr + 0.587 * gg + 0.114 * bb;

      if (luma > wP.pivot) {
        const t = Math.min(1, (luma - wP.pivot) / wP.span);
        const weight = t * t * (3 - 2 * t);
        rr += (rr * (whF - 1)) * weight;
        gg += (gg * (whF - 1)) * weight;
        bb += (bb * (whF - 1)) * weight;
      }
      if (luma < bP.pivot) {
        const t = Math.min(1, (bP.pivot - luma) / bP.span);
        const weight = t * t * (3 - 2 * t);
        rr += (rr * (blF - 1)) * weight;
        gg += (gg * (blF - 1)) * weight;
        bb += (bb * (blF - 1)) * weight;
      }

      data[i]     = Math.min(255, Math.max(0, rr));
      data[i + 1] = Math.min(255, Math.max(0, gg));
      data[i + 2] = Math.min(255, Math.max(0, bb));
    }

    if (values.clarity !== 0) {
      applyClarity(data, w, h, values.clarity);
    }
    if (values.saturation !== 0 || values.vibrance !== 0) {
      applySaturation(data, satF, vibAmount);
    }
  }

  function applyClarity(data, w, h, amount) {
    const src = new Uint8ClampedArray(data);
    const strength = (amount / 100) * 0.5;
    for (let y = 1; y < h - 1; y++) {
      const rowBase = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = (rowBase + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = src[i + c];
          const up    = src[i - w * 4 + c];
          const down  = src[i + w * 4 + c];
          const left  = src[i - 4 + c];
          const right = src[i + 4 + c];
          const lap = center * 5 - up - down - left - right;
          data[i + c] = Math.min(255, Math.max(0, center + lap * strength));
        }
      }
    }
  }

  function applySaturation(data, satF, vibAmount) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      const vibFactor = 1 + vibAmount * Math.max(0, 1 - sat);
      const combined = satF * vibFactor;
      data[i]     = Math.min(255, Math.max(0, gray + (r - gray) * combined));
      data[i + 1] = Math.min(255, Math.max(0, gray + (g - gray) * combined));
      data[i + 2] = Math.min(255, Math.max(0, gray + (b - gray) * combined));
    }
  }

  // Apply effects
  function applyNow() {
    if (!originalImage) return;
    
    applyBtn.disabled = true;
    applyBtn.textContent = 'processing...';

    // Delay execution to let UI update
    setTimeout(() => {
      try {
        const nw = originalImage.naturalWidth;
        const nh = originalImage.naturalHeight;

        const canvas = document.createElement('canvas');
        canvas.width = nw;
        canvas.height = nh;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        ctx.drawImage(originalImage, 0, 0);

        const values = readValues();
        if (!isIdentity(values)) {
          const imageData = ctx.getImageData(0, 0, nw, nh);
          processPixels(imageData.data, nw, nh, values);
          ctx.putImageData(imageData, 0, 0);
        }

        processedDataUrl = canvas.toDataURL('image/png');
        
        previewImg.src = processedDataUrl;
        downloadBtn.disabled = false;
      } catch (err) {
        filenameEl.textContent = 'processing error';
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'apply';
      }
    }, 50);
  }

  // Clear preview
  function clearPreview() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    previewImg.removeAttribute('src');
    previewImg.classList.add('hidden');
    placeholder.classList.remove('hidden');
    previewBox.classList.remove('active');
    filenameEl.textContent = '';
    originalImage = null;
    originalFile = null;
    processedDataUrl = null;
    applyBtn.disabled = true;
    downloadBtn.disabled = true;
    applyBtn.textContent = 'apply';
  }

  // Handle file selection
  function handleFileChange(e) {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return; // If the user cancels selection, keep current state without clearing
    }
    const file = files[0];

    if (!file.type.startsWith('image/')) {
      clearPreview();
      filenameEl.textContent = 'not an image';
      return;
    }

    originalFile = file;
    const name = file.name;
    filenameEl.textContent = name.length > 40 ? name.slice(0, 38) + '…' : name;

    // Thoroughly clean up old image
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
    }

    // Use the most stable URL.createObjectURL
    currentObjectUrl = URL.createObjectURL(file);

    // 1. Assign directly to img for immediate display
    previewImg.src = currentObjectUrl;
    previewImg.classList.remove('hidden');
    placeholder.classList.add('hidden');
    previewBox.classList.add('active');

    // 2. Create Image object for Canvas processing
    originalImage = new Image();
    originalImage.onload = function() {
      applyBtn.disabled = false;
      downloadBtn.disabled = true;
      processedDataUrl = null;
    };
    originalImage.onerror = function() {
      clearPreview();
      filenameEl.textContent = 'failed to load image';
    };
    
    // Note: Never revoke currentObjectUrl here until next image selection or page unload
    originalImage.src = currentObjectUrl;
  }

  // Download image
  function downloadImage() {
    if (!processedDataUrl) return;
    
    const base = (originalFile && originalFile.name)
      ? originalFile.name.replace(/\.[^/.]+$/, '')
      : 'processed';
      
    const a = document.createElement('a');
    a.href = processedDataUrl;
    a.download = base + '-edited.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Bind events
  // Never add fileInput.addEventListener('click', () => this.value = ''), it will freeze mobile devices after canceling selection
  fileInput.addEventListener('change', handleFileChange);
  applyBtn.addEventListener('click', applyNow);
  downloadBtn.addEventListener('click', downloadImage);

  clearPreview();
})();
