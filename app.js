// app.js — orquestra as três telas: Biblioteca, Carrinhos, Backup.

const CATEGORIES = [
  { id: 'banners', label: 'Banners' },
  { id: 'folhetos', label: 'Folhetos' },
  { id: 'brochuras', label: 'Brochuras' },
  { id: 'convites', label: 'Convites' },
  { id: 'livros', label: 'Livros' },
  { id: 'revistas', label: 'Revistas' }
];

const state = {
  view: 'biblioteca',
  items: [],           // cache em memória de todos os itens
  groups: [],
  objectUrls: new Map() // id -> object URL (pra não recriar toda hora)
};

const root = document.getElementById('view-root');
const modalOverlay = document.getElementById('modal-overlay');
const modalBox = document.getElementById('modal-box');
const fileInputHidden = document.getElementById('file-input-hidden');
const importInputHidden = document.getElementById('import-input-hidden');

function urlFor(item, kind = 'thumb') {
  const key = item.id + ':' + kind;
  if (state.objectUrls.has(key)) return state.objectUrls.get(key);
  const blob = kind === 'thumb' ? item.thumbBlob : item.fileBlob;
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  state.objectUrls.set(key, url);
  return url;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2200);
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalBox.innerHTML = '';
}

function openModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.classList.remove('hidden');
}

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

async function reloadData() {
  // Evita miniaturas "presas" quando um item é editado/substituído: gera URLs novas a cada render.
  for (const url of state.objectUrls.values()) URL.revokeObjectURL(url);
  state.objectUrls.clear();
  [state.items, state.groups] = await Promise.all([DB.allItems(), DB.allGroups()]);
}

async function render() {
  await reloadData();
  if (state.view === 'biblioteca') renderBiblioteca();
  else if (state.view === 'carrinhos') renderCarrinhos();
  else renderBackup();
}

// ============================================================
// TABS
// ============================================================
document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  state.view = btn.dataset.view;
  render();
});

// ============================================================
// BIBLIOTECA
// ============================================================
function renderBiblioteca() {
  const parts = CATEGORIES.map(cat => {
    const items = state.items.filter(i => i.category === cat.id)
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    const cards = items.map(itemCardHTML).join('');
    return `
      <section class="shelf">
        <div class="shelf-head">
          <span class="shelf-label">${cat.label}</span>
          <span class="shelf-count">${items.length} ${items.length === 1 ? 'item' : 'itens'}</span>
        </div>
        <div class="shelf-grid" data-cat="${cat.id}">
          ${cards}
          <div class="add-tile" data-add-cat="${cat.id}">
            <div class="plus">+</div>
            <span class="label">Adicionar</span>
          </div>
        </div>
      </section>`;
  }).join('');
  root.innerHTML = parts;

  root.querySelectorAll('.add-tile[data-add-cat]').forEach(el => {
    el.addEventListener('click', () => startUpload(el.dataset.addCat));
  });
  root.querySelectorAll('.item-card[data-item-id]').forEach(el => {
    el.addEventListener('click', () => openItemDetail(el.dataset.itemId));
  });
}

function itemCardHTML(item) {
  const badge = item.fileType === 'pdf' ? '<span class="pdf-badge">PDF</span>' : '';
  const sub = item.subtitle ? `<div class="subtitle">${escapeHTML(item.subtitle)}</div>` : '';
  return `
    <div class="item-card" data-item-id="${item.id}">
      <div class="thumb-wrap"><img loading="lazy" src="${urlFor(item, 'thumb')}" alt=""></div>
      ${badge}
      <div class="meta">
        <div class="title">${escapeHTML(item.title)}</div>
        ${sub}
      </div>
    </div>`;
}

function escapeHTML(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let pendingUploadCategory = null;
function startUpload(categoryId) {
  pendingUploadCategory = categoryId;
  fileInputHidden.value = '';
  fileInputHidden.click();
}

fileInputHidden.addEventListener('change', async () => {
  const file = fileInputHidden.files[0];
  if (!file) return;
  const category = pendingUploadCategory;
  openModal(`
    <h2>Processando arquivo…</h2>
    <div class="upload-progress"><div class="spinner"></div> Gerando miniatura da capa…</div>
  `);
  try {
    const { thumbBlob, fileBlob, fileType, fileName } = await processUpload(file);
    const suggestedTitle = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
    showNewItemForm({ category, thumbBlob, fileBlob, fileType, fileName, suggestedTitle });
  } catch (err) {
    console.error(err);
    closeModal();
    toast('Não consegui ler esse arquivo. Tente outra imagem ou PDF.');
  }
});

function showNewItemForm({ category, thumbBlob, fileBlob, fileType, fileName, suggestedTitle, existingItem }) {
  const isEdit = !!existingItem;
  const catLabel = CATEGORIES.find(c => c.id === category)?.label || category;
  const revistaField = category === 'revistas' ? `
    <div class="field">
      <label>Série</label>
      <select id="f-serie">
        <option value="">—</option>
        <option value="A Sentinela" ${existingItem?.subtitle?.startsWith('A Sentinela') ? 'selected' : ''}>A Sentinela</option>
        <option value="Despertai!" ${existingItem?.subtitle?.startsWith('Despertai!') ? 'selected' : ''}>Despertai!</option>
      </select>
    </div>` : '';

  const previewUrl = URL.createObjectURL(thumbBlob);

  openModal(`
    <h2>${isEdit ? 'Editar item' : 'Novo item'} · ${catLabel}</h2>
    <div style="display:flex; gap:14px; margin-bottom:6px;">
      <img src="${previewUrl}" style="width:90px;aspect-ratio:3/4;object-fit:cover;border-radius:8px;border:1px solid var(--border);flex-shrink:0;">
      <div style="flex:1">
        <div class="field">
          <label>Título</label>
          <input type="text" id="f-title" placeholder="Ex: Como ter uma família feliz" value="${escapeHTML(existingItem?.title || suggestedTitle || '')}">
        </div>
        ${category !== 'revistas' ? `
        <div class="field">
          <label>Observação (opcional)</label>
          <input type="text" id="f-subtitle" placeholder="Ex: Nº 3 2020" value="${escapeHTML(existingItem?.subtitle || '')}">
        </div>` : `
        <div class="field">
          <label>Edição (opcional)</label>
          <input type="text" id="f-edicao" placeholder="Ex: Nº 3 2020" value="${escapeHTML((existingItem?.subtitle || '').replace(/^(A Sentinela|Despertai!)\s*·?\s*/, ''))}">
        </div>
        ${revistaField}`}
      </div>
    </div>
    <div class="modal-actions">
      ${isEdit ? '<button class="cancel" id="f-delete" style="color:var(--danger)">Excluir</button>' : '<button class="cancel" id="f-cancel">Cancelar</button>'}
      <button class="confirm" id="f-save">Salvar</button>
    </div>
  `);

  document.getElementById('f-cancel')?.addEventListener('click', closeModal);
  document.getElementById('f-delete')?.addEventListener('click', async () => {
    if (!confirm('Excluir este item da biblioteca? Ele será removido de qualquer carrinho que o use.')) return;
    await DB.deleteItem(existingItem.id);
    removeItemFromAllCarts(existingItem.id);
    closeModal();
    toast('Item excluído.');
    render();
  });

  document.getElementById('f-save').addEventListener('click', async () => {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { toast('Dê um título pro item.'); return; }
    let subtitle = '';
    if (category === 'revistas') {
      const serie = document.getElementById('f-serie').value;
      const edicao = document.getElementById('f-edicao').value.trim();
      subtitle = [serie, edicao].filter(Boolean).join(' · ');
    } else {
      subtitle = document.getElementById('f-subtitle').value.trim();
    }
    const item = {
      id: existingItem?.id || uid(),
      category,
      title,
      subtitle,
      fileType,
      fileName,
      thumbBlob,
      fileBlob,
      createdAt: existingItem?.createdAt || Date.now()
    };
    await DB.putItem(item);
    closeModal();
    toast(isEdit ? 'Item atualizado.' : 'Item adicionado à biblioteca.');
    render();
  });
}

async function openItemDetail(id) {
  const item = await DB.getItem(id);
  if (!item) return;
  showNewItemForm({
    category: item.category,
    thumbBlob: item.thumbBlob,
    fileBlob: item.fileBlob,
    fileType: item.fileType,
    fileName: item.fileName,
    existingItem: item
  });
}

// ============================================================
// CARRINHOS
// ============================================================
function renderCarrinhos() {
  if (state.groups.length === 0) {
    root.innerHTML = `
      <button class="add-group-btn" id="btn-add-group">＋ Nova ocasião</button>
      <div class="empty-state">
        <div class="big">🛒</div>
        <h3>Nenhum carrinho ainda</h3>
        <p>Crie uma ocasião (ex: "Mercado Municipal", "Ração") e monte o carrinho com um banner e as publicações, igual no seu layout do Figma.</p>
      </div>`;
    document.getElementById('btn-add-group').addEventListener('click', showNewGroupForm);
    return;
  }

  const html = state.groups.map(groupHTML).join('');
  root.innerHTML = `<button class="add-group-btn" id="btn-add-group">＋ Nova ocasião</button>` + html;
  document.getElementById('btn-add-group').addEventListener('click', showNewGroupForm);

  root.querySelectorAll('[data-edit-group]').forEach(el =>
    el.addEventListener('click', () => showNewGroupForm(findGroup(el.dataset.editGroup))));
  root.querySelectorAll('[data-del-group]').forEach(el =>
    el.addEventListener('click', () => deleteGroup(el.dataset.delGroup)));
  root.querySelectorAll('[data-add-cart]').forEach(el =>
    el.addEventListener('click', () => addCartToGroup(el.dataset.addCart)));
  root.querySelectorAll('[data-del-cart]').forEach(el =>
    el.addEventListener('click', () => deleteCart(el.dataset.delCart, el.dataset.cartId)));
  root.querySelectorAll('[data-cart-add-item]').forEach(el =>
    el.addEventListener('click', () => openItemPicker(el.dataset.cartAddItem, el.dataset.cartId)));
  root.querySelectorAll('[data-rm-cart-item]').forEach(el =>
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCartItem(el.dataset.rmCartItem, el.dataset.cartId, Number(el.dataset.idx));
    }));
  root.querySelectorAll('[data-move-up]').forEach(el =>
    el.addEventListener('click', () => moveCartItem(el.dataset.moveUp, el.dataset.cartId, Number(el.dataset.idx), -1)));
  root.querySelectorAll('[data-move-down]').forEach(el =>
    el.addEventListener('click', () => moveCartItem(el.dataset.moveDown, el.dataset.cartId, Number(el.dataset.idx), 1)));
}

async function moveCartItem(groupId, cartId, idx, dir) {
  const group = findGroup(groupId);
  const cart = findCart(group, cartId);
  const j = idx + dir;
  if (j < 0 || j >= cart.itemIds.length) return;
  [cart.itemIds[idx], cart.itemIds[j]] = [cart.itemIds[j], cart.itemIds[idx]];
  await DB.putGroup(group);
  render();
}

function findGroup(id) { return state.groups.find(g => g.id === id); }
function findCart(group, cartId) { return group.carts.find(c => c.id === cartId); }

function groupHTML(group) {
  const cartsHTML = group.carts.map(cart => cartColHTML(group, cart)).join('');
  return `
    <div class="group-card" data-group-id="${group.id}">
      <div class="group-head">
        <h2>${escapeHTML(group.name)}</h2>
        <button class="icon-btn" data-edit-group="${group.id}" title="Renomear">✎</button>
        <button class="icon-btn danger" data-del-group="${group.id}" title="Excluir ocasião">🗑</button>
      </div>
      <div class="carts-row">
        ${cartsHTML}
        <div class="add-cart-col" data-add-cart="${group.id}">＋<br>carrinho</div>
      </div>
    </div>`;
}

function cartColHTML(group, cart) {
  const last = cart.itemIds.length - 1;
  const itemsHTML = cart.itemIds.map((id, idx) => {
    const item = state.items.find(i => i.id === id);
    if (!item) return '';
    const isBanner = item.category === 'banners';
    return `
      <div class="cart-entry">
        <div class="order-btns">
          <button ${idx === 0 ? 'disabled' : ''} data-move-up="${group.id}" data-cart-id="${cart.id}" data-idx="${idx}">▲</button>
          <button ${idx === last ? 'disabled' : ''} data-move-down="${group.id}" data-cart-id="${cart.id}" data-idx="${idx}">▼</button>
        </div>
        <div class="cart-item ${isBanner ? 'banner-item' : ''}" data-item-id="${id}">
          <img src="${urlFor(item, 'thumb')}" alt="">
          <button class="rm" data-rm-cart-item="${group.id}" data-cart-id="${cart.id}" data-idx="${idx}">×</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="cart-col">
      <div class="cart-col-head">
        <span class="name">${escapeHTML(cart.name)}</span>
        <button class="icon-btn danger" style="width:24px;height:24px;font-size:12px" data-del-cart="${group.id}" data-cart-id="${cart.id}" title="Excluir carrinho">🗑</button>
      </div>
      <div class="cart-stack" data-cart-id="${cart.id}">
        ${itemsHTML || '<div style="text-align:center;color:var(--text-dim);font-size:11.5px;padding:14px 4px;">Vazio</div>'}
      </div>
      <button class="cart-add-btn" data-cart-add-item="${group.id}" data-cart-id="${cart.id}">+ Item</button>
      <div class="cart-wheels"><span></span><span></span></div>
    </div>`;
}

function showNewGroupForm(existingGroup) {
  const isEdit = !!existingGroup;
  openModal(`
    <h2>${isEdit ? 'Renomear ocasião' : 'Nova ocasião'}</h2>
    <div class="field">
      <label>Nome</label>
      <input type="text" id="g-name" placeholder="Ex: Mercado Municipal | Feira" value="${escapeHTML(existingGroup?.name || '')}">
    </div>
    <div class="modal-actions">
      <button class="cancel" id="g-cancel">Cancelar</button>
      <button class="confirm" id="g-save">Salvar</button>
    </div>
  `);
  document.getElementById('g-cancel').addEventListener('click', closeModal);
  document.getElementById('g-save').addEventListener('click', async () => {
    const name = document.getElementById('g-name').value.trim();
    if (!name) { toast('Dê um nome pra ocasião.'); return; }
    if (isEdit) {
      existingGroup.name = name;
      await DB.putGroup(existingGroup);
    } else {
      const group = {
        id: uid(),
        name,
        order: state.groups.length,
        carts: [
          { id: uid(), name: 'Carrinho 1', itemIds: [] },
          { id: uid(), name: 'Carrinho 2', itemIds: [] }
        ]
      };
      await DB.putGroup(group);
    }
    closeModal();
    render();
  });
}

async function deleteGroup(id) {
  if (!confirm('Excluir esta ocasião e seus carrinhos? Os itens continuam na biblioteca.')) return;
  await DB.deleteGroup(id);
  render();
}

async function addCartToGroup(groupId) {
  const group = findGroup(groupId);
  const n = group.carts.length + 1;
  group.carts.push({ id: uid(), name: `Carrinho ${n}`, itemIds: [] });
  await DB.putGroup(group);
  render();
}

async function deleteCart(groupId, cartId) {
  const group = findGroup(groupId);
  if (group.carts.length <= 1) {
    if (!confirm('Excluir o único carrinho desta ocasião? Isso vai remover a ocasião inteira.')) return;
    await DB.deleteGroup(groupId);
    render();
    return;
  }
  if (!confirm('Excluir este carrinho?')) return;
  group.carts = group.carts.filter(c => c.id !== cartId);
  await DB.putGroup(group);
  render();
}

async function removeCartItem(groupId, cartId, idx) {
  const group = findGroup(groupId);
  const cart = findCart(group, cartId);
  cart.itemIds.splice(idx, 1);
  await DB.putGroup(group);
  render();
}

async function removeItemFromAllCarts(itemId) {
  for (const group of state.groups) {
    let changed = false;
    for (const cart of group.carts) {
      const before = cart.itemIds.length;
      cart.itemIds = cart.itemIds.filter(id => id !== itemId);
      if (cart.itemIds.length !== before) changed = true;
    }
    if (changed) await DB.putGroup(group);
  }
}

// ---- picker de itens da biblioteca pra adicionar num carrinho ----
function openItemPicker(groupId, cartId) {
  let activeCat = CATEGORIES[0].id;

  function bodyHTML() {
    const items = state.items.filter(i => i.category === activeCat)
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    return items.map(itemCardHTML).join('') || '<p style="color:var(--text-dim);font-size:13px;padding:20px 0;">Nenhum item nessa categoria ainda. Adicione na Biblioteca.</p>';
  }

  openModal(`
    <h2>Adicionar item ao carrinho</h2>
    <div class="picker-tabs">
      ${CATEGORIES.map(c => `<button data-cat="${c.id}" class="${c.id === activeCat ? 'active' : ''}">${c.label}</button>`).join('')}
    </div>
    <div class="picker-grid" id="picker-grid">${bodyHTML()}</div>
  `);

  function bindGrid() {
    document.querySelectorAll('#picker-grid .item-card').forEach(el => {
      el.addEventListener('click', async () => {
        const group = findGroup(groupId);
        const cart = findCart(group, cartId);
        cart.itemIds.push(el.dataset.itemId);
        await DB.putGroup(group);
        closeModal();
        render();
      });
    });
  }
  bindGrid();

  modalBox.querySelectorAll('.picker-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCat = btn.dataset.cat;
      modalBox.querySelectorAll('.picker-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('picker-grid').innerHTML = bodyHTML();
      bindGrid();
    });
  });
}

// ============================================================
// BACKUP
// ============================================================
function renderBackup() {
  const totalItems = state.items.length;
  const totalGroups = state.groups.length;
  const totalCarts = state.groups.reduce((n, g) => n + g.carts.length, 0);

  root.innerHTML = `
    <div class="backup-view">
      <div class="stat-row">
        <div class="stat"><div class="n">${totalItems}</div><div class="l">itens</div></div>
        <div class="stat"><div class="n">${totalGroups}</div><div class="l">ocasiões</div></div>
        <div class="stat"><div class="n">${totalCarts}</div><div class="l">carrinhos</div></div>
      </div>

      <div class="backup-card">
        <h2>Exportar backup</h2>
        <p>Gera um arquivo .zip com toda a biblioteca (imagens e PDFs) e todos os carrinhos montados. Guarde no iCloud Drive, Google Drive ou onde preferir.</p>
        <button class="big-btn primary" id="btn-export">Exportar backup (.zip)</button>
      </div>

      <div class="backup-card">
        <h2>Importar backup</h2>
        <p>Restaura a partir de um arquivo .zip exportado antes. Itens com o mesmo ID são atualizados; o restante é adicionado.</p>
        <button class="big-btn secondary" id="btn-import">Selecionar arquivo .zip</button>
      </div>
    </div>
  `;

  document.getElementById('btn-export').addEventListener('click', async () => {
    const btn = document.getElementById('btn-export');
    btn.textContent = 'Gerando .zip…';
    btn.disabled = true;
    try {
      await exportBackup();
      toast('Backup exportado.');
    } catch (err) {
      console.error(err);
      toast('Erro ao gerar o backup.');
    } finally {
      btn.textContent = 'Exportar backup (.zip)';
      btn.disabled = false;
    }
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    importInputHidden.value = '';
    importInputHidden.click();
  });
}

importInputHidden.addEventListener('change', async () => {
  const file = importInputHidden.files[0];
  if (!file) return;
  if (!confirm('Importar este backup? Itens e carrinhos com o mesmo ID serão substituídos.')) return;
  openModal(`<h2>Importando…</h2><div class="upload-progress"><div class="spinner"></div> Restaurando biblioteca e carrinhos…</div>`);
  try {
    const result = await importBackup(file);
    closeModal();
    toast(`Importado: ${result.items} itens, ${result.groups} ocasiões.`);
    render();
  } catch (err) {
    console.error(err);
    closeModal();
    toast('Não consegui importar esse arquivo.');
  }
});

// ============================================================
// BOOT
// ============================================================
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
