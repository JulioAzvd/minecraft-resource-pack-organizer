(function () {
  const { dbGetAllPacks, dbPutPack, dbPutPacks, dbDeletePack } = window.RPDB;
  const { MC_COLORS, formattingCodesToHtml, formattingCodesToEditableHtml, htmlToFormattingCodes, plainTextFromHtml, refreshObfuscatedText } = window.RichText;

  const availableListEl = document.getElementById('availableList');
  const activeListEl = document.getElementById('activeList');
  const emptyHintEl = document.getElementById('emptyHint');

  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitleEl = document.getElementById('modalTitle');
  const coverPreview = document.getElementById('coverPreview');
  const coverInput = document.getElementById('coverInput');
  const coverUrlInput = document.getElementById('coverUrlInput');
  const btnUseCoverUrl = document.getElementById('btnUseCoverUrl');
  const btnChooseTemplate = document.getElementById('btnChooseTemplate');
  const templatePicker = document.getElementById('templatePicker');
  const templateGrid = document.getElementById('templateGrid');
  const btnRemoveCover = document.getElementById('btnRemoveCover');
  const confirmOverlay = document.getElementById('confirmOverlay');
  const confirmMessage = document.getElementById('confirmMessage');
  const btnConfirmCancel = document.getElementById('btnConfirmCancel');
  const btnConfirmRemove = document.getElementById('btnConfirmRemove');
  const titleInput = document.getElementById('titleInput');
  const titlePreview = document.getElementById('titlePreview');
  const titleCounter = document.getElementById('titleCounter');
  const descriptionInput = document.getElementById('descriptionInput');
  const descriptionPreview = document.getElementById('descriptionPreview');
  const descriptionCounter = document.getElementById('descriptionCounter');
  const incompatibleInput = document.getElementById('incompatibleInput');
  const btnSave = document.getElementById('btnSave');
  const btnCancel = document.getElementById('btnCancel');
  const btnAdd = document.getElementById('btnAdd');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const importFile = document.getElementById('importFile');
  const btnTop = document.getElementById('btnTop');
  const btnFloatingAdd = document.getElementById('btnFloatingAdd');
  const btnFloatingExport = document.getElementById('btnFloatingExport');
  const btnFloatingImport = document.getElementById('btnFloatingImport');
  const topbar = document.querySelector('.topbar');
  const floatingActions = document.getElementById('floatingActions');

  const richToolbar = document.getElementById('richToolbar');
  const toolbarSwatches = document.getElementById('toolbarSwatches');
  const toolbarCustomColor = document.getElementById('toolbarCustomColor');

  const PLACEHOLDER_IMG = 'assets/placeholder.svg';
  const MAX_COVER_SIZE = 128;
  let packs = [];
  let editingId = null;
  let currentCoverData = null; // dataURL da capa em edição
  let pendingRemovalId = null;

  const headerObserver = new IntersectionObserver(([entry]) => {
    floatingActions.classList.toggle('hidden', entry.isIntersecting);
  }, { threshold: 0.05 });
  headerObserver.observe(topbar);

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  async function loadPacks() {
    packs = await dbGetAllPacks();
    packs = packs.map((pack) => ({
      ...pack,
      column: normalizeColumn(pack.column),
      titleText: pack.titleText ?? htmlToFormattingCodes(pack.titleHtml ?? pack.title ?? 'No title'),
      descriptionText: pack.descriptionText ?? htmlToFormattingCodes(pack.descriptionHtml ?? pack.description ?? ''),
    }));
    await dbPutPacks(packs);
    render();
  }

  function byColumnSorted(column) {
    return packs
      .filter((p) => p.column === column)
      .sort((a, b) => a.order - b.order);
  }

  function normalizeColumn(column) {
    return column === 'active' || column === 'selected' ? 'selected' : 'available';
  }

  function render() {
    availableListEl.innerHTML = '';
    activeListEl.innerHTML = '';

    const available = byColumnSorted('available');
    const active = byColumnSorted('selected');

    available.forEach((pack) => availableListEl.appendChild(buildRow(pack)));
    active.forEach((pack) => activeListEl.appendChild(buildRow(pack)));

    emptyHintEl.classList.toggle('hidden', packs.length > 0);
  }

  function buildRow(pack) {
    const row = document.createElement('div');
    row.className = 'pack-row' + (pack.incompatible ? ' incompatible' : '');
    row.draggable = true;
    row.dataset.id = pack.id;

    const img = document.createElement('img');
    img.className = 'cover';
    img.src = pack.image || PLACEHOLDER_IMG;
    row.appendChild(img);

    const info = document.createElement('div');
    info.className = 'info';

    const title = document.createElement('div');
    title.className = 'title';
    title.innerHTML = formattingCodesToHtml(pack.titleText || pack.titleHtml || 'No title');
    info.appendChild(title);

    if (pack.descriptionText || pack.descriptionHtml) {
      const desc = document.createElement('div');
      desc.className = 'description';
      desc.innerHTML = formattingCodesToHtml(pack.descriptionText ?? pack.descriptionHtml);
      info.appendChild(desc);
    }

    if (pack.incompatible) {
      const badge = document.createElement('div');
      badge.className = 'incompatible-badge';
      badge.textContent = '⚠ Incompatible version';
      info.appendChild(badge);
    }
    row.appendChild(info);
    refreshObfuscatedText(row);

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-small';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openModal(pack));
    actions.appendChild(editBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-small';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removePack(pack.id));
    actions.appendChild(removeBtn);

    row.appendChild(actions);

    row.addEventListener('dragstart', (e) => {
      row.classList.add('dragging');
      e.dataTransfer.setData('text/plain', pack.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));

    return row;
  }

  function getDragAfterElement(container, y) {
    const rows = [...container.querySelectorAll('.pack-row:not(.dragging)')];
    return rows.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  function setupColumnDnd(listEl, columnName) {
    listEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = document.querySelector('.pack-row.dragging');
      if (!dragging) return;
      const afterEl = getDragAfterElement(listEl, e.clientY);
      if (afterEl == null) {
        listEl.appendChild(dragging);
      } else {
        listEl.insertBefore(dragging, afterEl);
      }
    });

    listEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      const pack = packs.find((p) => p.id === id);
      if (!pack) return;
      pack.column = columnName;

      // recalcula a ordem de ambas as colunas com base na posição final no DOM.
      const updated = [];
      [availableListEl, activeListEl].forEach((el) => {
        const col = el.dataset.column;
        [...el.querySelectorAll('.pack-row')].forEach((rowEl, idx) => {
          const p = packs.find((pp) => pp.id === rowEl.dataset.id);
          if (p) {
            p.column = col;
            p.order = idx;
            updated.push(p);
          }
        });
      });
      await dbPutPacks(updated);
      render();
    });
  }

  setupColumnDnd(availableListEl, 'available');
  setupColumnDnd(activeListEl, 'selected');

  async function removePack(id) {
    const pack = packs.find((item) => item.id === id);
    if (!pack) return;
    pendingRemovalId = id;
    confirmMessage.textContent = `Remove "${plainTextFromHtml(formattingCodesToHtml(pack.titleText || 'No title'))}" from the list?`;
    confirmOverlay.classList.remove('hidden');
  }

  function closeConfirm() {
    pendingRemovalId = null;
    confirmOverlay.classList.add('hidden');
  }

  btnConfirmCancel.addEventListener('click', closeConfirm);
  confirmOverlay.addEventListener('click', (event) => {
    if (event.target === confirmOverlay) closeConfirm();
  });
  btnConfirmRemove.addEventListener('click', async () => {
    if (!pendingRemovalId) return;
    const id = pendingRemovalId;
    closeConfirm();
    await dbDeletePack(id);
    packs = packs.filter((p) => p.id !== id);
    render();
  });

  // ---------- Modal ----------

  function getActiveEditable() {
    const active = document.activeElement;
    return active && active.matches('[data-rich-editable]') ? active : null;
  }

  function hideRichToolbar() {
    richToolbar.classList.add('hidden');
  }

  function insertFormattingCode(input, code) {
    if (!code) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = input.value.slice(start, end);
    const replacement = selected && code !== 'r' ? `§${code}${selected}§r` : `§${code}${selected}`;
    input.setRangeText(replacement, start, end, 'end');
    updatePreview(input, input === titleInput ? titlePreview : descriptionPreview);
    input.focus();
  }

  toolbarCustomColor.addEventListener('input', () => {
    const editable = getActiveEditable();
    if (editable) insertFormattingCode(editable, `x{${toolbarCustomColor.value.slice(1).toUpperCase()}}`);
  });

  function updatePreview(input, preview) {
    preview.innerHTML = formattingCodesToEditableHtml(input.value);
    refreshObfuscatedText(preview);
    preview.scrollTop = input.scrollTop;
    preview.scrollLeft = input.scrollLeft;
  }

  function updateCharacterCounter(input, counter) {
    counter.textContent = `${input.value.length}/${input.maxLength}`;
    counter.classList.toggle('near-limit', input.value.length >= input.maxLength * 0.9);
  }

  [[titleInput, titlePreview, titleCounter], [descriptionInput, descriptionPreview, descriptionCounter]].forEach(([input, preview, counter]) => {
    input.addEventListener('input', () => {
      updatePreview(input, preview);
      updateCharacterCounter(input, counter);
    });
    input.addEventListener('scroll', () => updatePreview(input, preview));
    updateCharacterCounter(input, counter);
  });

  window.setInterval(() => refreshObfuscatedText(document), 70);

  function positionRichToolbar(rect) {
    if (rect.width === 0 && rect.height === 0) {
      hideRichToolbar();
      return;
    }
    richToolbar.classList.remove('hidden');
    const toolbarRect = richToolbar.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - toolbarRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - toolbarRect.width - 8));
    let top = rect.top - toolbarRect.height - 8;
    if (top < 8) top = rect.bottom + 8;
    richToolbar.style.left = `${left}px`;
    richToolbar.style.top = `${top}px`;
  }

  document.addEventListener('selectionchange', () => {
    const editable = getActiveEditable();
    if (!editable || editable.selectionStart === editable.selectionEnd) {
      hideRichToolbar();
      return;
    }
    positionRichToolbar(editable.getBoundingClientRect());
  });

  richToolbar.addEventListener('mousedown', (e) => e.preventDefault());

  richToolbar.querySelectorAll('[data-cmd]').forEach((button) => {
    button.addEventListener('click', () => {
      const command = button.dataset.cmd;
      const editable = getActiveEditable();
      if (!editable) return;
      const codeByCommand = { bold: 'l', italic: 'o', underline: 'n', strikeThrough: 'm', obfuscated: 'k', removeFormat: 'r' };
      insertFormattingCode(editable, codeByCommand[command]);
    });
  });

  function buildToolbarSwatches() {
    toolbarSwatches.innerHTML = '';
    MC_COLORS.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-swatch';
      btn.style.backgroundColor = c.background;
      btn.style.color = c.hex;
      btn.textContent = c.code;
      btn.title = c.name;
      btn.addEventListener('click', () => {
        const editable = getActiveEditable();
        if (editable) insertFormattingCode(editable, c.code);
      });
      toolbarSwatches.appendChild(btn);
    });
  }
  buildToolbarSwatches();

  function resizeImageFile(file, maxSize) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;
          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  coverInput.addEventListener('change', async () => {
    const file = coverInput.files[0];
    if (!file) return;
    try {
      currentCoverData = await resizeImageFile(file, MAX_COVER_SIZE);
      coverPreview.src = currentCoverData;
    } catch (err) {
      alert('Couldn\'t load this image.');
    }
  });

  btnUseCoverUrl.addEventListener('click', () => {
    const url = coverUrlInput.value.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch (err) {
      alert('Invalid URL.');
      return;
    }
    
    currentCoverData = url;
    coverPreview.src = currentCoverData;
    coverInput.value = '';
    coverUrlInput.value = '';
  });


  btnChooseTemplate.addEventListener('click', () => {
    templatePicker.classList.toggle('hidden');
  });

  function buildTemplatePicker() {
    templatePicker.querySelectorAll('.template-grid.hidden').forEach((grid) => grid.remove());
    templateGrid.innerHTML = '';
    window.RESOURCE_PACK_TEMPLATES.forEach((template) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'template-option';
      button.dataset.template = template;
      button.title = template.split('/').pop().replace(/\.[^.]+$/, '').replaceAll('_', ' ');
      const image = document.createElement('img');
      image.src = template;
      image.alt = '';
      button.appendChild(image);
      button.addEventListener('click', () => {
        currentCoverData = template;
        coverPreview.src = currentCoverData;
        coverInput.value = '';
        coverUrlInput.value = '';
        templatePicker.classList.add('hidden');
      });
      templateGrid.appendChild(button);
    });
  }
  buildTemplatePicker();

  btnRemoveCover.addEventListener('click', () => {
    currentCoverData = null;
    coverPreview.src = PLACEHOLDER_IMG;
    coverInput.value = '';
    coverUrlInput.value = '';
  });

  function openModal(pack) {
    editingId = pack ? pack.id : null;
    modalTitleEl.textContent = pack ? 'Edit Resource Pack' : 'New Resource Pack';
    titleInput.value = (pack ? pack.titleText ?? htmlToFormattingCodes(pack.titleHtml ?? '') : '').slice(0, titleInput.maxLength);
    descriptionInput.value = (pack ? pack.descriptionText ?? htmlToFormattingCodes(pack.descriptionHtml ?? '') : '').slice(0, descriptionInput.maxLength);
    updatePreview(titleInput, titlePreview);
    updatePreview(descriptionInput, descriptionPreview);
    updateCharacterCounter(titleInput, titleCounter);
    updateCharacterCounter(descriptionInput, descriptionCounter);
    incompatibleInput.checked = pack ? !!pack.incompatible : false;
    currentCoverData = pack ? pack.image || null : null;
    coverPreview.src = currentCoverData || PLACEHOLDER_IMG;
    coverInput.value = '';
    coverUrlInput.value = '';
    templatePicker.classList.add('hidden');
    modalOverlay.classList.remove('hidden');
    setTimeout(() => titleInput.focus(), 0);
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
    hideRichToolbar();
    editingId = null;
    currentCoverData = null;
  }

  btnAdd.addEventListener('click', () => openModal(null));
  btnFloatingAdd.addEventListener('click', () => openModal(null));
  btnCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  btnSave.addEventListener('click', async () => {
    const titleText = titleInput.value;
    const titleHtml = formattingCodesToHtml(titleText);
    const plainTitle = plainTextFromHtml(titleHtml).trim();
    if (!plainTitle) {
      alert('Enter a title for the pack.');
      return;
    }
    const descriptionText = descriptionInput.value;
    const descriptionHtml = formattingCodesToHtml(descriptionText);
    const incompatible = incompatibleInput.checked;

    if (editingId) {
      const pack = packs.find((p) => p.id === editingId);
      pack.titleText = titleText;
      pack.descriptionText = descriptionText;
      pack.titleHtml = titleHtml;
      pack.descriptionHtml = descriptionHtml;
      pack.incompatible = incompatible;
      pack.image = currentCoverData;
      await dbPutPack(pack);
    } else {
      const available = byColumnSorted('available');
      const newPack = {
        id: uuid(),
        titleText,
        descriptionText,
        titleHtml,
        descriptionHtml,
        incompatible,
        image: currentCoverData,
        column: 'available',
        order: available.length,
      };
      packs.push(newPack);
      await dbPutPack(newPack);
    }

    closeModal();
    render();
  });

  // ---------- export/import json ----------

  btnExport.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(packs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resourcepacks-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  btnFloatingExport.addEventListener('click', () => btnExport.click());

  btnImport.addEventListener('click', () => importFile.click());
  btnFloatingImport.addEventListener('click', () => btnImport.click());
  btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  importFile.addEventListener('change', async () => {
    const file = importFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Invalid format');
      const normalized = data.map((p, idx) => ({
        id: p.id || uuid(),
        titleText: p.titleText || htmlToFormattingCodes(p.titleHtml || p.title || 'No title'),
        descriptionText: p.descriptionText || htmlToFormattingCodes(p.descriptionHtml || p.description || ''),
        titleHtml: formattingCodesToHtml(p.titleText || p.title || 'No title'),
        descriptionHtml: formattingCodesToHtml(p.descriptionText || p.description || ''),
        incompatible: !!p.incompatible,
        image: p.image || null,
        column: normalizeColumn(p.column),
        order: typeof p.order === 'number' ? p.order : idx,
      }));
      await dbPutPacks(normalized);
      packs = await dbGetAllPacks();
      render();
    } catch (err) {
      alert('Invalid backup file.');
    } finally {
      importFile.value = '';
    }
  });

  loadPacks();
})();
