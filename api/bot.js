export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot activo');

  const body = req.body;
  if (!body || !body.message) return res.status(200).send('OK');

  const chatId = body.message.chat.id;
  const text = body.message.text ? body.message.text.trim() : '';
  const BOT_TOKEN = "8845435445:AAFaH--63UOWdUUsgkU_vsuCV-mglOZnWfA";
  const PROJECT_ID = "saas-miniapps-prod";

  async function sendMessage(messageText) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: messageText, parse_mode: 'Markdown' })
    });
  }

  // 1. Comando /start
  if (text === '/start') {
    await sendMessage(
      "🚀 *¡Bienvenido a tu Gestor de Mini App!*\n\n" +
      "📌 *Paso 1:* Envía el nombre de tu tienda (Ej: `Moda Express`).\n\n" +
      "📌 *Paso 2:* Para agregar productos, envíalos en este formato (uno por línea):\n" +
      "`Nombre del Producto, Precio`\n\n" +
      "Ejemplo:\n" +
      "`Vestido Elegante, 45`\n" +
      "`Zapatos de Cuero, 80`\n" +
      "`Bolso Negro, 35`"
    );
    return res.status(200).send('OK');
  }

  // 2. Si el texto contiene comas, se procesa como carga de productos
  if (text.includes(',')) {
    const lines = text.split('\n');
    const storeId = `store-${chatId}`; // Asocia los productos al ID del usuario
    let addedCount = 0;

    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 2) {
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
          addedCount++;
        }
      }
    }

    const appUrl = `https://mini-app-fronted.vercel.app/?store_id=${storeId}`;
    await sendMessage(
      `✅ *¡Se agregaron ${addedCount} productos con éxito!*\n\n` +
      `🔗 *Ver tu tienda actualizada:*\n${appUrl}`
    );
    return res.status(200).send('OK');
  }

  // 3. Si no tiene comas, se asume que es la creación del nombre de la tienda
  const storeName = text;
  const storeId = `store-${chatId}`;
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/stores/${storeId}`;

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

  const appUrl = `https://mini-app-fronted.vercel.app/?store_id=${storeId}`;
  await sendMessage(
    `✅ *¡Tienda "${storeName}" activada!*\n\n` +
    `🔗 *Tu enlace:*\n${appUrl}\n\n` +
    `📦 *Ahora envía tus productos:* Escribe en el chat la lista de productos separados por coma.\n\n` +
    `Ejemplo:\n` +
    "`Camiseta Azul, 25`\n`Pantalón Jean, 50`"
  );

  return res.status(200).send('OK');
}
