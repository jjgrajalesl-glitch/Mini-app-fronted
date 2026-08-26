export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot activo');

  const body = req.body;
  const BOT_TOKEN = "8845435445:AAFaH--63UOWdUUsgkU_vsuCV-mglOZnWfA";
  const PROJECT_ID = "saas-miniapps-prod";

  async function sendMessage(chatId, text, keyboard = null) {
    const payload = { chat_id: chatId, text: text, parse_mode: 'Markdown' };
    if (keyboard) payload.reply_markup = keyboard;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async function answerCallbackQuery(callbackQueryId, text) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text })
    });
  }

  // 1. Manejo de Botones Callback (Marcar Despachado / Entregado)
  if (body && body.callback_query) {
    const callback = body.callback_query;
    const chatId = callback.message.chat.id;
    const data = callback.data;

    if (data.startsWith('despachado_')) {
      const orderId = data.replace('despachado_', '');
      await answerCallbackQuery(callback.id, '¡Pedido marcado como despachado!');
      await sendMessage(
        chatId,
        `📦 *Estado del Pedido #${orderId}:* EN CAMINO 🚚\nRecuerda enviar el número de guía a tu cliente.`
      );
    } else if (data.startsWith('entregado_')) {
      const orderId = data.replace('entregado_', '');
      await answerCallbackQuery(callback.id, '¡Pedido completado!');
      await sendMessage(
        chatId,
        `✅ *Estado del Pedido #${orderId}:* ENTREGADO Y COMPLETADO 🎉`
      );
    }
    return res.status(200).send('OK');
  }

  if (!body || !body.message) return res.status(200).send('OK');

  const message = body.message;
  const chatId = message.chat.id;
  const clientId = `CLI-${chatId}`;
  const storeId = `store-${chatId}`;

  // 2. Recepción de Pedido de Compra enviada desde la Mini App
  if (message.web_app_data && message.web_app_data.data) {
    try {
      const order = JSON.parse(message.web_app_data.data);
      const orderNum = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

      // Guardar Pedido en Firestore
      const orderUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/stores/${storeId}/orders`;
      await fetch(orderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            order_id: { stringValue: orderNum },
            customer: { stringValue: order.user_name || 'Cliente' },
            items: { stringValue: order.items },
            total: { doubleValue: order.total },
            status: { stringValue: 'PENDIENTE' },
            created_at: { stringValue: new Date().toISOString() }
          }
        })
      });

      // Notificación al Vendedor con Botones Interactivos
      const keyboard = {
        inline_keyboard: [
          [
            { text: "📦 Marcar Despachado", callback_data: `despachado_${orderNum}` },
            { text: "✅ Marcar Entregado", callback_data: `entregado_${orderNum}` }
          ]
        ]
      };

      await sendMessage(
        chatId,
        `🚨 *¡NUEVA VENTA RECIBIDA!*\n\n` +
        `📦 *Pedido:* #${orderNum}\n` +
        `👤 *Cliente:* ${order.user_name || 'Cliente'}\n` +
        `🛒 *Items:* ${order.items}\n` +
        `💰 *Total:* $${order.total} USD\n\n` +
        `🔴 *Estado:* PENDIENTE DE DESPACHO`,
        keyboard
      );
    } catch (err) {
      console.error(err);
    }
    return res.status(200).send('OK');
  }

  const text = message.text ? message.text.trim() : '';

  // 3. Comando /start
  if (text === '/start') {
    const userUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/clients/${clientId}`;
    
    await fetch(userUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          telegram_id: { stringValue: String(chatId) },
          plan: { stringValue: 'Free' },
          created_at: { stringValue: new Date().toISOString() }
        }
      })
    });

    await sendMessage(
      chatId,
      `🆔 *Tu ID Único de Cliente:* \`${clientId}\`\n\n` +
      `🚀 *Panel de Administración activo*\n\n` +
      `📌 *Paso 1:* Envía el nombre de tu tienda (Ej: \`Moda VIP\`)\n` +
      `📌 *Paso 2:* Envía tu producto: \`Nombre, Precio\``
    );
    return res.status(200).send('OK');
  }

  // 4. Carga de Producto (Nombre, Precio)
  if (text.includes(',')) {
    const parts = text.split(',');
    const title = parts[0].trim();
    const price = parseFloat(parts[1].trim()) || 0;

    if (title && price > 0) {
      const productUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/stores/${storeId}/products`;
      await fetch(productUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            title: { stringValue: title },
            price: { doubleValue: price },
            image_url: { stringValue: 'https://via.placeholder.com/150' },
            active: { booleanValue: true }
          }
        })
      });

      const appUrl = `https://mini-app-fronted.vercel.app/?store_id=${storeId}`;
      await sendMessage(
        chatId,
        `✅ *Producto agregado:* ${title} ($${price} USD)\n\n` +
        `🔗 *Ver Tienda:* ${appUrl}`
      );
    }
    return res.status(200).send('OK');
  }

  // 5. Crear/Renombrar Tienda
  if (text) {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/stores/${storeId}`;
    await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          name: { stringValue: text },
          client_id: { stringValue: clientId },
          active: { booleanValue: true }
        }
      })
    });

    const appUrl = `https://mini-app-fronted.vercel.app/?store_id=${storeId}`;
    await sendMessage(
      chatId,
      `✅ *Tienda "${text}" vinculada a tu ID \`${clientId}\`*\n\n` +
      `🔗 *Enlace:* ${appUrl}\n\n` +
      `📦 Envía tu producto en formato: \`Nombre, Precio\``
    );
  }

  return res.status(200).send('OK');
}
