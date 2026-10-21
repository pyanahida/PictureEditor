(function() {
  'use strict';

  const fileInput   = document.getElementById('file-input');
  const previewImg  = document.getElementById('preview-img');
  const placeholder = document.getElementById('placeholder');
  const previewBox  = document.getElementById('preview-box');
  const filenameEl  = document.getElementById('filename');
  const applyBtn    = document.getElementById('apply-btn');
  const downloadBtn = document.getElementById('download-btn');
  
  const hslBtn      = document.getElementById('hsl-btn');
  const hslModal    = document.getElementById('hsl-modal');
  const closeHslBtn = document.getElementById('close-hsl');
  
  const postBtn       = document.getElementById('posterization-btn');
  const postModal     = document.getElementById('posterization-modal');
  const closePostBtn  = document.getElementById('close-posterization');
  
  const curvesBtn     = document.getElementById('curves-btn');
  const curvesModal   = document.getElementById('curves-modal');
  const closeCurvesBtn = document.getElementById('close-curves');
  const deletePointBtn = document.getElementById('delete-point-btn');

  const savePresetBtn = document.getElementById('save-preset-btn');
  const loadPresetBtn = document.getElementById('load-preset-btn');
  const presetInput   = document.getElementById('preset-input');

  let originalImage = null;
  let originalFile  = null;
  let currentObjectUrl = null;
  let processedDataUrl = null;

  window.UI.buildControls(document.getElementById('controls'));
  window.UI.buildHslGrid(document.getElementById('hsl-grid'));
  window.UI.buildPostGrid(document.getElementById('posterization-grid'));
  window.UI.buildCurves(document.getElementById('curves-grid'), deletePointBtn);

  deletePointBtn.addEventListener('click', () => {
    window.UI.deleteSelectedPoint();
  });

  function applyNow() {
    if (!originalImage) return;
    
    applyBtn.disabled = true;
    applyBtn.textContent = 'processing...';

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

        const values = window.UI.getValues();
        if (!window.UI.isIdentity(values)) {
          const imageData = ctx.getImageData(0, 0, nw, nh);
          window.Pipeline.processPixels(imageData.data, nw, nh, values);
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

  function handleFileChange(e) {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
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

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
    }

    currentObjectUrl = URL.createObjectURL(file);

    previewImg.src = currentObjectUrl;
    previewImg.classList.remove('hidden');
    placeholder.classList.add('hidden');
    previewBox.classList.add('active');

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
    
    originalImage.src = currentObjectUrl;
  }

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

  function savePreset() {
    const values = window.UI.getValues();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(values, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'picture-editor-preset.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function loadPreset(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        window.UI.loadValues(data);
        filenameEl.textContent = 'preset loaded successfully';
      } catch (err) {
        filenameEl.textContent = 'invalid preset file';
      }
    };
    reader.readAsText(file);
    presetInput.value = '';
  }

  savePresetBtn.addEventListener('click', savePreset);
  loadPresetBtn.addEventListener('click', () => {
    presetInput.click();
  });
  presetInput.addEventListener('change', loadPreset);

  hslBtn.addEventListener('click', () => { hslModal.classList.remove('hidden'); });
  closeHslBtn.addEventListener('click', () => { hslModal.classList.add('hidden'); });
  hslModal.addEventListener('click', (e) => { if (e.target === hslModal) hslModal.classList.add('hidden'); });

  postBtn.addEventListener('click', () => { postModal.classList.remove('hidden'); });
  closePostBtn.addEventListener('click', () => { postModal.classList.add('hidden'); });
  postModal.addEventListener('click', (e) => { if (e.target === postModal) postModal.classList.add('hidden'); });

  curvesBtn.addEventListener('click', () => { curvesModal.classList.remove('hidden'); });
  closeCurvesBtn.addEventListener('click', () => { curvesModal.classList.add('hidden'); });
  curvesModal.addEventListener('click', (e) => { if (e.target === curvesModal) curvesModal.classList.add('hidden'); });

  fileInput.addEventListener('change', handleFileChange);
  applyBtn.addEventListener('click', applyNow);
  downloadBtn.addEventListener('click', downloadImage);

  clearPreview();
})();
