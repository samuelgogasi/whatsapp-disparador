import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignSchema, userIdSchema } from '../src/validation.js';
import { environmentSchema } from '../src/config.js';

const input = { userId: 'operador-1', text: 'Notícia', groupJids: ['123@g.us'], confirmed: true };
test('campanha válida aceita texto ou mídia completa', () => {
  assert.equal(campaignSchema.safeParse(input).success, true);
  assert.equal(campaignSchema.safeParse({ ...input, mediaUrl: 'https://example.com/image.jpg', mediaType: 'image' }).success, true);
});
test('rejeita grupos duplicados, destinatário individual, texto vazio e mídia incompleta', () => {
  for (const patch of [ { groupJids: ['123@g.us', '123@g.us'] }, { groupJids: ['123@s.whatsapp.net'] }, { text: '   ' }, { mediaUrl: 'https://example.com/image.jpg' }, { mediaType: 'video' } ]) {
    assert.equal(campaignSchema.safeParse({ ...input, ...patch }).success, false);
  }
});
test('IDs de sessão não permitem escapar do diretório de credenciais', () => {
  for (const id of ['../outro', '..\\outro', 'a/b', 'a:b', '']) assert.equal(userIdSchema.safeParse(id).success, false);
});
test('configuração rejeita intervalos invertidos, porta inválida e lote zero', () => {
  assert.equal(environmentSchema.safeParse({}).success, true);
  for (const env of [{ GROUP_BATCH_SIZE: '0' }, { PORT: '99999' }, { MIN_MESSAGE_DELAY_MS: '50', MAX_MESSAGE_DELAY_MS: '10' }, { COMPOSING_MIN_MS: '-1' }]) assert.equal(environmentSchema.safeParse(env).success, false);
});
