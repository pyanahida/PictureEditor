(function() {
  const fileInput = document.getElementById('file-input');
  const previewImg = document.getElementById('preview-img');
  const placeholder = document.getElementById('placeholder');
  const previewBox = document.getElementById('preview-box');
  const filenameEl = document.getElementById('filename');
  const exposureInput = document.getElementById('exposure-input');
  const applyBtn = document.getElementById('apply-btn');
  const downloadBtn = document.getElementById('download-btn');

  let originalImage = null;
  let processedDataUrl = null;
  let objectUrl = null;

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

  function clampExposure(value) {
    const n = parseFloat(value);
    if (isNaN(n)) return 0;
    return Math.max(-100, Math.min(100, n));
  }

  function applyExposure() {
    if (!originalImage) return;

    const exposure = clampExposure(exposureInput.value);
    exposureInput.value = exposure;

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

    // exposure adjustment: convert -100..100 to a factor
    // 0 -> 1, 100 -> ~2.5x, -100 -> ~0.1x
    const factor = exposure >= 0
      ? 1 + (exposure / 100) * 1.5
      : 1 / (1 + (-exposure / 100) * 2);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * factor));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor));
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
  applyBtn.addEventListener('click', applyExposure);
  downloadBtn.addEventListener('click', downloadImage);

  window.addEventListener('beforeunload', function() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  });

  clearPreview();
})();
