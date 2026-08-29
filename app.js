// app.js — orquestra a tela única: carrinho (esquerda) + biblioteca por categorias (direita).

const CATEGORIES = [
  { id: 'banners', label: 'Banners' },
  { id: 'folhetos', label: 'Folhetos' },
  { id: 'brochuras', label: 'Brochuras' },
  { id: 'convites', label: 'Convites' },
  { id: 'livros', label: 'Livros' },
  { id: 'sentinela', label: 'A Sentinela' },
  { id: 'despertai', label: 'Despertai!' }
];

const state = {
  items: [],
  carts: [],
  currentCartIndex: 0,
  objectUrls: new Map() // id:kind -> object URL (pra não recriar toda hora)
};

const cartPanel = document.getElementById('cart-panel');
const toolbar = document.getElementById('toolbar');
const modalOverlay = document.getElementById('modal-overlay');
const modalBox = document.getElementById('modal-box');
const fileInputHidden = document.getElementById('file-input-hidden');
const importInputHidden = document.getElementById('import-input-hidden');
const btnBackup = document.getElementById('btn-backup');

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
  modalOverlay.classList.remove('flex');
  modalBox.innerHTML = '';
}

function openModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.classList.remove('hidden');
  modalOverlay.classList.add('flex');
}

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

function escapeHTML(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function reloadItems() {
  for (const url of state.objectUrls.values()) URL.revokeObjectURL(url);
  state.objectUrls.clear();
  state.items = await DB.allItems();
}

async function reloadCarts() {
  state.carts = await DB.allCarts();
  if (state.currentCartIndex >= state.carts.length) {
    state.currentCartIndex = Math.max(0, state.carts.length - 1);
  }
}

async function render() {
  await Promise.all([reloadItems(), reloadCarts()]);
  renderCartPanel();
  renderToolbar();
}

// ============================================================
// CARRINHO (esquerda) — lista única, navegação com setas
// ============================================================
function renderCartPanel() {
  const cart = state.carts[state.currentCartIndex];

  if (!cart) {
    cartPanel.innerHTML = `
      <div class="text-center text-text-dim max-w-xs">
        <div class="text-4xl mb-2">🛒</div>
        <h3 class="text-text text-lg font-bold mb-1.5">Nenhum carrinho ainda</h3>
        <p class="text-[13.5px] leading-relaxed mb-5">Crie o primeiro carrinho pra começar a montar.</p>
        <button id="btn-create-cart" class="bg-accent text-paper font-bold px-5 py-3 rounded-xl active:bg-accent-hover">＋ Novo carrinho</button>
      </div>`;
    document.getElementById('btn-create-cart').addEventListener('click', createCart);
    return;
  }

  const atFirst = state.currentCartIndex === 0;
  const atLast = state.currentCartIndex === state.carts.length - 1;

  cartPanel.innerHTML = `
    <button id="btn-prev-cart" ${atFirst ? 'disabled' : ''} title="Carrinho anterior"
      class="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-surface border border-border text-text text-xl flex items-center justify-center disabled:opacity-25 active:bg-surface-3 z-10">‹</button>
    <button id="btn-next-cart" ${atLast ? 'disabled' : ''} title="Próximo carrinho"
      class="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-surface border border-border text-text text-xl flex items-center justify-center disabled:opacity-25 active:bg-surface-3 z-10">›</button>

    <div class="w-full h-full max-h-full flex flex-col items-center justify-center py-2">
      <div class="w-full max-w-[380px] flex items-center gap-2 mb-3 shrink-0">
        <input id="cart-name-input" value="${escapeHTML(cart.name)}"
          class="flex-1 min-w-0 bg-transparent border-none text-paper text-xl font-bold tracking-tight text-center focus:outline-none focus:bg-surface-2 rounded-lg px-2 py-1">
        <button id="btn-new-cart" title="Novo carrinho"
          class="w-9 h-9 shrink-0 rounded-full bg-surface border border-border text-accent text-lg font-bold flex items-center justify-center active:bg-surface-3">+</button>
      </div>

      <div class="rack-frame flex-1 min-h-0 w-auto max-w-full flex flex-col" style="aspect-ratio: 3 / 7">
        <div class="flex-1 min-h-0 flex flex-col gap-1.5 pb-1.5">
          <div class="rack-slot h-full" style="flex: 1.6 1 0%"></div>
          ${[0, 1, 2].map(() => `
            <div class="flex-1 min-h-0 grid grid-cols-4 gap-1">
              ${[0, 1, 2, 3].map(() => '<div class="rack-slot rack-slot-shelf h-full"></div>').join('')}
            </div>`).join('')}
        </div>
        <div class="rack-wheels shrink-0"><span class="rack-wheel left-1.5"></span><span class="rack-wheel right-1.5"></span></div>
      </div>

      <div class="w-full max-w-[380px] flex justify-end mt-3 shrink-0">
        <button id="btn-delete-cart" title="Excluir carrinho"
          class="w-9 h-9 rounded-full bg-surface border border-border text-danger flex items-center justify-center active:bg-surface-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
  `;

  bindCartPanelEvents(cart);
}

function bindCartPanelEvents(cart) {
  document.getElementById('btn-prev-cart')?.addEventListener('click', () => {
    if (state.currentCartIndex > 0) { state.currentCartIndex--; renderCartPanel(); }
  });
  document.getElementById('btn-next-cart')?.addEventListener('click', () => {
    if (state.currentCartIndex < state.carts.length - 1) { state.currentCartIndex++; renderCartPanel(); }
  });
  document.getElementById('btn-new-cart').addEventListener('click', createCart);
  document.getElementById('btn-delete-cart').addEventListener('click', () => deleteCart(cart));

  const nameInput = document.getElementById('cart-name-input');
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameInput.blur();
    if (e.key === 'Escape') { nameInput.value = cart.name; nameInput.blur(); }
  });
  nameInput.addEventListener('blur', async () => {
    const name = nameInput.value.trim();
    if (!name || name === cart.name) { nameInput.value = cart.name; return; }
    cart.name = name;
    await DB.putCart(cart);
  });
}

async function createCart() {
  const cart = { id: uid(), name: `Carrinho ${state.carts.length + 1}`, itemIds: [], order: state.carts.length };
  await DB.putCart(cart);
  await reloadCarts();
  state.currentCartIndex = state.carts.findIndex(c => c.id === cart.id);
  renderCartPanel();
}

async function deleteCart(cart) {
  if (!confirm(`Excluir "${cart.name}"?`)) return;
  await DB.deleteCart(cart.id);
  await reloadCarts();
  renderCartPanel();
}

// ============================================================
// BIBLIOTECA (direita) — por enquanto só exibição, sem função ao clicar
// ============================================================
function renderToolbar() {
  toolbar.innerHTML = CATEGORIES.map(cat => {
    const items = state.items.filter(i => i.category === cat.id)
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    const cards = items.map(itemCardHTML).join('');
    return `
      <section class="mb-7">
        <div class="flex items-baseline gap-2.5 mb-3">
          <span class="font-mono uppercase tracking-wide text-[12px] font-bold text-bg bg-paper px-2.5 py-1 rounded">${cat.label}</span>
          <span class="text-[13px] text-text-dim">${items.length} ${items.length === 1 ? 'item' : 'itens'}</span>
        </div>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
          ${cards}
          <div class="add-tile aspect-[3/4] border-[1.5px] border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-text-dim cursor-pointer active:bg-surface" data-add-cat="${cat.id}">
            <div class="text-lg font-light leading-none text-accent">+</div>
            <span class="text-[10px] font-semibold">Adicionar</span>
          </div>
        </div>
      </section>`;
  }).join('');

  toolbar.querySelectorAll('.add-tile[data-add-cat]').forEach(el => {
    el.addEventListener('click', () => startUpload(el.dataset.addCat));
  });
  toolbar.querySelectorAll('[data-item-id]').forEach(el => {
    const item = state.items.find(i => i.id === el.dataset.itemId);
    if (item) el.addEventListener('contextmenu', (e) => openItemContextMenu(e, item));
  });
}

function itemCardHTML(item) {
  const badge = item.fileType === 'pdf'
    ? '<span class="absolute top-1 right-1 bg-accent text-paper text-[8px] font-bold tracking-wide px-1 py-0.5 rounded font-mono">PDF</span>'
    : '';
  const sub = item.sigla ? `<div class="text-[9.5px] text-text-dim mt-0.5 truncate">${escapeHTML(item.sigla)}</div>` : '';
  return `
    <div class="relative bg-surface border border-border rounded-lg overflow-hidden flex flex-col" data-item-id="${item.id}">
      <div class="bg-surface-2"><img loading="lazy" class="w-full h-auto block" src="${urlFor(item, 'thumb')}" alt=""></div>
      ${badge}
      <div class="px-1.5 py-1">
        <div class="text-[10.5px] font-semibold leading-tight line-clamp-2">${escapeHTML(item.title)}</div>
        ${sub}
      </div>
    </div>`;
}

// ---- menu de contexto (botão direito / toque longo) sobre uma miniatura ----
let contextMenuEl = null;

function closeContextMenu() {
  document.removeEventListener('pointerdown', onOutsideContextMenuPointerDown, true);
  document.removeEventListener('keydown', onContextMenuKeydown);
  contextMenuEl?.remove();
  contextMenuEl = null;
}

function onOutsideContextMenuPointerDown(e) {
  if (contextMenuEl && !contextMenuEl.contains(e.target)) closeContextMenu();
}

function onContextMenuKeydown(e) {
  if (e.key === 'Escape') closeContextMenu();
}

function openItemContextMenu(e, item) {
  e.preventDefault();
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'fixed z-[150] min-w-[140px] py-1 bg-surface border border-border rounded-lg shadow-[0_6px_20px_rgba(0,0,0,0.4)]';
  menu.innerHTML = `
    <button class="w-full text-left px-3.5 py-2.5 text-[13.5px] text-text active:bg-surface-3" data-action="edit">Editar</button>
    <button class="w-full text-left px-3.5 py-2.5 text-[13.5px] text-danger active:bg-surface-3" data-action="delete">Excluir</button>
  `;
  document.body.appendChild(menu);
  contextMenuEl = menu;

  const maxLeft = window.innerWidth - menu.offsetWidth - 8;
  const maxTop = window.innerHeight - menu.offsetHeight - 8;
  menu.style.left = Math.max(8, Math.min(e.clientX, maxLeft)) + 'px';
  menu.style.top = Math.max(8, Math.min(e.clientY, maxTop)) + 'px';

  menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
    closeContextMenu();
    openEditItemModal(item);
  });
  menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
    closeContextMenu();
    deleteItem(item);
  });

  document.addEventListener('pointerdown', onOutsideContextMenuPointerDown, true);
  document.addEventListener('keydown', onContextMenuKeydown);
}

function openEditItemModal(item) {
  showNewItemForm({
    category: item.category,
    thumbBlob: item.thumbBlob,
    fileBlob: item.fileBlob,
    fileType: item.fileType,
    fileName: item.fileName,
    existingItem: item
  });
}

async function deleteItem(item) {
  if (!confirm(`Excluir "${item.title || item.sigla || 'este item'}" da biblioteca?`)) return;
  await DB.deleteItem(item.id);
  await removeItemFromAllCarts(item.id);
  await reloadItems();
  renderToolbar();
  toast('Item excluído.');
}

async function removeItemFromAllCarts(itemId) {
  for (const cart of state.carts) {
    if (!cart.itemIds?.includes(itemId)) continue;
    cart.itemIds = cart.itemIds.filter(id => id !== itemId);
    await DB.putCart(cart);
  }
}

// ---- upload de novo item pra biblioteca ----
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
    <h2 class="text-[17px] font-bold m-0 mb-4">Processando arquivo…</h2>
    <div class="flex items-center gap-2.5 text-text-dim text-[13px] py-2.5"><div class="spinner"></div> Gerando miniatura da capa…</div>
  `);
  try {
    const { thumbBlob, fileBlob, fileType, fileName } = await processUpload(file);
    const suggestedSigla = fileName.replace(/\.[a-z0-9]+$/i, '');
    showNewItemForm({ category, thumbBlob, fileBlob, fileType, fileName, suggestedSigla });
  } catch (err) {
    console.error(err);
    closeModal();
    toast('Não consegui ler esse arquivo. Tente outra imagem ou PDF.');
  }
});

function showNewItemForm({ category, thumbBlob, fileBlob, fileType, fileName, suggestedSigla, existingItem }) {
  const isEdit = !!existingItem;
  const catLabel = CATEGORIES.find(c => c.id === category)?.label || category;
  const previewUrl = URL.createObjectURL(thumbBlob);

  openModal(`
    <h2 class="text-[17px] font-bold m-0 mb-4">${isEdit ? 'Editar item' : 'Novo item'} · ${catLabel}</h2>
    <div class="flex gap-3.5 mb-1.5">
      <img src="${previewUrl}" class="w-[90px] h-auto self-start rounded-lg border border-border shrink-0">
      <div class="flex-1 min-w-0">
        <div class="mb-3.5">
          <label class="field-label">Título</label>
          <input type="text" id="f-title" class="field-input" placeholder="Ex: Como ter uma família feliz" value="${escapeHTML(existingItem?.title || '')}">
        </div>
        <div class="mb-3.5">
          <label class="field-label">Sigla</label>
          <input type="text" id="f-sigla" class="field-input" placeholder="Ex: fg_2020" value="${escapeHTML(existingItem?.sigla ?? suggestedSigla ?? '')}">
        </div>
      </div>
    </div>
    <div class="flex gap-2.5 mt-4">
      <button class="btn-cancel" id="f-cancel">Cancelar</button>
      <button class="btn-confirm" id="f-save">Salvar</button>
    </div>
  `);

  document.getElementById('f-cancel').addEventListener('click', closeModal);
  document.getElementById('f-save').addEventListener('click', async () => {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { toast('Dê um título pro item.'); return; }
    const sigla = document.getElementById('f-sigla').value.trim();
    const item = {
      id: existingItem?.id || uid(),
      category, title, sigla, fileType, fileName, thumbBlob, fileBlob,
      createdAt: existingItem?.createdAt || Date.now()
    };
    await DB.putItem(item);
    closeModal();
    toast(isEdit ? 'Item atualizado.' : 'Item adicionado à biblioteca.');
    await reloadItems();
    renderToolbar();
  });
}

// ============================================================
// BACKUP — ícone no topo abre modal
// ============================================================
btnBackup.addEventListener('click', openBackupModal);

function openBackupModal() {
  openModal(`
    <h2 class="text-[17px] font-bold m-0 mb-4">Backup</h2>
    <div class="flex gap-3.5 mb-5">
      <div class="flex-1 bg-surface-2 border border-border rounded-lg p-3.5 text-center">
        <div class="text-2xl font-extrabold font-mono text-paper">${state.items.length}</div>
        <div class="text-[11px] text-text-dim uppercase tracking-wide mt-0.5">itens</div>
      </div>
      <div class="flex-1 bg-surface-2 border border-border rounded-lg p-3.5 text-center">
        <div class="text-2xl font-extrabold font-mono text-paper">${state.carts.length}</div>
        <div class="text-[11px] text-text-dim uppercase tracking-wide mt-0.5">carrinhos</div>
      </div>
    </div>

    <div class="mb-5">
      <h3 class="text-[15px] font-bold mb-1.5">Exportar backup</h3>
      <p class="text-text-dim text-[13px] leading-relaxed mb-3">Gera um .zip com toda a biblioteca (imagens e PDFs) e todos os carrinhos.</p>
      <button id="btn-export" class="w-full py-3.5 rounded-lg border-none font-bold text-[15px] bg-accent text-paper active:brightness-90 cursor-pointer">Exportar backup (.zip)</button>
    </div>

    <div>
      <h3 class="text-[15px] font-bold mb-1.5">Importar backup</h3>
      <p class="text-text-dim text-[13px] leading-relaxed mb-3">Restaura a partir de um .zip exportado antes. Itens com o mesmo ID são atualizados.</p>
      <button id="btn-import" class="w-full py-3.5 rounded-lg border border-border font-bold text-[15px] bg-surface-3 text-text active:brightness-90 cursor-pointer">Selecionar arquivo .zip</button>
    </div>
  `);

  document.getElementById('btn-export').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
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
  openModal(`<h2 class="text-[17px] font-bold m-0 mb-4">Importando…</h2><div class="flex items-center gap-2.5 text-text-dim text-[13px] py-2.5"><div class="spinner"></div> Restaurando biblioteca e carrinhos…</div>`);
  try {
    const result = await importBackup(file);
    closeModal();
    toast(`Importado: ${result.items} itens, ${result.carts} carrinhos.`);
    await Promise.all([reloadItems(), reloadCarts()]);
    renderToolbar();
    renderCartPanel();
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
