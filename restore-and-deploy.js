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

  // === STEP 1: Restore all server settings ===
  console.log('=== 1. Restore network settings ===');

  // Restore MTU to 1500
  let r = await exec(c, 'ip link set eth0 mtu 1500');
  console.log('MTU restored to 1500:', r.out || 'OK');

  // Restore TCP settings
  r = await exec(c, 'sysctl -w net.ipv4.tcp_window_scaling=1 net.ipv4.tcp_sack=1 net.ipv4.tcp_mtu_probing=0 net.ipv4.tcp_wmem="4096 16384 4194304" net.ipv4.tcp_rmem="4096 131072 6291456" 2>&1');
  console.log(r.out);

  // Remove MSS clamping iptables rules
  r = await exec(c, 'iptables -t mangle -F POSTROUTING 2>/dev/null; iptables -t mangle -F FORWARD 2>/dev/null; echo "iptables mangle flushed"');
  console.log(r.out);

  // Remove the MTU script I created
  r = await exec(c, 'rm -f /etc/network/if-up.d/mtu-fix');
  console.log('MTU script removed');

  // Remove tcp_mtu_probing from sysctl.conf
  r = await exec(c, 'sed -i "/tcp_mtu_probing/d" /etc/sysctl.conf 2>/dev/null; echo "sysctl.conf cleaned"');
  console.log(r.out);

  // Restore NIC offload settings
  r = await exec(c, 'ethtool -K eth0 tso on gso on gro on tx-checksum-ip-generic on 2>/dev/null; echo "offload restored"');
  console.log(r.out);

  // === STEP 2: Restore Docker daemon config ===
  console.log('\n=== 2. Restore Docker daemon config ===');
  r = await exec(c, 'echo \'{ "registry-mirrors" : [ "https://dockerhub.timeweb.cloud" ] }\' > /etc/docker/daemon.json && cat /etc/docker/daemon.json');
  console.log(r.out);

  // === STEP 3: Stop containers and restart Docker ===
  console.log('\n=== 3. Restart Docker ===');
  r = await exec(c, 'cd /opt/mat-deploy && docker compose down 2>&1');
  console.log(r.out);

  r = await exec(c, 'systemctl restart docker 2>&1');
  console.log('Docker restarted:', r.out || 'OK');

  await new Promise(r => setTimeout(r, 5000));

  r = await exec(c, 'docker info 2>/dev/null | grep "Server Version"');
  console.log(r.out);

  // === STEP 4: Update deploy repo to original state ===
  console.log('\n=== 4. Update deploy repo ===');
  r = await exec(c, 'cd /opt/mat-deploy && git fetch origin && git reset --hard origin/master 2>&1');
  console.log(r.out);

  // Verify nginx config is the original
  r = await exec(c, 'cat /opt/mat-deploy/nginx/default.conf');
  console.log('=== Nginx config (should be original): ===');
  console.log(r.out);

  // === STEP 5: Full rebuild ===
  console.log('\n=== 5. Full rebuild (no cache) ===');
  r = await exec(c, 'cd /opt/mat-deploy && docker compose build --no-cache 2>&1');
  const lines = r.out.split('\n');
  console.log(lines.slice(-20).join('\n'));

  // === STEP 6: Start containers ===
  console.log('\n=== 6. Start containers ===');
  r = await exec(c, 'cd /opt/mat-deploy && docker compose up -d 2>&1');
  console.log(r.out);

  await new Promise(r => setTimeout(r, 5000));

  // === STEP 7: Verify ===
  console.log('\n=== 7. Verify ===');
  r = await exec(c, 'docker ps --format "{{.Names}}\\t{{.Status}}\\t{{.Ports}}"');
  console.log(r.out);

  r = await exec(c, 'curl -s http://localhost:9000/login | grep -o "index-[a-zA-Z0-9]*\\.js"');
  console.log('JS bundle:', r.out.trim());

  r = await exec(c, 'curl -s http://localhost:9000/api/health');
  console.log('API:', r.out);

  // Verify MTU
  r = await exec(c, 'ip link show eth0 | grep mtu');
  console.log('MTU:', r.out.trim());

  // Verify TCP settings
  r = await exec(c, 'sysctl net.ipv4.tcp_window_scaling net.ipv4.tcp_sack net.ipv4.tcp_mtu_probing');
  console.log(r.out);

  console.log('\n=== RESTORE AND DEPLOY COMPLETE ===');
  c.end();
}

c.connect({ host: '85.239.61.164', port: 22, username: 'root', password: 'z-eYBu9-VofK4w' });
main().catch(e => { console.error(e); c.end(); });
