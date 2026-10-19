// Render the real notice component. No browser session or API requests used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ mode: 'test', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const { default: Notice } = await server.ssrLoadModule('/src/components/payments/BillGenerationNotice.tsx');
  const render = issue => renderToStaticMarkup(createElement(Notice, { issue, onReview() {} }));
  const duplicate = render({ kind: 'duplicate', message: 'This resident already has an HOA dues bill for this billing month.' });
  assert.match(duplicate, /role="alert"/);
  assert.match(duplicate, /A bill already exists for this month/);
  assert.match(duplicate, /Review existing bills/);
  assert.match(duplicate, /No new bill was created/);
  assert.match(duplicate, /Your form details have been kept/);
  console.log('PASS: duplicate bill renders an accessible inline warning and review action.');

  const error = render({ kind: 'error', message: 'Please retry when the connection is available.' });
  assert.match(error, /Bill could not be created/);
  assert.match(error, /Please retry when the connection is available/);
  assert.doesNotMatch(error, /Review existing bills/);
  assert.doesNotMatch(error, /No new bill was created/);
  console.log('PASS: ordinary failure uses an error notice without claiming duplicate protection.');

  const unsafe = render({ kind: 'error', message: '<script>alert("not HTML")</script>' });
  assert.doesNotMatch(unsafe, /<script>/);
  assert.match(unsafe, /&lt;script&gt;/);
  console.log('PASS: server error text is displayed as escaped text.');

  const source = await readFile(new URL('../src/pages/officer/Payments.tsx', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('const handleGenerateBill ='), source.indexOf('const handleApprovePayment ='));
  assert.doesNotMatch(handler, /\balert\s*\(/);
  assert.match(handler, /response\?\.status === 409/);
  assert.match(handler, /finally\s*\{\s*setIsGenerating\(false\)/);
  assert.match(source, /aria-labelledby="generate-bill-title"/);
  assert.match(source, /<fieldset disabled=\{isGenerating\}/);
  console.log('PASS: generate-bill handling has no native alert and always resets its loading state.');
  console.log('4/4 bill-notice rendering / wiring checks passed; no bills generated.');
} finally { await server.close(); }
