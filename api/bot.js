export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot activo');

  const body = req.body;
  const BOT_TOKEN = process.env.BOT_TOKEN;
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

  async function answerCallback(callbackQueryId, text = '') {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text })
    });
  }

  // Funciones de Base de Datos (Firestore REST)
  async function getClient(clientId) {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/clients/${clientId}`);
    if (res.status === 200) {
      const data = await res.json();
      const fields = data.fields || {};
      return {
        step: fields.step ? fields.step.stringValue : null,
        owner_name: fields.owner_name ? fields.owner_name.stringValue : '',
        person_type: fields.person_type ? fields.person_type.stringValue : '',
        email: fields.email ? fields.email.stringValue : '',
        phone: fields.phone ? fields.phone.stringValue : ''
      };
    }
    return null;
  }

  async function updateClient(clientId, fieldsData) {
    const formattedFields = {};
    for (const key in fieldsData) {
      formattedFields[key] = { stringValue: String(fieldsData[key]) };
    }
    await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: formattedFields })
    });
  }

  // 1. MANEJO DE BOTONES INTERACTIVOS (CALLBACKS)
  if (body && body.callback_query) {
    const callback = body.callback_query;
    const chatId = callback.message.chat.id;
    const clientId = `CLI-${chatId}`;
    const data = callback.data;

    await answerCallback(callback.id);

    if (data === 'btn_info') {
      const keyboard = {
        inline_keyboard: [[{ text: "👤 Crear Usuario y Registrarme", callback_data: "btn_start_reg" }]]
      };
      await sendMessage(
        chatId,
        `ℹ️ *Información del Servicio SaaS Mini Apps*\n\n` +
        `Crea tu tienda virtual dentro de Telegram en menos de 2 minutos.\n` +
        `• Catálogo interactivo de productos.\n` +
        `• Alertas instantáneas de pedidos recibidos.\n` +
        `• Control de estados de despacho y entregas.\n\n` +
        `Haz clic abajo para crear tu usuario.`,
        keyboard
      );
      return res.status(200).send('OK');
    }

    if (data === 'btn_start_reg') {
      await updateClient(clientId, { step: 'AWAITING_NAME', telegram_id: chatId });
      await sendMessage(chatId, `📝 *Registro de Propietario*\n\nPor favor envía tu *Nombre Completo*:`);
      return res.status(200).send('OK');
    }

    if (data === 'type_pn' || data === 'type_pj') {
      const pType = data === 'type_pn' ? 'Persona Natural (PN)' : 'Persona Jurídica (PJ)';
      await updateClient(clientId, { person_type: pType, step: 'AWAITING_EMAIL' });
      await sendMessage(chatId, `✅ Registrado: *${pType}*\n\n✉️ Ahora envía tu *Correo Electrónico*:`);
      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  }

  if (!body || !body.message) return res.status(200).send('OK');

  const message = body.message;
  const chatId = message.chat.id;
  const clientId = `CLI-${chatId}`;
  const storeId = `store-${chatId}`;
  const text = message.text ? message.text.trim() : '';

  // 2. RECEPCIÓN DE PEDIDOS DESDE LA MINI APP
  if (message.web_app_data && message.web_app_data.data) {
    try {
      const order = JSON.parse(message.web_app_data.data);
      const orderNum = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

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
    } catch (e) { console.error(e); }
    return res.status(200).send('OK');
  }

  // 3. COMANDO /START O MENÚ INICIAL
  const clientData = await getClient(clientId);

  if (text === '/start' || !clientData || !clientData.step) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "👤 Crear Usuario / Registro", callback_data: "btn_start_reg" }],
        [{ text: "ℹ️ Recibir Información", callback_data: "btn_info" }]
      ]
    };
    await sendMessage(
      chatId,
      `🚀 *Bienvenido a la Plataforma SaaS de Mini Apps*\n\n` +
      `Para acceder a la creación de tiendas debes completar un breve registro de seguridad. ¿Qué deseas hacer?`,
      keyboard
    );
    return res.status(200).send('OK');
  }

  // 4. FLUJO PASO A PASO DE CAPTURA DE DATOS
  if (clientData.step === 'AWAITING_NAME') {
    await updateClient(clientId, { owner_name: text, step: 'AWAITING_TYPE' });
    const keyboard = {
      inline_keyboard: [
        [{ text: "👤 Persona Natural (PN)", callback_data: "type_pn" }],
        [{ text: "🏢 Persona Jurídica (PJ)", callback_data: "type_pj" }]
      ]
    };
    await sendMessage(chatId, `✅ Nombre guardado: *${text}*\n\nSelecciona el tipo de persona:`, keyboard);
    return res.status(200).send('OK');
  }

  if (clientData.step === 'AWAITING_EMAIL') {
    await updateClient(clientId, { email: text, step: 'AWAITING_PHONE' });
    await sendMessage(chatId, `✅ Correo guardado: *${text}*\n\n📱 Envía tu *Número de Teléfono / WhatsApp*:`);
    return res.status(200).send('OK');
  }

  if (clientData.step === 'AWAITING_PHONE') {
    await updateClient(clientId, {
      phone: text,
      step: 'ACTIVE',
      plan: 'Free',
      created_at: new Date().toISOString()
    });

    await sendMessage(
      chatId,
      `🎉 *¡Registro completado exitosamente!*\n\n` +
      `🆔 *Tu ID Único de Cliente:* \`${clientId}\`\n\n` +
      `📌 *Paso 1:* Envía el nombre de tu tienda (Ej: \`Moda VIP\`)\n` +
      `📌 *Paso 2:* Carga tu producto en formato: \`Nombre, Precio\``
    );
    return res.status(200).send('OK');
  }

  // 5. USUARIO ACTIVO (Creación de Productos / Tienda)
  if (clientData.step === 'ACTIVE') {
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

    // Definir/actualizar nombre de la tienda
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
      `✅ *Tienda "${text}" activada!*\n\n` +
      `🔗 *Enlace:* ${appUrl}\n\n` +
      `📦 Envía tu producto en formato: \`Nombre, Precio\``
    );
  }

  return res.status(200).send('OK');
}
