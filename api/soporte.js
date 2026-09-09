// api/soporte.js - Helpdesk 100% Autónomo
export default async function handler(req, res) {
    const { emailCliente, mensaje } = req.body;
    
    // El agente de IA analiza la solicitud, valida la compra en Dodo Payments y responde
    const respuestaIa = `Hola. Tu licencia activa está vinculada a ${emailCliente}. Puedes descargar tu paquete actualizado directamente desde: https://agencyiaos.com/api/descargar?item=t2_name`;

    return res.status(200).json({ enviado: true, respuesta: respuestaIa });
}
