import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignJobs } from '../src/scheduling.js';
import { campaignSchema } from '../src/validation.js';
import { scheduleToIso, toBrasiliaInput } from '../public/scheduling.js';

const input = { id: 'camp-1', userId: 'alice', text: 'Notícia', groupJids: ['123@g.us', '456@g.us'] };
test('todos os grupos usam o mesmo início; tempo decorrido na persistência não prolonga agenda', () => {
  const scheduledAt = new Date('2026-10-09T15:00:00Z');
  const jobs = buildCampaignJobs({ ...input, scheduledAt }, scheduledAt.getTime() - 30000);
  assert.deepEqual(jobs.map((job) => job.opts.delay), [30000, 30000]);
  assert.equal(jobs[0]!.opts.jobId, 'campaign-camp-1-0');
  assert.equal(jobs[1]!.data.groupJid, '456@g.us');
  assert.equal(buildCampaignJobs({ ...input, scheduledAt }, scheduledAt.getTime() + 5000)[0]!.opts.delay, 0);
  assert.equal(buildCampaignJobs(input)[0]!.opts.delay, 0);
});
test('horário escolhido em Brasília converte para UTC sem depender do fuso do computador', () => {
  assert.equal(scheduleToIso('2026-10-09T12:30'), '2026-10-09T15:30:00.000Z');
  assert.equal(toBrasiliaInput(new Date('2026-10-09T15:30:00Z')), '2026-10-09T12:30');
  assert.equal(scheduleToIso('2026-10-09T23:30'), '2026-10-10T02:30:00.000Z');
  assert.throws(() => scheduleToIso('2026-02-31T12:00'), /inválid/);
  assert.throws(() => scheduleToIso(''), /válid/);
});
test('agenda exige fuso explícito, antecedência mínima e limite de um ano', () => {
  const campaign = { userId: 'alice', text: 'Notícia', groupJids: ['123@g.us'], confirmed: true };
  assert.equal(campaignSchema.safeParse({ ...campaign, scheduledAt: new Date(Date.now() + 120000).toISOString() }).success, true);
  for (const value of ['2000-01-01T00:00:00Z', '2026-10-09T12:00:00', 'inválido', new Date(Date.now() + 1000).toISOString(), new Date(Date.now() + 367 * 86400000).toISOString()]) {
    assert.equal(campaignSchema.safeParse({ ...campaign, scheduledAt: value }).success, false);
  }
});
