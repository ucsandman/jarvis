const DB_NAME = 'sidelook';
let dbPromise;
function database() {
  if (!dbPromise) dbPromise = new Promise((resolve,reject) => {
    const req = indexedDB.open(DB_NAME,1);
    req.onupgradeneeded = () => req.result.createObjectStore('project');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Browser storage is unavailable. Keep this page open and download your source.'));
  });
  return dbPromise;
}
export async function loadProject() {
  const db = await database();
  return new Promise((resolve,reject) => {
    const req = db.transaction('project').objectStore('project').get('current');
    req.onsuccess = () => resolve(req.result || { revisions:[], selected:null });
    req.onerror = () => reject(new Error('Could not restore the previous project.'));
  });
}
export async function saveProject(project) {
  const db = await database();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('project','readwrite');
    tx.objectStore('project').put(project,'current');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Browser storage is full or unavailable. Download your source before closing this page.'));
    tx.onabort = tx.onerror;
  });
}
