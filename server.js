const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY || '';
const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || '';
const DODO_API_URL = 'https://live.dodopayments.com/v1';

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
          product_id: productoId || 'prod_default',
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error en Dodo API');
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
