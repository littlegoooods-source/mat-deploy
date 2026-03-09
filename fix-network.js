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

  // First, check TCP settings
  console.log('=== 1. TCP settings ===');
  let r = await exec(c, 'sysctl net.ipv4.tcp_window_scaling net.ipv4.tcp_rmem net.ipv4.tcp_wmem net.ipv4.tcp_mtu_probing net.core.rmem_default net.core.rmem_max 2>/dev/null');
  console.log(r.out);

  // Check if there's a checksum offload issue (common in VMs)
  console.log('=== 2. NIC offload settings ===');
  r = await exec(c, 'ethtool -k eth0 2>/dev/null | grep -E "checksum|segmentation|scatter|generic" || echo "ethtool not available"');
  console.log(r.out);

  // Try disabling GRO/GSO/TSO which can cause issues in VMs
  console.log('=== 3. Disable offloading on veth interfaces ===');
  // Get the veth interface for the frontend container
  r = await exec(c, 'for iface in $(ls /sys/class/net/ | grep veth); do echo "Fixing $iface"; ethtool -K $iface tx off rx off sg off tso off gso off gro off 2>/dev/null || echo "  ethtool not available for $iface"; done');
  console.log(r.out);

  // Also try on the bridge
  r = await exec(c, 'for iface in $(ls /sys/class/net/ | grep br-); do echo "Fixing $iface"; ethtool -K $iface tx off rx off sg off tso off gso off gro off 2>/dev/null || echo "  ethtool not available for $iface"; done');
  console.log(r.out);

  // Also on eth0
  r = await exec(c, 'ethtool -K eth0 tx-checksum-ip-generic off gso off tso off gro off 2>/dev/null; echo done');
  console.log(r.out);

  // Test again
  console.log('=== 4. Test JS download from external ===');
  r = await exec(c, 'curl -s -o /dev/null -w "HTTP %{http_code}, %{size_download} bytes, %{time_total}s" http://85.239.61.164:9000/assets/index-BK2G7pwD.js');
  console.log('External:', r.out);

  c.end();
}

c.connect({ host: '85.239.61.164', port: 22, username: 'root', password: 'z-eYBu9-VofK4w' });
main().catch(e => { console.error(e); c.end(); });
