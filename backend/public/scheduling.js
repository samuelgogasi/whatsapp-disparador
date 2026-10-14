// O campo do painel usa explicitamente Brasília (UTC-3), independentemente do computador.
export function scheduleToIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Informe uma data e um horário válidos.');
  const result = new Date(`${value}:00-03:00`);
  if (!Number.isFinite(result.getTime()) || toBrasiliaInput(result) !== value) throw new Error('Data ou horário inválidos.');
  return result.toISOString();
}

export function toBrasiliaInput(value) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
