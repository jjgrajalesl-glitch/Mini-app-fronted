export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot activo');

  const body = req.body;
  if (!body || !body.message) return res.status(200).send('OK');

  const chatId = body.message.chat.id;
  const text = body.message.text ? body.message.text.trim() : '';
  const BOT_TOKEN = "8845435445:AAFaH--63UOWdUUsgkU_vsuCV-mglOZnWfA";
  const PROJECT_ID = "saas-miniapps-prod";
  
  // ID Permanente de Cliente y Sucursal Principal
  const clientId = `CLI-${chatId}`;
  const storeId = `store-${chatId}`;

  async function sendMessage(messageText, keyboard = null) {
    const payload = { chat_id: chatId, text: messageText, parse_mode: 'Markdown' };
    if (keyboard) payload.reply_markup = keyboard;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  // 1. Comando /start - Registro Único
  if (text === '/start') {
    const userUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/clients/${clientId}`;
    
    // Crear/Verificar cliente permanente
    await fetch(userUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          telegram_id: { stringValue: String(chatId) },
          plan: { stringValue: 'Free' },
          max_products: { integerValue: 1 },
          created_at: { stringValue: new Date().toISOString() }
        }
      })
    });

    await sendMessage(
      `🆔 *Tu ID Único de Cliente:* \`${clientId}\`\n\n` +
      `🚀 *Bienvenido a tu Panel de Control*\n\n` +
      `📌 *Paso 1:* Envía el nombre de tu tienda (Ej: \`Moda VIP\`)\n` +
      `📌 *Paso 2:* Carga tu producto enviado: \`Nombre, Precio\``
    );
    return res.status(200).send('OK');
  }

  // 2. Carga de Productos
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
        `✅ *Producto agregado:* ${title} ($${price})\n\n` +
        `🔗 *Ver Tienda:* ${appUrl}`
      );
    }
    return res.status(200).send('OK');
  }

  // 3. Definir Nombre de Tienda
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
      `✅ *Tienda "${text}" vinculada a tu ID \`${clientId}\`*\n\n` +
      `🔗 *Enlace:* ${appUrl}\n\n` +
      `📦 Envía tu producto en formato: \`Nombre, Precio\``
    );
  }

  return res.status(200).send('OK');
}
