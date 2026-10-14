import express from 'express';
import { fileURLToPath } from 'node:url';

const app = express();
app.disable('x-powered-by');
app.get('/api/me', (req, res) => {
  if (req.query.preview === '1') return res.json({ preview: true, user: { id: 'visual-preview', name: 'Prévia visual', email: null, trialStartedAt: null, trialEndsAt: null }, license: null });
  return res.status(401).json({ error: 'Prévia visual sem banco de dados.' });
});
app.get('/api/public', (_req, res) => res.json({ preview: true, trialDays: 7 }));
app.get('/api/payment-info', (_req, res) => res.json({ pixKey: null, paymentWhatsapp: null }));
app.get('/api/campaigns', (_req, res) => res.json([]));
app.get('/preview.html', (_req, res) => res.sendFile(fileURLToPath(new URL('../public/index.html', import.meta.url))));
app.use('/api', (_req, res) => res.status(503).json({ error: 'Esta é uma prévia visual. Para cadastro, licenças e envios, inicie PostgreSQL, Redis e npm run dev.' }));
app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url))));
app.listen(3334, '127.0.0.1', () => console.log('Prévia visual em http://127.0.0.1:3334 — sem banco, pagamentos ou envios.'));
