const { Client } = require('ssh2');
const c = new Client();

function exec(c, cmd, timeout = 30000) {
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

  // Check MTU on all interfaces
  console.log('=== 1. MTU on all interfaces ===');
  let r = await exec(c, 'ip link show | grep -E "mtu|state"');
  console.log(r.out);

  // Check Docker network MTU
  console.log('=== 2. Docker network inspect ===');
  r = await exec(c, 'docker network inspect bridge --format "{{json .Options}}"');
  console.log(r.out);

  // Check if there's a specific Docker network for compose
  r = await exec(c, 'docker network ls');
  console.log(r.out);

  r = await exec(c, 'docker network inspect mat-deploy_default --format "{{json .Options}}" 2>/dev/null || echo "not found"');
  console.log('mat-deploy_default:', r.out);

  // Check the container's network interface
  console.log('=== 3. Container network ===');
  r = await exec(c, 'docker exec mat-frontend ip link show 2>/dev/null || docker exec mat-frontend cat /sys/class/net/eth0/mtu 2>/dev/null || echo "no ip command"');
  console.log(r.out);

  // Check iptables rules for FORWARD chain
  console.log('=== 4. iptables FORWARD chain ===');
  r = await exec(c, 'iptables -L FORWARD -n | head -20');
  console.log(r.out);

  // Check conntrack
  console.log('=== 5. conntrack ===');
  r = await exec(c, 'cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null');
  console.log('conntrack count:', r.out);
  r = await exec(c, 'cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null');
  console.log('conntrack max:', r.out);

  // Try to create a test file and download it
  console.log('=== 6. Test with dd-generated file ===');
  r = await exec(c, 'docker exec mat-frontend sh -c "dd if=/dev/urandom of=/usr/share/nginx/html/test-400k.bin bs=1k count=400 2>/dev/null && ls -la /usr/share/nginx/html/test-400k.bin"');
  console.log(r.out);
  
  // Download test file from localhost
  r = await exec(c, 'curl -s -o /dev/null -w "HTTP %{http_code}, %{size_download} bytes, %{time_total}s" http://localhost:9000/test-400k.bin');
  console.log('Localhost download:', r.out);

  // Try downloading through the host's external IP
  r = await exec(c, 'curl -s -o /dev/null -w "HTTP %{http_code}, %{size_download} bytes, %{time_total}s" http://85.239.61.164:9000/test-400k.bin');
  console.log('External IP download:', r.out);

  // Check for any rate limiting
  console.log('=== 7. Traffic control ===');
  r = await exec(c, 'tc qdisc show 2>/dev/null');
  console.log(r.out);

  // Check dmesg for network errors
  console.log('=== 8. Recent kernel network messages ===');
  r = await exec(c, 'dmesg | grep -iE "nf_conntrack|drop|reject|bridge|docker" | tail -10');
  console.log(r.out || 'none');

  c.end();
}

c.connect({ host: '85.239.61.164', port: 22, username: 'root', password: 'z-eYBu9-VofK4w' });
main().catch(e => { console.error(e); c.end(); });
