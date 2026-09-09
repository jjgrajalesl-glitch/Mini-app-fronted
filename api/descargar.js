// api/descargar.js - Generación dinámica de entregables en memoria
import JSZip from 'jszip';

export default async function handler(req, res) {
    const { item } = req.query;
    const zip = new JSZip();

    if (item === 't2_name') {
        zip.file('privacy-scanner.js', `/* GDPR Scanner Executable v1.0 */\nconsole.log('GDPR Scanner Active');`);
        zip.file('README_INSTALLATION.txt', `1. Inserta el script en el <head> de tu web.\n2. Licencia: LIC-GDPR-99`);
        zip.file('Compliance_Report.txt', `Reporte de auditoría de privacidad generado automáticamente.`);
    } else if (item === 't3_name') {
        zip.file('framer-ui-blueprint.json', JSON.stringify({ name: 'Framer B2B UI Blueprint', version: '1.0' }));
        zip.file('make-automation-blueprint.json', JSON.stringify({ name: 'Make.com Scenario Blueprint' }));
        zip.file('notion-agency-os.txt', `URL Notion: https://notion.so/agencyiaos/B2B-Agency-OS-Template\nLicencia: LIC-NOCODE-149`);
    } else {
        return res.status(400).json({ error: 'Producto no válido' });
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${item}-bundle.zip`);
    return res.status(200).send(zipBuffer);
}
