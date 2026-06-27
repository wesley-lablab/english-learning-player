import localtunnel from 'localtunnel';

console.log('Starting tunnel...');

const timeout = setTimeout(() => {
  console.log('Timeout: Could not connect to tunnel service');
  process.exit(1);
}, 30000);

(async () => {
  try {
    console.log('Connecting to localtunnel...');
    const tunnel = await localtunnel({ port: 3000, host: 'https://localtunnel.me' });
    clearTimeout(timeout);
    console.log('=== PUBLIC URL ===');
    console.log(tunnel.url);
    console.log('==================');
    
    tunnel.on('request', (info) => {
      console.log('Request:', info.method, info.path);
    });
    
    tunnel.on('close', () => {
      console.log('Tunnel closed');
    });
    
    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err.message);
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error('Failed to create tunnel:', err.message);
    process.exit(1);
  }
})();
