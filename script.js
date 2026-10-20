// script.js
(function() {
  const fileInput = document.getElementById('file-input');
  const previewImg = document.getElementById('preview-img');
  const placeholder = document.getElementById('placeholder');
  const previewBox = document.getElementById('preview-box');
  const filenameEl = document.getElementById('filename');

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

  // reset input so the same file can be chosen again (triggers change)
  fileInput.addEventListener('click', function() {
    this.value = '';
  });

  fileInput.addEventListener('change', handleFileChange);

  // clean up object url on page unload
  window.addEventListener('beforeunload', function() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  });

  // start clean
  clearPreview();
})();
