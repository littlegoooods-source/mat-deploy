const { Client } = require('ssh2');
const c = new Client();

function exec(c, cmd, timeout = 180000) {
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

  // Force reset and pull
  console.log('=== 1. Update deploy repo ===');
  let r = await exec(c, 'cd /opt/mat-deploy && git fetch origin && git reset --hard origin/master 2>&1');
  console.log(r.out);

  // Verify sendfile off is in the config
  console.log('=== 2. Check nginx config has sendfile off ===');
  r = await exec(c, 'grep sendfile /opt/mat-deploy/nginx/default.conf');
  console.log(r.out);

  // Rebuild frontend with new nginx config
  console.log('=== 3. Rebuild frontend ===');
  r = await exec(c, 'cd /opt/mat-deploy && docker compose build --no-cache frontend 2>&1');
  const lines = r.out.split('\n');
  console.log(lines.slice(-15).join('\n'));

  // Restart
  console.log('=== 4. Restart ===');
  r = await exec(c, 'cd /opt/mat-deploy && docker compose up -d 2>&1');
  console.log(r.out);

  await new Promise(r => setTimeout(r, 3000));

  // Verify inside container
  console.log('=== 5. Verify nginx config in container ===');
  r = await exec(c, 'docker exec mat-frontend grep sendfile /etc/nginx/conf.d/default.conf');
  console.log(r.out);

  // Test JS file download with time
  console.log('=== 6. Test JS download ===');
  r = await exec(c, 'curl -s -o /dev/null -w "HTTP %{http_code}, %{size_download} bytes, %{time_total}s" http://localhost:9000/assets/index-BK2G7pwD.js');
  console.log(r.out);

  console.log('\n=== DONE ===');
  c.end();
}

c.connect({ host: '85.239.61.164', port: 22, username: 'root', password: 'z-eYBu9-VofK4w' });
main().catch(e => { console.error(e); c.end(); });
