try {
  require.resolve('electron');
} catch (e) {
  console.warn('[Warning] Electron not found in current environment. Please run npm install.');
}
