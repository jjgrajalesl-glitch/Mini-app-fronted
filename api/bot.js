export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Bot activo');
  }

  const body = req.body;
  if (!body || !body.message) {
    return res.status(200).send('OK');
  }

  const chatId = body.message.chat.id;
  const text = body.message.text ? body.message.text.trim() : '';
  const BOT_TOKEN = "8845435445:AAFaH--63UOWdUUsgkU_vsuCV-mglOZnWfA";

  async function sendMessage(messageText) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'Markdown'
      })
    });
  }

  // Comando /start
  if (text === '/start') {
    await sendMessage("🚀 *¡Bienvenido al Creador de Tiendas!*\n\nEscribe el nombre de tu tienda para activarla en 5 segundos:");
    return res.status(200).send('OK');
  }

  // Procesar creación de tienda
  if (text) {
    const storeName = text;
    const storeId = storeName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Crear tienda en Firestore vía API REST
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/saas-miniapps-prod/databases/(default)/documents/stores/${storeId}`;
    
    await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          name: { stringValue: storeName },
          owner_telegram_id: { stringValue: String(chatId) },
          active: { booleanValue: true }
        }
      })
    });

    // Crear producto inicial de prueba
    const productUrl = `${firestoreUrl}/products`;
    await fetch(productUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          title: { stringValue: 'Producto Demo' },
          price: { doubleValue: 20 },
          image_url: { stringValue: 'https://via.placeholder.com/150' },
          active: { booleanValue: true }
        }
      })
    });

    const appUrl = `https://mini-app-fronted.vercel.app/?store_id=${storeId}`;

    await sendMessage(
      `✅ *¡Tienda "${storeName}" creada con éxito!*\n\n` +
      `🔗 *Tu enlace de Mini App:*\n${appUrl}\n\n` +
      `Copia este enlace y colócalo en tu biografía de Instagram o catálogo.`
    );
  }

  return res.status(200).send('OK');
}
