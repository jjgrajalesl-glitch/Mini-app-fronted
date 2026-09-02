const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Permite peticiones desde cualquier origen
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY || '';
const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || '';
// URL base oficial de Dodo Payments
const DODO_API_URL = process.env.DODO_API_URL || 'https://test.dodopayments.com';

// Panel de prueba visual
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Probador de Facturas - Dodo</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; background: #0f172a; color: #fff; text-align: center; }
        .card { background: #1e293b; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        button { background: #6366f1; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        button:hover { background: #4f46e5; }
        #result { margin-top: 20px; text-align: left; background: #0f172a; padding: 15px; border-radius: 8px; font-size: 13px; overflow-x: auto; }
        a.pay-btn { display: inline-block; margin-top: 15px; background: #22c55e; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Servidor de Facturación Activo 🚀</h2>
        <p>Haz clic para generar una factura de prueba ($199 USD):</p>
        <button onclick="generarFactura()">Generar Factura de Prueba</button>
        <div id="payLinkArea"></div>
        <pre id="result">Esperando interacción...</pre>
      </div>
      <script>
        async function generarFactura() {
          const resBox = document.getElementById('result');
          const payArea = document.getElementById('payLinkArea');
          resBox.innerText = 'Conectando con Dodo Payments...';
          payArea.innerHTML = '';
          try {
            const res = await fetch('/api/crear-factura', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clienteEmail: 'cliente@prueba.com', clienteNombre: 'Cliente Demo', monto: 199 })
            });
            const data = await res.json();
            resBox.innerText = JSON.stringify(data, null, 2);
            if (data.urlPago) {
              payArea.innerHTML = '<a class="pay-btn" href="' + data.urlPago + '" target="_blank">👉 IR A PAGAR AHORA</a>';
            }
          } catch (e) {
            resBox.innerText = 'Error: ' + e.message;
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Endpoint de creación de facturas
app.post('/api/crear-factura', async (req, res) => {
  try {
    const { clienteEmail, clienteNombre, monto, productoId } = req.body;

    if (!clienteEmail || !monto) {
      return res.status(400).json({ error: 'clienteEmail y monto son obligatorios' });
    }

    const payload = {
      billing: {
        city: 'Cali',
        country: 'CO',
        state: 'Valle del Cauca',
        street: 'Calle Principal',
        zipcode: '760001'
      },
      customer: {
        email: clienteEmail,
        name: clienteNombre || 'Cliente B2B'
      },
      product_cart: [
        {
          product_id: productoId || 'pdt_0NmlIexPnNEYXGl5U2Mqj',
          quantity: 1,
          amount: Math.round(monto * 100)
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Respuesta inválida de Dodo (${response.status}): ${rawText.slice(0, 100)}`);
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Error procesando solicitud en Dodo');
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

// Endpoint Webhook
app.post('/webhook/dodo', (req, res) => {
  const signature = req.headers['x-dodo-signature'];

  if (DODO_WEBHOOK_SECRET && signature) {
    const hmac = crypto.createHmac('sha256', DODO_WEBHOOK_SECRET);
    const digest = hmac.update(JSON.stringify(req.body)).digest('hex');
    if (signature !== digest) {
      return res.status(401).send('Firma inválida');
    }
  }

  const evento = req.body;
  if (evento.type === 'payment.succeeded') {
    console.log(`[PAGO CONFIRMADO] USD $${evento.data.amount / 100} de ${evento.data.customer.email}`);
  }

  res.status(200).json({ received: true });
});

module.exports = app;
