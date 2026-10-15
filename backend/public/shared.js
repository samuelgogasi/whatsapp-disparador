export const $ = (selector) => document.querySelector(selector);
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return; } catch { /* Some Android WebViews lack Clipboard API. */ }
  const input = document.createElement('textarea');
  input.value = text; input.setAttribute('readonly', ''); input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.append(input); input.select();
  const copied = document.execCommand('copy'); input.remove();
  if (!copied) throw new Error('Não foi possível copiar. Selecione e copie o texto exibido.');
}
export function notice(message, error = false) {
  $('#notice').textContent = message;
  $('#notice').classList.toggle('error', error);
  $('#notice').hidden = false;
}
export async function api(url, options = {}) {
  const { body, headers, ...rest } = options;
  const response = await fetch(url, { credentials: 'same-origin', ...rest, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error ?? 'Falha na operação.'), { status: response.status });
  return data;
}
export function action(selector, callback, eventName = 'click') {
  $(selector).addEventListener(eventName, async (event) => {
    event.preventDefault();
    const control = event.currentTarget.tagName === 'FORM' ? event.currentTarget.querySelector('button') : event.currentTarget;
    if (control.disabled) return;
    control.disabled = true;
    try { await callback(event); } catch (error) { notice(error.message, true); }
    finally { control.disabled = false; }
  });
}
export const date = (value) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
