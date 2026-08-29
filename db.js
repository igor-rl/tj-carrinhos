// db.js — camada de persistência local (IndexedDB). Tudo funciona offline.
const DB_NAME = 'carrinho-publicacoes';
const DB_VERSION = 3;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const tx = e.target.transaction;

      if (!db.objectStoreNames.contains('items')) {
        const items = db.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains('carts')) {
        db.createObjectStore('carts', { keyPath: 'id' });
      }

      // Migração v1 -> v2: "groups" (ocasião com carts aninhados) virou lista única de "carts".
      if (db.objectStoreNames.contains('groups')) {
        const groupsStore = tx.objectStore('groups');
        const cartsStore = tx.objectStore('carts');
        groupsStore.getAll().onsuccess = (ev) => {
          const groups = ev.target.result || [];
          const multi = groups.length > 1;
          let order = 0;
          for (const group of groups) {
            for (const cart of group.carts || []) {
              cartsStore.put({
                id: cart.id,
                name: multi ? `${group.name} · ${cart.name}` : cart.name,
                itemIds: cart.itemIds || [],
                order: order++
              });
            }
          }
          db.deleteObjectStore('groups');
        };
      }

      // Migração v2 -> v3: categoria única "revistas" virou duas: "sentinela" e "despertai".
      if (e.oldVersion < 3 && e.oldVersion > 0) {
        const itemsStore = tx.objectStore('items');
        itemsStore.openCursor().onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (!cursor) return;
          const item = cursor.value;
          if (item.category === 'revistas') {
            item.category = /^despertai/i.test(item.subtitle || '') ? 'despertai' : 'sentinela';
            cursor.update(item);
          }
          cursor.continue();
        };
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

  // ---------- CARTS (lista única de carrinhos) ----------
  async putCart(cart) {
    const store = await tx('carts', 'readwrite');
    await reqToPromise(store.put(cart));
    return cart;
  },
  async deleteCart(id) {
    const store = await tx('carts', 'readwrite');
    return reqToPromise(store.delete(id));
  },
  async allCarts() {
    const store = await tx('carts', 'readonly');
    const all = await reqToPromise(store.getAll());
    return all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  // ---------- utilitário para export/import completo ----------
  async wipeAll() {
    const s1 = await tx('items', 'readwrite');
    await reqToPromise(s1.clear());
    const s2 = await tx('carts', 'readwrite');
    await reqToPromise(s2.clear());
  }
};

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}
