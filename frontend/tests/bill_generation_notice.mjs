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
  assert.match(duplicate, /A bill already exists for the selected billing month/);
  assert.match(duplicate, /Review existing bills/);
  assert.match(duplicate, /No new bill was created/);
  assert.match(duplicate, /Your form details have been kept/);
  console.log('PASS: duplicate bill renders an accessible inline warning and review action.');

  const november = render({ kind: 'duplicate', billingLabel: 'November 2026', message: 'This resident already has an HOA dues bill for November 2026.' });
  assert.match(november, /A bill already exists for November 2026/);
  assert.doesNotMatch(november, /for this month/);
  console.log('PASS: the duplicate notice names November rather than the current month.');

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
  assert.match(handler, /billing_month: billPeriodPayload\(billingPeriod.month\)/);
  assert.match(source, /id="bill-billing-month" type="month" required/);
  assert.match(source, /setBillingPeriod\(current => billPeriodForDueDate\(current, e.target.value\)\)/);
  console.log('PASS: generate-bill handling has no native alert and always resets its loading state.');
  console.log('5/5 bill-notice rendering / wiring checks passed; no bills generated.');
} finally { await server.close(); }
