// Redirect to Node.js Sriramik EduPortal server
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Sriramik EduPortal Node.js Server...');

// Start the Node.js server
const nodeServer = spawn('node', [path.join(__dirname, '..', 'index.cjs')], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '5000' }
});

nodeServer.on('error', (err: any) => {
  console.error('Failed to start Node.js server:', err);
});

nodeServer.on('close', (code: number | null) => {
  console.log(`Node.js server exited with code ${code}`);
});

// Keep this process alive
process.on('SIGTERM', () => {
  nodeServer.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  nodeServer.kill('SIGINT');
  process.exit(0);
});
