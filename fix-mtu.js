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

  // Show current MTU
  console.log('=== 1. Current MTU ===');
  let r = await exec(c, 'ip link show eth0 | head -2');
  console.log(r.out);

  // Lower MTU on eth0 to 1400 (safe for most cloud environments)
  console.log('=== 2. Set MTU to 1400 ===');
  r = await exec(c, 'ip link set eth0 mtu 1400 && ip link show eth0 | head -2');
  console.log(r.out);

  // Add TCP MSS clamping (ensures TCP segments never exceed PMTU)
  console.log('=== 3. Add MSS clamping ===');
  r = await exec(c, 'iptables -t mangle -A POSTROUTING -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu 2>&1');
  console.log(r.out || 'OK');

  // Also clamp on FORWARD (for Docker containers)
  r = await exec(c, 'iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu 2>&1');
  console.log(r.out || 'OK');

  // Enable PMTU probing
  r = await exec(c, 'sysctl -w net.ipv4.tcp_mtu_probing=1 2>&1');
  console.log(r.out);

  // Verify settings
  console.log('=== 4. Verify ===');
  r = await exec(c, 'ip link show eth0 | grep mtu');
  console.log('MTU:', r.out.trim());
  r = await exec(c, 'iptables -t mangle -L POSTROUTING -n | grep TCPMSS');
  console.log('MSS clamp:', r.out.trim());
  r = await exec(c, 'sysctl net.ipv4.tcp_mtu_probing');
  console.log(r.out.trim());

  // Test JS download from external IP
  console.log('=== 5. Test JS download ===');
  r = await exec(c, 'curl -s -o /dev/null -w "HTTP %{http_code}, %{size_download} bytes, %{time_total}s" http://85.239.61.164:9000/assets/index-BK2G7pwD.js');
  console.log('External:', r.out);

  // Test API
  r = await exec(c, 'curl -s http://localhost:9000/api/health');
  console.log('API:', r.out);

  // Make settings persistent across reboots
  console.log('=== 6. Make persistent ===');
  r = await exec(c, `cat > /etc/network/if-up.d/mtu-fix << 'SCRIPT'
#!/bin/sh
if [ "$IFACE" = "eth0" ]; then
    ip link set eth0 mtu 1400
fi
SCRIPT
chmod +x /etc/network/if-up.d/mtu-fix 2>/dev/null; echo "MTU script created"
`);
  console.log(r.out);

  // Persist sysctl
  r = await exec(c, 'echo "net.ipv4.tcp_mtu_probing = 1" >> /etc/sysctl.conf && sysctl -p 2>&1 | tail -3');
  console.log(r.out);

  // Persist iptables MSS clamping
  r = await exec(c, 'which iptables-save > /dev/null 2>&1 && iptables-save > /etc/iptables.rules && echo "iptables rules saved" || echo "iptables-save not found"');
  console.log(r.out);

  console.log('\n=== DONE ===');
  c.end();
}

c.connect({ host: '85.239.61.164', port: 22, username: 'root', password: 'z-eYBu9-VofK4w' });
main().catch(e => { console.error(e); c.end(); });
