const nodeVersion = process.versions.node;
const major = parseInt(nodeVersion.split('.')[0], 10);
if (major < 18) {
  console.warn(`[Warning] Node.js version is ${nodeVersion}. Node.js >= 18 is recommended.`);
}
