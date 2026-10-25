const http = require('node:http');

const PORT = Number(process.env.PORT || 3000);
const driverAvailable = (process.env.MOCK_DRIVER_AVAILABLE || 'true').toLowerCase() !== 'false';
const driverSearchDelayMs = Math.max(0, Number(process.env.MOCK_DRIVER_SEARCH_DELAY_MS || 0));
const payments = new Map();
let nextPaymentId = 1;
let nextRefundId = 1;

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      return send(response, 200, { status: 'ok' });
    }

    if (request.method === 'POST' && url.pathname === '/shipping/calculate') {
      const body = await readBody(request);
      const jumlah = Number(body.jumlah);
      const hargaSatuan = Number(body.hargaSatuan);
      if (!Number.isFinite(jumlah) || jumlah < 1 || !Number.isFinite(hargaSatuan) || hargaSatuan < 0) {
        return send(response, 400, { error: 'jumlah and hargaSatuan must be valid non-negative numbers' });
      }
      const ongkir = 10000;
      return send(response, 200, { ongkir, totalHarga: jumlah * hargaSatuan + ongkir });
    }

    if (request.method === 'POST' && url.pathname === '/payments/charge') {
      const body = await readBody(request);
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0) return send(response, 400, { error: 'amount must be a valid non-negative number' });
      const paymentId = `PAY-${nextPaymentId++}`;
      payments.set(paymentId, { amount, status: 'paid' });
      return send(response, 200, { paymentId, paid: true, amount });
    }

    if (request.method === 'POST' && url.pathname === '/drivers/search') {
      if (driverSearchDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, driverSearchDelayMs));
      }
      if (!driverAvailable) return send(response, 200, { driverFound: false });
      return send(response, 200, { driverFound: true, driverId: 'DRV-001', namaDriver: 'Budi Santoso' });
    }

    const refundMatch = url.pathname.match(/^\/payments\/([^/]+)\/refund$/);
    if (request.method === 'POST' && refundMatch) {
      const paymentId = decodeURIComponent(refundMatch[1]);
      const body = await readBody(request);
      const payment = payments.get(paymentId);
      if (!payment) return send(response, 404, { error: `payment ${paymentId} was not found` });
      if (payment.status === 'refunded') return send(response, 200, { refundId: payment.refundId, refunded: true });
      payment.status = 'refunded';
      payment.refundId = `REF-${nextRefundId++}`;
      payment.refundReason = body.reason || 'unspecified';
      return send(response, 200, { refundId: payment.refundId, refunded: true, amount: payment.amount });
    }

    return send(response, 404, { error: 'route not found' });
  } catch (error) {
    return send(response, 500, { error: error.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock API listening on port ${PORT}; driverAvailable=${driverAvailable}; driverSearchDelayMs=${driverSearchDelayMs}`);
});
