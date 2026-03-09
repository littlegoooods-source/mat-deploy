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

  // Disable TCP window scaling  
  console.log('=== 1. Disable TCP window scaling ===');
  let r = await exec(c, 'sysctl -w net.ipv4.tcp_window_scaling=0 2>&1');
  console.log(r.out);

  // Reduce initial congestion window  
  r = await exec(c, 'ip route change default via $(ip route show default | awk \'{print $3}\') dev eth0 initcwnd 3 initrwnd 3 2>&1 || echo "route change failed"');
  console.log('Route change:', r.out);

  // Try very low MTU
  r = await exec(c, 'ip link set eth0 mtu 1200 2>&1');
  console.log('MTU set to 1200:', r.out || 'OK');

  // Set small write buffer  
  r = await exec(c, 'sysctl -w net.ipv4.tcp_wmem="4096 8192 16384" 2>&1');
  console.log(r.out);

  // Disable TSO/GSO on eth0
  r = await exec(c, 'ethtool -K eth0 tso off gso off gro off 2>&1 || echo "ethtool failed"');
  console.log('Offload:', r.out);

  // Also try disabling SACK
  r = await exec(c, 'sysctl -w net.ipv4.tcp_sack=0 2>&1');
  console.log(r.out);

  // Quick test
  console.log('=== 2. Quick test ===');
  r = await exec(c, 'curl -s -o /dev/null -w "HTTP %{http_code}, %{size_download} bytes, %{time_total}s" http://85.239.61.164:9000/assets/index-BK2G7pwD.js');
  console.log('External:', r.out);

  c.end();
}

c.connect({ host: '85.239.61.164', port: 22, username: 'root', password: 'z-eYBu9-VofK4w' });
main().catch(e => { console.error(e); c.end(); });
