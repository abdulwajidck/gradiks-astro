import { init, id } from '@instantdb/core';

const db = init({ appId: 'c3c22ee1-9ee9-4a5f-89ae-0e5fa0085767' });

window.__sendToBackend = function (data) {
  var params = ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var tracking = {};
  params.forEach(function (key) {
    tracking[key] = sessionStorage.getItem(key) || '';
  });
  tracking.page_url = location.href;
  tracking.referrer = document.referrer || '';

  var record = Object.assign({}, data, tracking, { submitted_at: Date.now() });

  db.transact(db.tx.leads[id()].update(record));
};
