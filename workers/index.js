const CAMUNDA_URL = (process.env.CAMUNDA_URL || 'http://localhost:8080/engine-rest').replace(/\/$/, '');
const MOCK_API_URL = (process.env.MOCK_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const WORKER_ID = process.env.WORKER_ID || `food-order-worker-${process.pid}`;
const TOPICS = ['hitung-ongkir', 'proses-pembayaran', 'cari-driver', 'refund-pembayaran'];
const POLL_DELAY_MS = 3000;
const inFlightTasks = new Map();

function variable(task, name) {
  return task.variables?.[name]?.value;
}

function typed(value, type) {
  return { value, type };
}

async function requestJson(url, options = {}, timeoutMs = 15000) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(timeoutMs),
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status} from ${url}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function complete(task, variables = {}) {
  await requestJson(`${CAMUNDA_URL}/external-task/${task.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ workerId: WORKER_ID, variables }),
  });
}

async function fail(task, error) {
  console.error(`[${task.topicName}] ${error.message}`);
  await requestJson(`${CAMUNDA_URL}/external-task/${task.id}/failure`, {
    method: 'POST',
    body: JSON.stringify({
      workerId: WORKER_ID,
      errorMessage: error.message.slice(0, 500),
      errorDetails: error.stack || '',
      retries: Math.max(0, (task.retries ?? 3) - 1),
      retryTimeout: 10000,
    }),
  });
}

async function processTask(task) {
  try {
    let variables = {};

    if (task.topicName === 'hitung-ongkir') {
      const result = await requestJson(`${MOCK_API_URL}/shipping/calculate`, {
        method: 'POST',
        body: JSON.stringify({
          jumlah: variable(task, 'jumlah'),
          hargaSatuan: variable(task, 'hargaSatuan'),
          alamat: variable(task, 'alamat'),
        }),
      });
      variables = {
        ongkir: typed(result.ongkir, 'Double'),
        totalHarga: typed(result.totalHarga, 'Double'),
      };
    } else if (task.topicName === 'proses-pembayaran') {
      const result = await requestJson(`${MOCK_API_URL}/payments/charge`, {
        method: 'POST',
        body: JSON.stringify({
          namaCustomer: variable(task, 'namaCustomer'),
          amount: variable(task, 'totalHarga'),
        }),
      });
      variables = {
        paymentId: typed(result.paymentId, 'String'),
        paymentStatus: typed(result.paid, 'Boolean'),
      };
    } else if (task.topicName === 'cari-driver') {
      const result = await requestJson(`${MOCK_API_URL}/drivers/search`, {
        method: 'POST',
        body: JSON.stringify({
          alamat: variable(task, 'alamat'),
          restoran: variable(task, 'restoran'),
        }),
      }, 165000);
      variables = { driverFound: typed(result.driverFound, 'Boolean') };
      if (result.driverFound) {
        variables.namaDriver = typed(result.namaDriver, 'String');
        variables.driverId = typed(result.driverId, 'String');
      }
    } else if (task.topicName === 'refund-pembayaran') {
      const result = await requestJson(`${MOCK_API_URL}/payments/${encodeURIComponent(variable(task, 'paymentId'))}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amount: variable(task, 'totalHarga'), reason: 'order_cancelled' }),
      });
      variables = {
        refundId: typed(result.refundId, 'String'),
        refundStatus: typed(result.refunded, 'Boolean'),
      };
    } else {
      throw new Error(`Unsupported topic: ${task.topicName}`);
    }

    await complete(task, variables);
    console.log(`[${task.topicName}] completed task ${task.id}`);
  } catch (error) {
    if (error.status === 404 || error.status === 409) {
      console.log(`[${task.topicName}] task ${task.id} was cancelled or expired before completion`);
      return;
    }
    try {
      await fail(task, error);
    } catch (failureError) {
      console.error(`Could not report failure for ${task.id}: ${failureError.message}`);
    }
  }
}

async function poll() {
  while (true) {
    try {
      const tasks = await requestJson(`${CAMUNDA_URL}/external-task/fetchAndLock`, {
        method: 'POST',
        body: JSON.stringify({
          workerId: WORKER_ID,
          maxTasks: 10,
          asyncResponseTimeout: 10000,
          topics: TOPICS.map((topicName) => ({
            topicName,
            lockDuration: topicName === 'cari-driver' ? 180000 : 60000,
            variables: [
              'namaCustomer', 'restoran', 'menu', 'jumlah', 'hargaSatuan', 'alamat',
              'ongkir', 'totalHarga', 'paymentId', 'diterimaRestoran', 'driverFound',
            ],
          })),
        }),
      });
      for (const task of tasks) {
        if (inFlightTasks.has(task.id)) continue;
        const pending = processTask(task).finally(() => inFlightTasks.delete(task.id));
        inFlightTasks.set(task.id, pending);
      }
    } catch (error) {
      console.error(`Camunda poll failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
    }
  }
}

console.log(`Worker ${WORKER_ID} polling ${TOPICS.join(', ')}`);
poll();
