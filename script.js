(function() {
  const fileInput = document.getElementById('file-input');
  const previewImg = document.getElementById('preview-img');
  const placeholder = document.getElementById('placeholder');
  const previewBox = document.getElementById('preview-box');
  const filenameEl = document.getElementById('filename');
  const applyBtn = document.getElementById('apply-btn');
  const downloadBtn = document.getElementById('download-btn');

  const exposureInput = document.getElementById('exposure-input');
  const brightnessInput = document.getElementById('brightness-input');
  const contrastInput = document.getElementById('contrast-input');
  const clarityInput = document.getElementById('clarity-input');
  const highlightsInput = document.getElementById('highlights-input');
  const shadowsInput = document.getElementById('shadows-input');
  const whitesInput = document.getElementById('whites-input');
  const blacksInput = document.getElementById('blacks-input');
  const saturationInput = document.getElementById('saturation-input');
  const vibranceInput = document.getElementById('vibrance-input');

  let originalImage = null;
  let processedDataUrl = null;
  let objectUrl = null;

  function clampValue(value) {
    const n = parseFloat(value);
    if (isNaN(n)) return 0;
    return Math.max(-100, Math.min(100, n));
  }

  function readInputs() {
    return {
      exposure: clampValue(exposureInput.value),
      brightness: clampValue(brightnessInput.value),
      contrast: clampValue(contrastInput.value),
      clarity: clampValue(clarityInput.value),
      highlights: clampValue(highlightsInput.value),
      shadows: clampValue(shadowsInput.value),
      whites: clampValue(whitesInput.value),
      blacks: clampValue(blacksInput.value),
      saturation: clampValue(saturationInput.value),
      vibrance: clampValue(vibranceInput.value)
    };
  }

  function syncInputs(values) {
    exposureInput.value = values.exposure;
    brightnessInput.value = values.brightness;
    contrastInput.value = values.contrast;
    clarityInput.value = values.clarity;
    highlightsInput.value = values.highlights;
    shadowsInput.value = values.shadows;
    whitesInput.value = values.whites;
    blacksInput.value = values.blacks;
    saturationInput.value = values.saturation;
    vibranceInput.value = values.vibrance;
  }

  function clearPreview() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    previewImg.src = '#';
    previewImg.classList.add('hidden');
    placeholder.classList.remove('hidden');
    previewBox.classList.remove('active');
    filenameEl.textContent = '';
    originalImage = null;
    processedDataUrl = null;
    applyBtn.disabled = true;
    downloadBtn.disabled = true;
  }

  function showImage(file) {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    objectUrl = URL.createObjectURL(file);
    previewImg.src = objectUrl;
    previewImg.classList.remove('hidden');
    placeholder.classList.add('hidden');
    previewBox.classList.add('active');

    const name = file.name;
    filenameEl.textContent = name.length > 40 ? name.slice(0, 38) + '…' : name;

    originalImage = new Image();
    originalImage.onload = function() {
      processedDataUrl = null;
      downloadBtn.disabled = true;
      applyBtn.disabled = false;
    };
    originalImage.src = objectUrl;
  }

  // helper: rgb to hsl-ish adjustments
  function applyAdjustments() {
    if (!originalImage) return;

    const values = readInputs();
    syncInputs(values);

    const w = originalImage.naturalWidth;
    const h = originalImage.naturalHeight;
    if (w === 0 || h === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImage, 0, 0);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // precompute factors
    const exposureFactor = values.exposure >= 0
      ? 1 + (values.exposure / 100) * 1.5
      : 1 / (1 + (-values.exposure / 100) * 2);

    const brightnessOffset = (values.brightness / 100) * 80;

    const contrastFactor = values.contrast >= 0
      ? 1 + (values.contrast / 100) * 1.2
      : 1 / (1 + (-values.contrast / 100) * 0.8);

    const clarityFactor = values.clarity >= 0
      ? 1 + (values.clarity / 100) * 0.8
      : 1 / (1 + (-values.clarity / 100) * 0.6);

    const highlightsFactor = values.highlights >= 0
      ? 1 + (values.highlights / 100) * 0.9
      : 1 / (1 + (-values.highlights / 100) * 0.7);

    const shadowsFactor = values.shadows >= 0
      ? 1 + (values.shadows / 100) * 0.9
      : 1 / (1 + (-values.shadows / 100) * 0.7);

    const whitesFactor = values.whites >= 0
      ? 1 + (values.whites / 100) * 0.8
      : 1 / (1 + (-values.whites / 100) * 0.6);

    const blacksFactor = values.blacks >= 0
      ? 1 + (values.blacks / 100) * 0.8
      : 1 / (1 + (-values.blacks / 100) * 0.6);

    const saturationFactor = values.saturation >= 0
      ? 1 + (values.saturation / 100) * 1.5
      : 1 / (1 + (-values.saturation / 100) * 0.8);

    const vibranceAmount = values.vibrance / 100;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // exposure
      r *= exposureFactor;
      g *= exposureFactor;
      b *= exposureFactor;

      // brightness
      r += brightnessOffset;
      g += brightnessOffset;
      b += brightnessOffset;

      // contrast
      r = (r - 128) * contrastFactor + 128;
      g = (g - 128) * contrastFactor + 128;
      b = (b - 128) * contrastFactor + 128;

      // clarity (midtone contrast)
      r = 128 + (r - 128) * clarityFactor;
      g = 128 + (g - 128) * clarityFactor;
      b = 128 + (b - 128) * clarityFactor;

      // luma for zone-based adjustments
      let luma = 0.299 * r + 0.587 * g + 0.114 * b;

      // highlights (bright regions)
      if (luma > 128) {
        const weight = (luma - 128) / 127;
        r = r + (r * (highlightsFactor - 1)) * weight;
        g = g + (g * (highlightsFactor - 1)) * weight;
        b = b + (b * (highlightsFactor - 1)) * weight;
      }

      // shadows (dark regions)
      if (luma < 128) {
        const weight = (128 - luma) / 128;
        r = r + (r * (shadowsFactor - 1)) * weight;
        g = g + (g * (shadowsFactor - 1)) * weight;
        b = b + (b * (shadowsFactor - 1)) * weight;
      }

      // recalc luma after above
      luma = 0.299 * r + 0.587 * g + 0.114 * b;

      // whites (very bright)
      if (luma > 200) {
        const weight = (luma - 200) / 55;
        r = r + (r * (whitesFactor - 1)) * weight;
        g = g + (g * (whitesFactor - 1)) * weight;
        b = b + (b * (whitesFactor - 1)) * weight;
      }

      // blacks (very dark)
      if (luma < 55) {
        const weight = (55 - luma) / 55;
        r = r + (r * (blacksFactor - 1)) * weight;
        g = g + (g * (blacksFactor - 1)) * weight;
        b = b + (b * (blacksFactor - 1)) * weight;
      }

      // saturation
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * saturationFactor;
      g = gray + (g - gray) * saturationFactor;
      b = gray + (b - gray) * saturationFactor;

      // vibrance: boost less-saturated colors more
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;

      if (vibranceAmount !== 0) {
        const vibranceFactor = 1 + vibranceAmount * (1 - sat) * 1.2;
        r = gray + (r - gray) * vibranceFactor;
        g = gray + (g - gray) * vibranceFactor;
        b = gray + (b - gray) * vibranceFactor;
      }

      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }

    ctx.putImageData(imageData, 0, 0);
    processedDataUrl = canvas.toDataURL('image/png');

    previewImg.src = processedDataUrl;
    downloadBtn.disabled = false;
  }

  function downloadImage() {
    if (!processedDataUrl) return;

    const a = document.createElement('a');
    a.href = processedDataUrl;
    a.download = 'processed-image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleFileChange(e) {
    const files = e.target.files;

    if (!files || files.length === 0) {
      clearPreview();
      return;
    }

    const file = files[0];
    if (file.type.startsWith('image/')) {
      showImage(file);
    } else {
      clearPreview();
      filenameEl.textContent = 'not an image';
      fileInput.value = '';
    }
  }

  fileInput.addEventListener('click', function() {
    this.value = '';
  });

  fileInput.addEventListener('change', handleFileChange);
  applyBtn.addEventListener('click', applyAdjustments);
  downloadBtn.addEventListener('click', downloadImage);

  window.addEventListener('beforeunload', function() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  });

  clearPreview();
})();
