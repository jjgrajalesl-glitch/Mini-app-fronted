const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// CORS para permitir peticiones desde cualquier origen
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY || '';
const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || '';
const DODO_API_URL = process.env.DODO_API_URL || 'https://test.dodopayments.com';

// AUTO-APROVISIONAMIENTO: Payload estricto según especificación Dodo Payments MoR
async function autoCrearProductoDodo(concepto, monto) {
  const payload = {
    name: concepto || 'Servicio Automatizado Holding',
    description: 'Producto auto-generado por Holding IA',
    price: {
      currency: 'USD',
      discount: 0,
      price: Math.round(monto * 100)
    },
    tax_category: 'digital_goods'
  };

  const res = await fetch(`${DODO_API_URL}/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DODO_API_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify(payload)
  });

  const rawText = await res.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    throw new Error(`Error parsing producto Dodo (${res.status}): ${rawText}`);
  }

  if (!res.ok) {
    throw new Error(`Error creando producto (${res.status}): ${JSON.stringify(data)}`);
  }

  return data.product_id || data.id;
}

// Endpoint Principal de Facturación
app.post('/api/crear-factura', async (req, res) => {
  try {
    const { clienteEmail, clienteNombre, monto, productoId, concepto } = req.body;

    if (!clienteEmail || !monto) {
      return res.status(400).json({ error: 'clienteEmail y monto son obligatorios' });
    }

    let idProductoFinal = productoId;
    if (!idProductoFinal) {
      idProductoFinal = await autoCrearProductoDodo(concepto || 'Factura Automática Holding', monto);
    }

    const payloadCheckout = {
      customer: {
        email: clienteEmail,
        name: clienteNombre || 'Cliente Holding'
      },
      product_cart: [
        {
          product_id: idProductoFinal,
          quantity: 1
        }
      ],
      payment_link: true,
      return_url: 'https://agencyiaos.com'
    };

    const response = await fetch(`${DODO_API_URL}/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(payloadCheckout)
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Error checkout (${response.status}): ${rawText}`);
    }

    if (!response.ok) {
      throw new Error(`Error checkout (${response.status}): ${JSON.stringify(data)}`);
    }

    return res.status(200).json({
      exito: true,
      facturaId: data.payment_id || data.checkout_id,
      urlPago: data.checkout_url || data.payment_link
    });

  } catch (error) {
    return res.status(500).json({ exito: false, error: error.message });
  }
});

// Panel de prueba visual
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Holding Billing Engine</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; background: #0f172a; color: #fff; text-align: center; }
        .card { background: #1e293b; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; }
        button { background: #6366f1; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        #result { margin-top: 20px; text-align: left; background: #0f172a; padding: 15px; border-radius: 8px; font-size: 13px; overflow-x: auto; }
        a.pay-btn { display: inline-block; margin-top: 15px; background: #22c55e; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Servidor Holding Activo 🚀</h2>
        <p>Prueba de Auto-Creación + Checkout (Sin intervención manual):</p>
        <button onclick="generarFactura()">Generar Factura Automática</button>
        <div id="payLinkArea"></div>
        <pre id="result">Esperando orden de la holding...</pre>
      </div>
      <script>
        async function generarFactura() {
          const resBox = document.getElementById('result');
          const payArea = document.getElementById('payLinkArea');
          resBox.innerText = 'Auto-creando producto y checkout en Dodo...';
          payArea.innerHTML = '';
          try {
            const res = await fetch('/api/crear-factura', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clienteEmail: 'cliente_holding@empresa.com',
                clienteNombre: 'Cliente Holding IA',
                concepto: 'Consultoría Holding IA ' + Date.now(),
                monto: 250
              })
            });
            const data = await res.json();
            resBox.innerText = JSON.stringify(data, null, 2);
            if (data.urlPago) {
              payArea.innerHTML = '<a class="pay-btn" href="' + data.urlPago + '" target="_blank">👉 PROBAR ENLACE DE PAGO GENERADO</a>';
            }
          } catch (e) { resBox.innerText = 'Error: ' + e.message; }
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/webhook/dodo', (req, res) => {
  const signature = req.headers['x-dodo-signature'];

  if (DODO_WEBHOOK_SECRET && signature) {
    const hmac = crypto.createHmac('sha256', DODO_WEBHOOK_SECRET);
    const digest = hmac.update(JSON.stringify(req.body)).digest('hex');
    if (signature !== digest) return res.status(401).send('Firma inválida');
  }

  const evento = req.body;
  if (evento.type === 'payment.succeeded') {
    console.log(`[EVENTO AUTO-PROCESADO] Pago confirmado: USD $${evento.data.amount / 100} de ${evento.data.customer.email}`);
  }

  res.status(200).json({ received: true });
});

module.exports = app;
