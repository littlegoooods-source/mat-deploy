const { Client } = require('ssh2');
const c = new Client();

function exec(c, cmd, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ out: 'TIMEOUT', code: -1 }), timeout);
    c.exec(cmd, (err, stream) => {
      if (err) { clearTimeout(timer); return reject(err); }
      let out = '';
      stream.on('data', d => out += d.toString());
      stream.stderr.on('data', d => out += d.toString());
      stream.on('close', (code) => { clearTimeout(timer); resolve({ out, code }); });
    });
  });
}

async function main() {
  await new Promise(resolve => c.on('ready', resolve));
  console.log('Connected');

  // Check docker-proxy userland mode
  console.log('=== 1. Docker daemon config ===');
  let r = await exec(c, 'cat /etc/docker/daemon.json 2>/dev/null || echo "no daemon.json"');
  console.log(r.out);

  // Check if iptables mode is available
  r = await exec(c, 'docker info 2>/dev/null | grep -i proxy');
  console.log('Docker proxy info:', r.out);

  // Stop all containers
  console.log('=== 2. Stopping containers ===');
  r = await exec(c, 'cd /opt/mat-deploy && docker compose down 2>&1');
  console.log(r.out);

  // Disable userland proxy for better networking
  console.log('=== 3. Configure Docker for iptables-based port forwarding ===');
  r = await exec(c, 'echo \'{"userland-proxy": false}\' > /etc/docker/daemon.json && cat /etc/docker/daemon.json');
  console.log(r.out);

  // Restart Docker daemon
  console.log('=== 4. Restarting Docker daemon ===');
  r = await exec(c, 'systemctl restart docker 2>&1');
  console.log(r.out || 'OK');

  await new Promise(r => setTimeout(r, 5000));

  // Verify Docker is running
  r = await exec(c, 'docker info 2>/dev/null | grep -E "Server Version|Storage Driver|Running"');
  console.log('Docker status:', r.out);

  // Clean up old networks/volumes
  console.log('=== 5. Cleanup ===');
  r = await exec(c, 'docker system prune -f 2>&1');
  console.log(r.out);

  // Start containers fresh
  console.log('=== 6. Starting containers ===');
  r = await exec(c, 'cd /opt/mat-deploy && docker compose up -d 2>&1');
  console.log(r.out);

  await new Promise(r => setTimeout(r, 5000));

  // Verify
  console.log('=== 7. Container status ===');
  r = await exec(c, 'docker ps --format "{{.Names}}\\t{{.Status}}\\t{{.Ports}}"');
  console.log(r.out);

  // Remove test file  
  r = await exec(c, 'docker exec mat-frontend rm -f /usr/share/nginx/html/test-400k.bin');

  // Test JS download from localhost
  console.log('=== 8. Test JS file download ===');
  r = await exec(c, 'curl -s -o /dev/null -w "localhost: HTTP %{http_code}, %{size_download} bytes, %{time_total}s" http://localhost:9000/assets/index-BK2G7pwD.js');
  console.log(r.out);
  
  // And from external IP
  r = await exec(c, 'curl -s -o /dev/null -w "external: HTTP %{http_code}, %{size_download} bytes, %{time_total}s" http://85.239.61.164:9000/assets/index-BK2G7pwD.js');
  console.log(r.out);

  // Test all pages
  console.log('=== 9. Test pages ===');
  r = await exec(c, 'curl -s http://localhost:9000/api/health');
  console.log('API health:', r.out);

  console.log('\n=== DONE ===');
  c.end();
}

c.connect({ host: '85.239.61.164', port: 22, username: 'root', password: 'z-eYBu9-VofK4w' });
main().catch(e => { console.error(e); c.end(); });
