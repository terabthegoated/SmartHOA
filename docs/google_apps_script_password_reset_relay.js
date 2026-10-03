/**
 * SmartHOA password-reset email relay
 *
 * Deploy this as a Google Apps Script Web App from the Gmail account that
 * should send the reset messages. Store SMART_HOA_RELAY_SECRET as a Script
 * Property; never place the secret in this file.
 */
function doPost(event) {
  try {
    const payload = JSON.parse((event.postData && event.postData.contents) || '{}');
    const expectedSecret = PropertiesService.getScriptProperties()
      .getProperty('SMART_HOA_RELAY_SECRET');

    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse_({ ok: false, error: 'Unauthorized request.' });
    }

    const recipient = String(payload.recipient || '').trim();
    const subject = String(payload.subject || '').trim();
    const textContent = String(payload.textContent || '').trim();
    const htmlContent = String(payload.htmlContent || '');
    const senderName = String(payload.senderName || 'SmartHOA').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)
      || !subject || !textContent
      || recipient.length > 254 || subject.length > 200
      || textContent.length > 5000 || htmlContent.length > 15000) {
      return jsonResponse_({ ok: false, error: 'Invalid email request.' });
    }

    // MailApp asks only for permission to send email. Do not replace this
    // with GmailApp: GmailApp requests access to the complete Gmail mailbox.
    MailApp.sendEmail(recipient, subject, textContent, {
      htmlBody: htmlContent,
      name: senderName || 'SmartHOA',
    });

    return jsonResponse_({ ok: true });
  } catch (error) {
    console.error('SmartHOA password-reset relay error: ' + error.message);
    return jsonResponse_({ ok: false, error: 'Unable to send email.' });
  }
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
