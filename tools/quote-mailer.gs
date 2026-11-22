/**
 * FreshStart quote mailer: a tiny Google Apps Script web app.
 *
 * The website sends each quote request here, and this script emails it to you
 * FROM YOUR OWN GMAIL, with the customer's photos attached. Because it's your own
 * account sending to itself, Gmail delivers it reliably (it also shows in Sent).
 *
 * Setup (about 5 minutes, see README "Quote emails via your Gmail"):
 *   1. Signed in as the Gmail that should get quotes, open https://script.google.com
 *      and click "New project".
 *   2. Delete what's there, paste this whole file, click Save.
 *   3. Deploy > New deployment > type "Web app".
 *        Execute as: Me      Who has access: Anyone
 *      Click Deploy, then Authorize access and allow it (Google shows an
 *      "unverified app" warning because it's your own script: Advanced > Go to project).
 *   4. Copy the Web app URL (ends in /exec) and put it in CONFIG.quoteScriptUrl in
 *      assets/js/app.js (or send it to whoever maintains the site).
 */

var SEND_TO = Session.getEffectiveUser().getEmail();   // quotes go to the account that deployed this
var MAX_PHOTOS = 6;

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data._honey) return json_({ ok: true });                 // bot trap

    var f = data.fields || {};
    var rows = [
      ['Name', f.name], ['Phone', f.phone], ['Email', f.email || '-'], ['Suburb', f.suburb],
      ['Services', f.services || '-'], ['Approx. size', f.size || '-'], ['Message', f.message || '-'],
      ['Photos', String((data.photos || []).length)], ['Sent from', f.page || '-']
    ];
    var html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0A1626">'
      + '<h2 style="margin:0 0 12px">New quote request</h2><table cellpadding="8" style="border-collapse:collapse">'
      + rows.map(function (r) {
          return '<tr><td style="border:1px solid #ddd;background:#f4f3ef;font-weight:bold;vertical-align:top">' + esc_(r[0])
            + '</td><td style="border:1px solid #ddd;white-space:pre-wrap">' + esc_(r[1] || '') + '</td></tr>';
        }).join('')
      + '</table><p style="color:#666;font-size:13px">Photos are attached. Hit Reply to answer the customer'
      + (f.email ? '' : ' (they did not leave an email, so call or text them)') + '.</p></div>';
    var text = rows.map(function (r) { return r[0] + ': ' + (r[1] || ''); }).join('\n');

    var attachments = (data.photos || []).slice(0, MAX_PHOTOS).map(function (p, i) {
      return Utilities.newBlob(Utilities.base64Decode(p.data), p.type || 'image/jpeg', p.name || ('photo-' + (i + 1) + '.jpg'));
    });

    var opts = { htmlBody: html, attachments: attachments, name: 'FreshStart website' };
    if (f.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) opts.replyTo = f.email;
    var subject = 'New quote request: ' + (f.name || 'someone') + ' (' + (f.suburb || 'no suburb') + ')';
    GmailApp.sendEmail(SEND_TO, subject, text, opts);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() { return json_({ ok: true, service: 'FreshStart quote mailer' }); }

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/** Run this once from the editor (pick "authorize" next to Debug, then Run) to grant Gmail permission.
 *  On Google's approval screen tick "Select all" (or "Send email on your behalf").
 *  It sends you a confirmation email so you know quotes will arrive. */
function authorize() {
  GmailApp.sendEmail(SEND_TO, 'FreshStart quote mailer is connected', 'Quote requests from your website will now arrive in this inbox, with photos attached.', { name: 'FreshStart website' });
}
