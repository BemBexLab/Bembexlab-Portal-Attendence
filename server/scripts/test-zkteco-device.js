require('dotenv').config();

const ZKLib = require('node-zklib');

const ip = process.env.ZKTECO_TEST_IP || process.argv[2] || '192.168.10.197';
const port = Number(process.env.ZKTECO_TEST_PORT || process.argv[3] || 4370);
const timeout = Number(process.env.ZKTECO_TIMEOUT_MS || 10000);
const localPort = Number(process.env.ZKTECO_LOCAL_PORT || 0);

function withTimeout(operation, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeout}ms`));
    }, timeout);

    operation()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function testProtocol(protocol) {
  const client = new ZKLib(ip, port, timeout, localPort);
  const transport = protocol === 'tcp' ? client.zklibTcp : client.zklibUdp;

  try {
    await withTimeout(async () => {
      await transport.createSocket();
      await transport.connect();
    }, protocol.toUpperCase());
    client.connectionType = protocol;
    const info = await client.getInfo();
    const attendances = await client.getAttendances();

    console.log(`${protocol.toUpperCase()} ok`);
    console.log(`info=${JSON.stringify(info)}`);
    console.log(`attendanceRecords=${attendances.data.length}`);
    return true;
  } catch (error) {
    console.log(`${protocol.toUpperCase()} failed: ${error.message}`);
    return false;
  } finally {
    try {
      await client.disconnect();
    } catch {
      // Ignore cleanup failures.
    }
    try {
      transport.socket && transport.socket.removeAllListeners && transport.socket.removeAllListeners();
      transport.socket && transport.socket.destroy && transport.socket.destroy();
      transport.socket && transport.socket.close && transport.socket.close();
    } catch {
      // Ignore forced cleanup failures.
    }
  }
}

async function main() {
  console.log(`Testing ZKTeco device ${ip}:${port}`);
  console.log(`timeout=${timeout} localPort=${localPort}`);

  const tcp = await testProtocol('tcp');
  const udp = await testProtocol('udp');

  if (!tcp && !udp) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(process.exitCode || 0), 50);
});
