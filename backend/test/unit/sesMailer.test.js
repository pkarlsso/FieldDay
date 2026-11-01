import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { sendSesEmail } from '../../src/utils/mailer.js';

test('SES email uses the configured sender and intended recipient', async () => {
  let sent;
  const client = { send: async (command) => { sent = command; } };
  await sendSesEmail(client, 'sender@example.test', 'recipient@example.test', 'Subject', 'Test body');
  assert.ok(sent instanceof SendEmailCommand);
  assert.equal(sent.input.FromEmailAddress, 'sender@example.test');
  assert.deepEqual(sent.input.Destination.ToAddresses, ['recipient@example.test']);
  assert.equal(sent.input.Content.Simple.Body.Text.Data, 'Test body');
});

test('SES delivery errors are surfaced to the caller', async () => {
  const client = { send: async () => { throw new Error('delivery failed'); } };
  await assert.rejects(sendSesEmail(client, 'a@example.test', 'b@example.test', 'Subject', 'Body'), /delivery failed/);
});
