export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot activo');

  const body = req.body;
  if (!body || !body.message) return res.status(200).send('OK');

  const chatId = body.message.chat.id;
  const text = body.message.text ? body.message.text.trim() : '';
  const BOT_TOKEN = "8845435445:AAFaH--63UOWdUUsgkU_vsuCV-mglOZnWfA";
  const PROJECT_ID = "saas-miniapps-prod";
  const storeId = `store${chatId}`;

  async function sendMessage(messageText) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: messageText })
    });
  }

  // 1. Comando /start
  if (text === '/start') {
    await sendMessage(
      "🚀 ¡Bienvenido al Creador de Tiendas!\n\n" +
      "📌 Paso 1: Envía el nombre de tu tienda (Ej: Moda VIP).\n\n" +
      "📌 Paso 2: Envía tus productos en este formato:\n" +
      "Nombre, Precio\n\n" +
      "Ejemplo:\n" +
      "Camiseta Negra, 20\n" +
      "Zapatos Deportivos, 50"
    );
    return res.status(200).send('OK');
  }

  // 2. Carga de productos (si el texto contiene comas)
  if (text.includes(',')) {
    const lines = text.split('\n');
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
      `✅ ¡Se agregaron ${addedCount} productos con éxito!\n\n` +
      `🔗 Ver tu tienda:\n${appUrl}`
    );
    return res.status(200).send('OK');
  }

  // 3. Crear/Renombrar tienda y LIMPIAR productos antiguos
  const storeName = text;
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/stores/${storeId}`;

  // Eliminar productos anteriores
  const productsUrl = `${firestoreUrl}/products`;
  const existingProducts = await fetch(productsUrl).then(r => r.json());
  if (existingProducts.documents) {
    for (const doc of existingProducts.documents) {
      await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, { method: 'DELETE' });
    }
  }

  // Guardar nuevo nombre de tienda
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
    `✅ ¡Tienda "${storeName}" activada en blanco!\n\n` +
    `🔗 Tu enlace:\n${appUrl}\n\n` +
    `📦 Ahora envía tus nuevos productos en el chat.`
  );

  return res.status(200).send('OK');
}
