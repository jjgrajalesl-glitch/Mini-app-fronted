import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { mode } = req.query;

  // --- RUTINA AM (08:00 AM): Creación y Difusión Viral ---
  if (mode === 'AM') {
    const prompt = `
      Analiza las tendencias y ganchos (hooks) de mayor conversión y viralidad en TikTok, Reels y Shorts de SaaS/AI en Español, Inglés y Portugués.
      Extrae los patrones de apertura de 3 segundos más eficientes y genera un guion de video de 30 segundos optimizado para Agency AI OS.
      
      Estructura obligatoria:
      1. Gancho disruptivo (3s) basado en los mejores patrones trilingües.
      2. Demostración del problema: Tiempo perdido haciendo prompts manuales.
      3. Solución: Generar la Fórmula de 7 Pasos en 10 segundos.
      4. Llamado a la acción (CTA): 'Prueba 10 puntos gratis en revenue-os-mvp.vercel.app'.
    `;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const geminiData = await geminiRes.json();
    const script = geminiData.candidates[0].content.parts[0].text;

    // Disparar renderizado en Google Cloud Workflow
    if (process.env.GOOGLE_WORKFLOW_URL) {
      await fetch(process.env.GOOGLE_WORKFLOW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, target_url: "https://revenue-os-mvp.vercel.app" })
      });
    }

    return res.status(200).json({ success: true, mode: 'AM', script_generated: script });
  }

  // --- RUTINA PM (06:00 PM): Medición y Reporte en Telegram ---
  if (mode === 'PM') {
    const today = new Date().toISOString().split('T')[0];

    // Consultar nuevos usuarios y accesos de hoy en Supabase
    const { data: users, error } = await supabase
      .from('app_access')
      .select('plan, points_remaining, created_at')
      .gte('created_at', today);

    const newSignups = users ? users.length : 0;
    const trialsActive = users ? users.filter(u => u.plan === 'trial').length : 0;
    const conversions = users ? users.filter(u => u.plan !== 'trial').length : 0;

    // Mensaje de Telegram
    const telegramMessage = `
📊 *REPORTE DIARIO DE CRECIMIENTO - AGENCY AI OS*
📅 Fecha: ${today}

🚀 *Métricas de Marketing:*
• Tareas ejecutadas: Video Viral AM
• Registros Nuevos: *${newSignups}*
• Usuarios en Prueba (10 pts): *${trialsActive}*
• Conversiones/Pagos (Hotmart): *${conversions}*

📈 *Estado del Embudo:*
Se entregaron los puntos iniciales y se midió el impacto de conversión en el muro de pago.
    `;

    // Enviar a Telegram
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: telegramMessage,
        parse_mode: 'Markdown'
      })
    });

    return res.status(200).json({ success: true, mode: 'PM', metrics: { newSignups, conversions } });
  }

  return res.status(400).json({ error: "Especifique modo: ?mode=AM o ?mode=PM" });
}
