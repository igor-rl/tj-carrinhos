// db.js — camada de persistência local (IndexedDB). Tudo funciona offline.
const DB_NAME = 'carrinho-publicacoes';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('items')) {
        const items = db.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains('groups')) {
        db.createObjectStore('groups', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const DB = {
  // ---------- ITEMS (banners, folhetos, brochuras, convites, livros, revistas) ----------
  async putItem(item) {
    const store = await tx('items', 'readwrite');
    await reqToPromise(store.put(item));
    return item;
  },
  async getItem(id) {
    const store = await tx('items', 'readonly');
    return reqToPromise(store.get(id));
  },
  async deleteItem(id) {
    const store = await tx('items', 'readwrite');
    return reqToPromise(store.delete(id));
  },
  async allItems() {
    const store = await tx('items', 'readonly');
    return reqToPromise(store.getAll());
  },
  async itemsByCategory(category) {
    const store = await tx('items', 'readonly');
    const idx = store.index('category');
    return reqToPromise(idx.getAll(category));
  },

  // ---------- GROUPS (ocasiões, cada uma com N carrinhos) ----------
  async putGroup(group) {
    const store = await tx('groups', 'readwrite');
    await reqToPromise(store.put(group));
    return group;
  },
  async deleteGroup(id) {
    const store = await tx('groups', 'readwrite');
    return reqToPromise(store.delete(id));
  },
  async allGroups() {
    const store = await tx('groups', 'readonly');
    const all = await reqToPromise(store.getAll());
    return all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  // ---------- utilitário para export/import completo ----------
  async wipeAll() {
    const s1 = await tx('items', 'readwrite');
    await reqToPromise(s1.clear());
    const s2 = await tx('groups', 'readwrite');
    await reqToPromise(s2.clear());
  }
};

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}
