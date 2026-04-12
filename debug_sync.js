import { syncEmbeddings } from './server/syncEmbeddings.js';

console.log('Starting standalone sync test...');
syncEmbeddings().then(() => {
  console.log('Sync test completed.');
  process.exit(0);
}).catch(err => {
  console.error('Sync test failed:', err);
  process.exit(1);
});
