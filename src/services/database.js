import { openDB } from 'idb';

const DB_NAME = 'invoice-quotation-builder';
const DB_VERSION = 1;
let dbPromise;

export function getDatabase() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('documents')) {
          const store = db.createObjectStore('documents', { keyPath: 'id' });
          store.createIndex('type', 'type');
          store.createIndex('updatedAt', 'updatedAt');
          store.createIndex('number', 'number');
          store.createIndex('businessProfileId', 'businessProfileId');
        }
        if (!db.objectStoreNames.contains('customers')) {
          const store = db.createObjectStore('customers', { keyPath: 'id' });
          store.createIndex('name', 'name');
          store.createIndex('email', 'email');
        }
        if (!db.objectStoreNames.contains('products')) {
          const store = db.createObjectStore('products', { keyPath: 'id' });
          store.createIndex('name', 'name');
          store.createIndex('active', 'active');
        }
        if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('payments')) {
          const store = db.createObjectStore('payments', { keyPath: 'id' });
          store.createIndex('invoiceId', 'invoiceId');
          store.createIndex('date', 'date');
          store.createIndex('reference', 'reference');
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('activity')) {
          const store = db.createObjectStore('activity', { keyPath: 'id' });
          store.createIndex('date', 'date');
        }
      },
    });
  }
  return dbPromise;
}

export async function getAll(store) { return (await getDatabase()).getAll(store); }
export async function getById(store, id) { return (await getDatabase()).get(store, id); }
export async function put(store, value) { return (await getDatabase()).put(store, value); }
export async function remove(store, id) { return (await getDatabase()).delete(store, id); }
export async function clearStore(store) { return (await getDatabase()).clear(store); }
export async function getSettings() { return (await getById('settings', 'main')) || null; }

export async function addActivity(action, description, documentId = '') {
  const activity = { id: crypto.randomUUID(), action, description, documentId, date: new Date().toISOString() };
  await put('activity', activity);
  return activity;
}

export async function exportWorkspace() {
  const [documents, customers, products, profiles, payments, settings, activity] = await Promise.all([
    getAll('documents'), getAll('customers'), getAll('products'), getAll('profiles'), getAll('payments'), getAll('settings'), getAll('activity'),
  ]);
  return {
    application: 'Invoice & Quotation Builder', schemaVersion: 1, exportedAt: new Date().toISOString(),
    data: { documents, customers, products, profiles, payments, settings, activity },
  };
}

export function validateWorkspaceBackup(input) {
  if (!input || typeof input !== 'object' || input.application !== 'Invoice & Quotation Builder' || input.schemaVersion !== 1 || !input.data || typeof input.data !== 'object') {
    throw new Error('This file is not a supported Invoice & Quotation Builder backup.');
  }
  const stores = ['documents', 'customers', 'products', 'profiles', 'payments', 'settings', 'activity'];
  for (const key of stores) {
    if (input.data[key] !== undefined && !Array.isArray(input.data[key])) throw new Error(`The backup contains invalid ${key} data.`);
    const rows = input.data[key] || [];
    const ids = new Set();
    for (const row of rows) {
      if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id) throw new Error(`A ${key} record is missing a valid ID.`);
      if (ids.has(row.id)) throw new Error(`The backup contains duplicate IDs in ${key}.`);
      ids.add(row.id);
    }
  }
  return input;
}

export async function importWorkspace(input, mode = 'merge') {
  const backup = validateWorkspaceBackup(input);
  const db = await getDatabase();
  const stores = ['documents', 'customers', 'products', 'profiles', 'payments', 'settings', 'activity'];
  const tx = db.transaction(stores, 'readwrite');
  try {
    for (const storeName of stores) {
      const store = tx.objectStore(storeName);
      if (mode === 'replace') await store.clear();
      const rows = backup.data[storeName] || [];
      for (const row of rows) await store.put(row);
    }
    await tx.done;
  } catch (error) {
    tx.abort();
    throw error;
  }
  return backup.data;
}

export async function clearWorkspace() {
  const stores = ['documents', 'customers', 'products', 'profiles', 'payments', 'settings', 'activity'];
  const db = await getDatabase();
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map((store) => tx.objectStore(store).clear()));
  await tx.done;
}
