import { $, api, action, notice, date, element } from './shared.js';
import { scheduleToIso, toBrasiliaInput } from './scheduling.js';
let account;
const statuses = { SCHEDULED: 'Agendada', PENDING: 'Na fila', PROCESSING: 'Em processamento', COMPLETED: 'Concluída', PARTIAL_FAILURE: 'Finalizada com falhas', PAUSED_LICENSE: 'Pausada por licença' };
const views = { overview: 'Visão geral', compose: 'Nova divulgação', schedule: 'Agendamentos', history: 'Histórico', whatsapp: 'WhatsApp', billing: 'Licença e Pix' };
function setMobileMenu(open) {
  $('.sidebar').classList.toggle('menu-open', open);
  $('#mobile-menu-toggle').setAttribute('aria-expanded', String(open));
}
$('#mobile-menu-toggle').addEventListener('click', () => setMobileMenu(!$('.sidebar').classList.contains('menu-open')));
function showView(view) {
  if (!account || !views[view]) return;
  for (const panel of document.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== view;
  for (const button of document.querySelectorAll('[data-view]')) button.classList.toggle('active', button.dataset.view === view);
  $('#page-title').textContent = views[view];
  if ($('.sidebar').classList.contains('menu-open') && window.matchMedia('(max-width: 800px)').matches) {
    setMobileMenu(false);
    $('#page-title').setAttribute('tabindex', '-1');
    $('#page-title').focus({ preventScroll: true });
  }
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => showView(button.dataset.view));
for (const view of ['compose', 'whatsapp', 'schedule']) for (const button of document.querySelectorAll(`.navigate-${view}`)) button.addEventListener('click', () => showView(view));
function showAuth(mode) {
  $('#login').hidden = mode !== 'login'; $('#register').hidden = mode !== 'register';
  $('#show-login').classList.toggle('active', mode === 'login'); $('#show-register').classList.toggle('active', mode === 'register');
}
$('#show-login').addEventListener('click', () => showAuth('login'));
$('#show-register').addEventListener('click', () => showAuth('register'));

async function loadAccount() {
  const initial = !account;
  account = await api(window.location.pathname === '/preview.html' ? '/api/me?preview=1' : '/api/me');
  $('#auth').hidden = true;
  $('#workspace').hidden = false;
  $('#logout').hidden = false;
  for (const button of document.querySelectorAll('[data-view]')) button.disabled = false;
  if (initial) showView('overview');
  if (account.preview) notice('Prévia visual: sem conta real, banco, pagamentos ou envios. Os números abaixo não representam uma operação real.');
  $('#welcome').textContent = `Olá, ${account.user.name ?? 'jornalista'}`;
  $('#account-id').textContent = account.user.id;
  const license = account.license;
  $('#header-access').textContent = license?.active ? 'Licença ativa' : 'Ative sua licença';
  $('#metric-license').textContent = license?.active ? license.kind === 'TRIAL' ? 'Teste' : 'Mensal' : 'Inativa';
  $('#metric-expiry').textContent = license ? `Até ${date(license.expiresAt)}` : 'Ative o teste ou sua chave';
  $('#start-trial').hidden = Boolean(account.user.trialStartedAt || license);
  $('#access-title').textContent = license?.active ? (license.kind === 'TRIAL' ? 'Seus 7 dias grátis estão ativos' : 'Sua licença mensal está ativa') : 'Ative seu acesso';
  $('#access-detail').textContent = license ? `${license.revokedAt ? 'Chave revogada.' : !license.activatedAt ? 'Chave aguardando ativação.' : !license.active ? 'Acesso expirado.' : 'Você pode criar divulgações.'} Validade: ${date(license.expiresAt)} (Brasília).` : 'Comece o teste ou informe a chave que recebeu após o pagamento.';
  await loadPayment();
  await loadCampaigns();
}
async function loadPayment() {
  const info = await api('/api/payment-info');
  const target = $('#payment-details');
  target.replaceChildren();
  if (info.pixKey) {
    target.append(element('p', `Chave Pix pessoal: ${info.pixKey}`, 'payment-key'));
    const copy = element('button', 'Copiar chave Pix', 'secondary');
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(info.pixKey); notice('Chave Pix copiada. Confira o destinatário no seu banco antes de pagar.'); } catch { notice('Selecione e copie a chave Pix exibida.', true); } });
    target.append(copy);
  } else target.append(element('p', 'Solicite a chave Pix pessoal ao responsável.', 'muted'));
  if (info.paymentWhatsapp) {
    const link = element('a', 'Enviar comprovante pelo WhatsApp', 'button secondary');
    const text = `Olá! Quero liberar a mensalidade. Minha conta: ${account.user.email}. ID: ${account.user.id}. Vou enviar o comprovante do Pix para conferência.`;
    link.href = `https://wa.me/${info.paymentWhatsapp}?text=${encodeURIComponent(text)}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    target.append(link);
  }
}
async function loadCampaigns() {
  const campaigns = await api('/api/campaigns');
  $('#metric-total').textContent = String(campaigns.length);
  $('#metric-scheduled').textContent = String(campaigns.filter((item) => item.status === 'SCHEDULED').length);
  $('#metric-pending').textContent = String(campaigns.filter((item) => ['PENDING', 'PROCESSING'].includes(item.status)).length);
  renderCampaigns($('#campaigns'), campaigns);
  renderCampaigns($('#scheduled-campaigns'), campaigns.filter((item) => item.status === 'SCHEDULED').sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));
}
function renderCampaigns(target, campaigns) {
  target.replaceChildren();
  if (!campaigns.length) { target.append(element('p', target.id === 'scheduled-campaigns' ? 'Nenhuma divulgação agendada nas últimas 50 campanhas.' : 'Sua primeira divulgação aparecerá aqui.', 'muted')); return; }
  for (const campaign of campaigns) {
    const row = element('div', undefined, 'campaign-row');
    const details = element('div');
    details.append(element('strong', campaign.text.slice(0, 100)), element('p', `${statuses[campaign.status] ?? campaign.status} · ${campaign.totalGroups} grupo(s) · ${date(campaign.createdAt)}`, 'muted'));
    if (campaign.scheduledAt) details.append(element('p', `Início previsto: ${date(campaign.scheduledAt)} · Brasília`, 'muted campaign-time'));
    const logs = element('button', 'Ver resultados', 'secondary');
    logs.addEventListener('click', async () => {
      logs.disabled = true;
      try {
        const items = await api(`/api/campaigns/${encodeURIComponent(campaign.id)}/logs`);
        const output = details.querySelector('pre') ?? element('pre');
        output.textContent = items.map((item) => `${item.groupName ?? item.groupJid}: ${item.status}${item.error ? ` — ${item.error}` : ''}`).join('\n');
        details.append(output);
      } catch (error) { notice(error.message, true); } finally { logs.disabled = false; }
    });
    row.append(details, logs); target.append(row);
  }
}
action('#login', async ({ currentTarget }) => {
  await api('/api/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(currentTarget)) });
  currentTarget.reset(); await loadAccount(); notice('Bem-vindo de volta.');
}, 'submit');
action('#register', async ({ currentTarget }) => {
  await api('/api/auth/register', { method: 'POST', body: Object.fromEntries(new FormData(currentTarget)) });
  currentTarget.reset(); await loadAccount(); notice('Conta criada. Escolha quando ativar seus 7 dias grátis.');
}, 'submit');
action('#logout', async () => {
  await api('/api/auth/logout', { method: 'POST', body: {} });
  account = null; $('#auth').hidden = false; $('#workspace').hidden = true; $('#qr').hidden = true; $('#groups').replaceChildren(); notice('Você saiu da conta.');
  pairingCodeValue = ''; qrRequested = false; $('#pairing-code').textContent = ''; $('#pairing-result').hidden = true; $('#pairing').reset();
  $('#logout').hidden = true; $('#page-title').textContent = 'Acesso à conta'; $('#header-access').textContent = 'Acesso protegido';
  for (const button of document.querySelectorAll('[data-view]')) { button.disabled = true; button.classList.remove('active'); }
});
action('#start-trial', async () => {
  if (!confirm('Ativar agora? Seus 7 dias grátis começam imediatamente e não poderão ser reiniciados.')) return;
  await api('/api/license/trial', { method: 'POST', body: {} });
  await loadAccount(); notice('Teste de 7 dias ativado. Agora conecte o WhatsApp e prepare seu primeiro envio.');
});
action('#activate', async ({ currentTarget }) => {
  const key = String(new FormData(currentTarget).get('key')).trim();
  await api('/api/license/activate', { method: 'POST', body: { key } });
  currentTarget.reset(); await loadAccount(); notice('Chave ativada. Seu acesso está liberado até a data indicada.');
}, 'submit');
const sessionPath = () => `/api/sessions/${encodeURIComponent(account.user.id)}`;
let qrRequested = false;
let pairingCodeValue = '';
async function refreshConnection() {
  const status = await api(`${sessionPath()}/status`);
  $('#connection-status').textContent = status.connected ? 'Conectado' : status.status === 'connecting' ? 'Conectando' : 'Desconectado';
  if (status.connected) { $('#qr').hidden = true; $('#pairing-result').hidden = true; $('#pairing-code').textContent = ''; pairingCodeValue = ''; return; }
  if (!qrRequested) return;
  try {
    const { qr } = await api(`${sessionPath()}/qr`);
    if (qr.startsWith('data:image/png;base64,')) { $('#qr').src = qr; $('#qr').hidden = false; }
  } catch (error) { if (error.status !== 404) throw error; }
}
action('#connect', async () => { qrRequested = true; await api(`${sessionPath()}/connect`, { method: 'POST', body: {} }); notice('Conexão iniciada. Atualize o estado em alguns segundos para visualizar o QR.'); await refreshConnection(); });
action('#pairing', async ({ currentTarget }) => {
  qrRequested = false; $('#qr').hidden = true; $('#pairing-result').hidden = true; pairingCodeValue = ''; $('#pairing-code').textContent = '';
  const phoneNumber = String(new FormData(currentTarget).get('phoneNumber')).trim();
  notice('Preparando a conexão. Aguarde o código.');
  const result = await api(`${sessionPath()}/pairing-code`, { method: 'POST', body: { phoneNumber } });
  if (result.status === 'connected') { await refreshConnection(); notice('Seu WhatsApp já está conectado.'); return; }
  if (!result.code) { notice('A conta já está vinculada e está conectando. Atualize o estado em alguns segundos.'); return; }
  pairingCodeValue = result.code;
  $('#pairing-code').textContent = pairingCodeValue.replace(/^(.{4})(.{4})$/, '$1-$2');
  $('#pairing-result').hidden = false;
  notice('Código disponível. Conclua em Aparelhos conectados no WhatsApp e volte ao painel.');
}, 'submit');
action('#copy-pairing-code', async () => {
  if (!pairingCodeValue) throw new Error('Solicite um código antes de copiar.');
  await navigator.clipboard.writeText(pairingCodeValue); notice('Código copiado. Agora conclua a vinculação no WhatsApp.');
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && account && !account.preview && !document.querySelector('[data-panel="whatsapp"]').hidden) {
    void refreshConnection().catch((error) => notice(error.message, true));
  }
});
action('#refresh-connection', refreshConnection);
action('#load-groups', async () => {
  const { groups } = await api(`${sessionPath()}/groups`); const target = $('#groups'); target.replaceChildren();
  $('#destination-count').textContent = 'Nenhum grupo selecionado.';
  for (const group of groups) {
    const label = element('label', undefined, 'check'); const check = document.createElement('input'); check.type = 'checkbox'; check.name = 'groupJids'; check.value = group.id;
    label.append(check, element('span', group.subject)); target.append(label);
  }
  if (!groups.length) target.append(element('p', 'Nenhum grupo disponível nesta sessão.', 'muted'));
});
$('#groups').addEventListener('change', () => { const count = $('#groups').querySelectorAll('input:checked').length; $('#destination-count').textContent = `${count} grupo(s) selecionado(s).`; });
action('#campaign', async ({ currentTarget }) => {
  const form = new FormData(currentTarget); const groupJids = form.getAll('groupJids');
  if (!groupJids.length) throw new Error('Selecione ao menos um grupo.');
  const scheduled = form.get('sendMode') === 'scheduled';
  const scheduledAt = scheduled ? scheduleToIso(String(form.get('scheduledAt'))) : undefined;
  if (scheduledAt && new Date(scheduledAt).getTime() < Date.now() + 60000) throw new Error('Agende com pelo menos 1 minuto de antecedência.');
  if (!confirm(`${scheduled ? `Agendar o início para ${date(scheduledAt)} (Brasília)` : 'Enviar agora'} para ${groupJids.length} grupo(s)? A licença precisa estar ativa no envio.`)) return;
  const result = await api('/api/campaigns', { method: 'POST', body: { text: form.get('text'), groupJids, ...(scheduledAt ? { scheduledAt } : {}) } });
  notice(scheduled ? `Divulgação agendada para ${date(result.scheduledAt)} (Brasília).` : `Divulgação criada: ${result.queued} envio(s) na fila.`); await loadCampaigns();
  showView(scheduled ? 'schedule' : 'history');
}, 'submit');
action('#refresh-campaigns', loadCampaigns);
for (const button of document.querySelectorAll('.refresh-lists')) button.addEventListener('click', async () => { try { await loadCampaigns(); } catch (error) { notice(error.message, true); } });
function refreshScheduleFields() {
  const scheduled = $('#campaign').querySelector('input[name="sendMode"]:checked').value === 'scheduled';
  $('#schedule-fields').hidden = !scheduled;
  $('#scheduled-at').disabled = !scheduled; $('#scheduled-at').required = scheduled;
  $('#scheduled-at').min = toBrasiliaInput(new Date(Math.ceil((Date.now() + 60000) / 60000) * 60000));
  $('#campaign-submit').textContent = scheduled ? 'Agendar divulgação' : 'Enviar divulgação agora';
}
for (const radio of $('#campaign').querySelectorAll('input[name="sendMode"]')) radio.addEventListener('change', refreshScheduleFields);
refreshScheduleFields();
try { await loadAccount(); } catch (error) { if (error.status !== 401) notice(error.message, true); }
try { if ((await api('/api/public')).preview) $('#preview-link').hidden = false; } catch { /* Acesso ao painel real não depende da prévia. */ }
