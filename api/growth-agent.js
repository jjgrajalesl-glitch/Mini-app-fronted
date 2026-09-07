module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const { mode } = req.query;

    if (!mode || (mode !== 'AM' && mode !== 'PM')) {
      return res.status(400).json({ 
        success: false, 
        message: "Especifica un modo válido: ?mode=AM o ?mode=PM" 
      });
    }

    // --- RUTINA AM (08:00 AM) ---
    if (mode === 'AM') {
      const prompt = `
        Crea 3 variaciones de guion de video (30s) para Agency AI OS en tres idiomas específicos:
        1. Español EE. UU. (es-US)
        2. Inglés EE. UU. (en-US)
        3. Portugués Brasil (pt-BR)

        REGLAS DE PRODUCCIÓN VISUAL Y AUDIO (ESTRICTAS):
        - CERO personas o figuras humanas en pantalla.
        - Estilo visual: Redes neuronales abstractas, líneas cibernéticas brillantes y tono azul oscuro/negro.
        - Texto en pantalla: Transcripción animada en letras grandes blancas sincronizadas con la voz.
        - Identidad de marca: Nombre y logo de Agency AI OS presente en todo momento.
        - Audio: Locución masculina sintética profesional y música de fondo ambiental estilo tech.

        ESTRUCTURA DE CONTENIDO (30s):
        - 0-3s: Gancho disruptivo sobre el tiempo perdido haciendo prompts a mano.
        - 3-20s: Demostración rápida de la Fórmula de 7 Pasos generando resultados.
        - 20-30s: Llamado a la acción (CTA): 'Prueba 10 puntos gratis en https://revenue-os-mvp.vercel.app'.
      `;

      let script = "Guion base automatizado para Agency AI OS.";
      const geminiKey = process.env.GEMINI_KEY;

      if (geminiKey) {
        try {
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });
          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            script = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || script;
          }
        } catch (e) {
          console.error("Error Gemini:", e.message);
        }
      }

      const workflowUrl = process.env.GOOGLE_WORKFLOW_URL;
      if (workflowUrl && workflowUrl.startsWith('http')) {
        try {
          await fetch(workflowUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              script, 
              languages: ['es-US', 'en-US', 'pt-BR'],
              audio_settings: { voice_type: "AI_professional_male", bg_music: "ambient_tech_subtle" },
              visual_rules: { 
                no_humans: true, 
                theme: "dark_executive_saas",
                background_style: "abstract_neural_networks_glowing_lines_dark_blue",
                text_overlay: "animated_sync_with_audio_large_white",
                outro_logo: "agency_ai_os_logo"
              },
              target_url: "https://revenue-os-mvp.vercel.app" 
            })
          });
        } catch (e) {
          console.error("Error Google Workflow:", e.message);
        }
      }

      return res.status(200).json({ 
        success: true, 
        mode: 'AM', 
        script_generated: script 
      });
    }

    // --- RUTINA PM (06:00 PM) ---
    if (mode === 'PM') {
      const today = new Date().toISOString().split('T')[0];
      let newSignups = 0;
      let trialsActive = 0;
      let conversions = 0;

      let rawSupabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

      if (rawSupabaseUrl) {
        if (!rawSupabaseUrl.startsWith('http://') && !rawSupabaseUrl.startsWith('https://')) {
          rawSupabaseUrl = `https://${rawSupabaseUrl}`;
        }
        rawSupabaseUrl = rawSupabaseUrl.replace(/\/+$/, '');
      }

      if (rawSupabaseUrl && supabaseKey) {
        try {
          const endpoint = `${rawSupabaseUrl}/rest/v1/app_access?select=plan,points_remaining,created_at&created_at=gte.${today}`;
          const supaRes = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (supaRes.ok) {
            const users = await supaRes.json();
            if (Array.isArray(users)) {
              newSignups = users.length;
              trialsActive = users.filter(u => u.plan === 'trial').length;
              conversions = users.filter(u => u.plan !== 'trial').length;
            }
          }
        } catch (e) {
          console.error("Error Supabase:", e.message);
        }
      }

      let telegramToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "";
      let telegramChatId = process.env.TELEGRAM_CHAT_ID || "";

      if (telegramToken.startsWith('bot')) {
        telegramToken = telegramToken.replace(/^bot/, '');
      }

      const telegramMessage = `
📊 *REPORTE DIARIO DE CRECIMIENTO - AGENCY AI OS*
📅 Fecha: ${today}

🚀 *Métricas de Marketing:*
• Tareas ejecutadas: Video Viral AM (es-US, en-US, pt-BR)
• Estilo: Redes Neuronales / Voz IA / Tipografía
• Registros Nuevos: *${newSignups}*
• Usuarios en Prueba (10 pts): *${trialsActive}*
• Conversiones/Pagos (Hotmart): *${conversions}*

📈 *Estado del Embudo:*
Atracción automatizada ejecutada. Saldo gastado en la app derivando al muro de pago.
      `;

      let telegramSent = false;
      let telegramError = null;

      if (!telegramToken || !telegramChatId) {
        telegramError = "Faltan variables en Vercel: asegúrate de tener TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID agregadas.";
      } else {
        try {
          const telegramRes = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: telegramMessage,
              parse_mode: 'Markdown'
            })
          });

          const tgData = await telegramRes.json();
          if (telegramRes.ok && tgData.ok) {
            telegramSent = true;
          } else {
            telegramError = tgData.description || "Error de autenticación con Telegram API";
          }
        } catch (e) {
          telegramError = e.message;
        }
      }

      return res.status(200).json({ 
        success: true, 
        mode: 'PM', 
        telegram_sent: telegramSent,
        telegram_diagnostic: telegramError || "Mensaje enviado exitosamente a Telegram",
        metrics: { newSignups, trialsActive, conversions } 
      });
    }

  } catch (err) {
    return res.status(200).json({ 
      success: false, 
      error: err.message || "Error procesado" 
    });
  }
};
