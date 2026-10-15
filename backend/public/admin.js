import { $, api, action, notice, date, element, copyText } from './shared.js';
let adminToken = '';
let users = [];
let clientsPage = 1;
let clientsTotalPages = 1;
let paymentPage = 1;
let paymentsTotalPages = 1;
let paymentUserId;
const adminApi = (url, options = {}) => api(url, { ...options, headers: { 'X-Admin-Token': adminToken } });
function selectedUser() { return users.find((user) => user.id === $('#users').value); }
function showUser() {
  const user = selectedUser(); const license = user?.licenses[0];
  $('#selected-user').textContent = user ? `ID: ${user.id} · ${license ? `${license.kind === 'TRIAL' ? 'Teste' : 'Mensal'} até ${date(license.expiresAt)} · ${license.revokedAt ? 'Revogada' : license.active ? 'Ativa' : 'Inativa / não ativada'}` : 'Sem licença'}` : 'Nenhum cliente cadastrado.';
}
async function loadUsers() {
  const previous = $('#users').value;
  const filter = new FormData($('#client-search'));
  const query = new URLSearchParams({ page: String(clientsPage), pageSize: '20', search: String(filter.get('search')), licenseState: String(filter.get('licenseState')) });
  const [result, stats] = await Promise.all([adminApi(`/api/admin/users?${query}`), adminApi('/api/admin/overview')]);
  users = result.items; clientsTotalPages = result.totalPages; $('#users').replaceChildren();
  for (const user of users) { const option = element('option', `${user.name ?? 'Sem nome'} · ${user.email ?? user.id}`); option.value = user.id; $('#users').append(option); }
  if (users.some((user) => user.id === previous)) $('#users').value = previous;
  showUser();
  $('#client-page').textContent = `Página ${result.page} de ${result.totalPages} · ${result.total} cliente(s)`;
  $('#clients-prev').disabled = clientsPage <= 1; $('#clients-next').disabled = clientsPage >= clientsTotalPages;
  const list = $('#client-list'); list.replaceChildren();
  for (const user of users) {
    const row = element('div', undefined, 'campaign-row'); const details = element('div'); const license = user.licenses[0];
    const state = !license ? 'Sem licença' : license.revokedAt ? 'Revogada' : new Date(license.expiresAt) <= new Date() ? 'Vencida' : !license.activatedAt ? 'Aguardando ativação' : license.kind === 'TRIAL' ? 'Teste ativo' : 'Mensal ativa';
    details.append(element('strong', user.name ?? user.id), element('p', user.email ?? user.id, 'muted'), element('p', `${state}${license ? ` · validade ${date(license.expiresAt)}` : ''}`, 'muted'));
    const select = element('button', 'Selecionar', 'secondary'); select.addEventListener('click', () => { $('#users').value = user.id; showUser(); $('#issue').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    row.append(details, select); list.append(row);
  }
  if (!users.length) list.append(element('p', 'Nenhum cliente encontrado com esse filtro.', 'muted'));
  const metrics = $('#admin-metrics'); metrics.replaceChildren();
  for (const [label, value] of [ ['Clientes', stats.clients], ['Licenças ativas', stats.activeLicenses], ['Mensais ativas', stats.activeMonthly], ['Testes ativos', stats.activeTrials], ['Aguardando ativação', stats.pendingActivation], ['Licenças vencidas', stats.expiredLicenses], ['Chaves emitidas · histórico', stats.issuedKeys], ['Chaves revogadas · histórico', stats.revokedKeys], ['Pix confirmados', stats.payments], ['Total confirmado', money(stats.confirmedAmountCents)] ]) {
    const card = element('article', undefined, 'metric'); card.append(element('span', label), element('strong', String(value))); metrics.append(card);
  }
}
const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
async function loadPayments() {
  if (!paymentUserId) throw new Error('Selecione um cliente.');
  const query = new URLSearchParams({ userId: paymentUserId, page: String(paymentPage), pageSize: '20' });
  const result = await adminApi(`/api/admin/payments?${query}`); paymentsTotalPages = result.totalPages;
  const list = $('#payment-list'); list.replaceChildren();
  for (const payment of result.items) {
    const row = element('div', undefined, 'campaign-row'); const details = element('div');
    details.append(element('strong', `${payment.user.name ?? payment.user.id} · ${money(payment.amountCents)}`), element('p', `${payment.reference} · confirmado ${date(payment.confirmedAt)}`, 'muted'), element('p', `Chave ${payment.license.keyPrefix}… · período até ${date(payment.license.expiresAt)}`, 'muted'));
    row.append(details); list.append(row);
  }
  if (!result.items.length) list.append(element('p', 'Nenhum pagamento confirmado para esse cliente.', 'muted'));
  $('#payment-page').textContent = `Página ${result.page} de ${result.totalPages} · ${result.total} pagamento(s)`;
  $('#payments-prev').disabled = paymentPage <= 1; $('#payments-next').disabled = paymentPage >= paymentsTotalPages;
}
action('#admin-auth', async ({ currentTarget }) => {
  adminToken = String(new FormData(currentTarget).get('token')).trim();
  try { await loadUsers(); } catch (error) { adminToken = ''; throw error; }
  currentTarget.reset(); $('#admin-login').hidden = true; $('#admin-workspace').hidden = false; $('#admin-payments').hidden = false; notice('Administração conectada. Confira o crédito do Pix antes de liberar.');
}, 'submit');
$('#users').addEventListener('change', showUser);
action('#refresh-users', loadUsers);
action('#client-search', async () => { clientsPage = 1; await loadUsers(); }, 'submit');
action('#clients-prev', async () => { if (clientsPage > 1) { clientsPage--; await loadUsers(); } });
action('#clients-next', async () => { if (clientsPage < clientsTotalPages) { clientsPage++; await loadUsers(); } });
action('#show-payments', async () => { paymentUserId = selectedUser()?.id; paymentPage = 1; await loadPayments(); });
action('#payments-prev', async () => { if (paymentPage > 1) { paymentPage--; await loadPayments(); } });
action('#payments-next', async () => { if (paymentPage < paymentsTotalPages) { paymentPage++; await loadPayments(); } });
action('#admin-logout', async () => {
  adminToken = ''; users = []; $('#issued-key').value = ''; $('#issued').hidden = true; $('#empty-key').hidden = false; $('#admin-workspace').hidden = true; $('#admin-login').hidden = false; $('#users').replaceChildren(); notice('Administração encerrada.');
  $('#admin-payments').hidden = true; $('#payment-list').replaceChildren(); $('#client-list').replaceChildren(); $('#admin-metrics').replaceChildren(); clientsPage = 1; paymentPage = 1; paymentUserId = undefined;
});
action('#issue', async ({ currentTarget }) => {
  const form = new FormData(currentTarget); const user = selectedUser();
  if (!user) throw new Error('Selecione um cliente.');
  const amountCents = Math.round(Number(form.get('amount')) * 100);
  if (!confirm(`Confirma que o Pix de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amountCents / 100)} de ${user.email ?? user.id} foi creditado? Uma nova chave será emitida e a anterior invalidada.`)) return;
  const result = await adminApi(`/api/admin/users/${encodeURIComponent(user.id)}/monthly-license`, { method: 'POST', body: { reference: String(form.get('reference')).trim(), amountCents, confirmed: form.get('confirmed') === 'on' } });
  $('#issued-key').value = result.key; $('#issued-expiry').textContent = `Validade até ${date(result.license.expiresAt)} (Brasília).`;
  $('#issued-user').textContent = `Entregar a: ${user.email ?? user.id}. O cliente deve entrar na própria conta e ativar a chave.`;
  $('#issued').hidden = false; $('#empty-key').hidden = true;
  currentTarget.elements.reference.value = ''; currentTarget.elements.confirmed.checked = false;
  notice('Chave emitida. Copie agora; ela não será exibida novamente pelo servidor.'); await loadUsers();
}, 'submit');
action('#copy-key', async () => { await copyText($('#issued-key').value); notice('Chave copiada. Entregue apenas ao titular indicado.'); });
action('#revoke', async () => {
  const user = selectedUser(); if (!user) throw new Error('Selecione um cliente.');
  if (!confirm(`Revogar o acesso de ${user.email ?? user.id}? Os próximos envios serão bloqueados.`)) return;
  await adminApi(`/api/admin/users/${encodeURIComponent(user.id)}/revoke-license`, { method: 'POST', body: {} });
  $('#issued-key').value = ''; $('#issued').hidden = true; $('#empty-key').hidden = false; await loadUsers(); notice('Acesso revogado.');
});
action('#rotate', async () => {
  const user = selectedUser(); if (!user) throw new Error('Selecione um cliente.');
  if (!confirm(`Reemitir a chave de ${user.email ?? user.id}, sem acrescentar validade? A chave anterior deixará de funcionar.`)) return;
  const result = await adminApi(`/api/admin/users/${encodeURIComponent(user.id)}/rotate-license`, { method: 'POST', body: {} });
  $('#issued-key').value = result.key; $('#issued-expiry').textContent = `Validade preservada até ${date(result.license.expiresAt)} (Brasília).`;
  $('#issued-user').textContent = `Entregar a: ${user.email ?? user.id}. O cliente deve ativar a nova chave.`;
  $('#issued').hidden = false; $('#empty-key').hidden = true; await loadUsers(); notice('Nova chave emitida sem renovar o período. Copie e entregue ao titular.');
});
