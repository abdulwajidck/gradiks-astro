/**
 * chat-client.js — Gradiks Hermes Chat Widget (Priya)
 *
 * Architecture:
 *   Widget → POST /api/chat/message → Express → hermes subprocess → MiniMax
 *                                                        ← JSON response
 *   Widget displays text + triggers field capture if action != null
 *
 * API Contract:
 *   POST /api/chat/start  → { ok, sessionId }
 *   POST /api/chat/message → { ok, text, action, nextStage, captureField, capturePrompt }
 *   POST /api/chat/capture → { ok, nextStage }
 *
 * Embed: <script src="/chat/chat-client.js" is:inline></script>
 * Requires: window.__GRADIKS_PAGE_DATA__ (injected by PageData.astro)
 */

(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  // Use localhost:3002 in dev, public server in production
  var API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3002/api/chat'
    : 'https://84.247.128.155:3002/api/chat';
  var TELECRM_URL = 'https://next-api.telecrm.in/enterprise/69a16e9a4ce16643f28061a1/autoupdatelead';
  var TELECRM_KEY = 'Bearer bc0b7478-97ce-49b2-b96c-13ef444898311775379897519:0ba13bb8-04fb-4ec6-a9f8-e2ba4e6879f7';

  // ─── State ────────────────────────────────────────────────────────────────
  var sessionId = sessionStorage.getItem('gradiks_chat_sid') || null;
  var lead = { name: '', email: '', phone: '' };
  var messages = [];
  var isOpen = false;
  var unread = 0;
  var pendingAction = null; // action returned by Hermes, waiting to capture

  // ─── Page Context ─────────────────────────────────────────────────────────
  var pageData = window.__GRADIKS_PAGE_DATA__ || {};
  var pageKey = pageData.pageKey || 'unknown';

  // ─── UTM / Tracking ───────────────────────────────────────────────────────
  function getTracking() {
    var params = ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var t = {};
    for (var i = 0; i < params.length; i++) {
      t[params[i]] = sessionStorage.getItem(params[i]) || '';
    }
    t.page_url = location.href;
    t.referrer = document.referrer || '';
    return t;
  }

  // ─── API ─────────────────────────────────────────────────────────────────
  function api(endpoint, body) {
    return fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); });
  }

  function startSession() {
    return api('/start', {
      pageKey: pageKey,
      program: pageData.program,
      country: pageData.country,
      tracking: getTracking(),
    }).then(function (res) {
      sessionId = res.sessionId;
      sessionStorage.setItem('gradiks_chat_sid', sessionId);
      return res;
    });
  }

  function sendMessage(text) {
    return api('/message', {
      sessionId: sessionId,
      message: text,
      pageData: pageData,
    });
  }

  function captureField(field, value) {
    if (field === 'name') lead.name = value;
    if (field === 'email') lead.email = value;
    if (field === 'phone') lead.phone = formatPhone(value);

    return api('/capture', {
      sessionId: sessionId,
      field: field,
      value: value,
    });
  }

  // ─── TeleCRM ─────────────────────────────────────────────────────────────
  function formatPhone(p) {
    p = (p || '').replace(/[\s\-]/g, '');
    return p.startsWith('+') ? p : '+91' + p.replace(/^0+/, '');
  }

  function sendToTeleCRM() {
    var notes = [
      'Source: Gradiks Chat Widget',
      'Program: ' + (pageData.pageTitle || pageKey),
      'Country: ' + (pageData.country || 'not specified'),
    ].filter(Boolean).join(' | ');

    var payload = {
      fields: {
        name: lead.name,
        phone: formatPhone(lead.phone),
        email: lead.email,
        lead_source: 'Chat Widget',
        facebook_campaign_name: pageKey,
        notes: notes,
      },
    };

    navigator.sendBeacon && navigator.sendBeacon(TELECRM_URL, JSON.stringify(payload));
    fetch(TELECRM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': TELECRM_KEY },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(function () {});
  }

  // ─── Message Rendering ───────────────────────────────────────────────────
  function addMessage(from, text) {
    messages.push({ from: from, text: text, ts: Date.now() });
    renderMessages();
    if (from === 'bot' && !isOpen) {
      unread++;
      renderUnread();
    }
  }

  function renderMessages() {
    var container = document.getElementById('gk-messages');
    if (!container) return;
    var html = '';
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var cls = m.from === 'bot' ? 'gk-msg-bot' : 'gk-msg-visitor';
      html += '<div class="gk-msg ' + cls + '"><div class="gk-msg-bubble">' + escapeHtml(m.text) + '</div></div>';
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderUnread() {
    var badge = document.getElementById('gk-unread');
    if (badge) {
      badge.textContent = unread;
      badge.style.display = unread > 0 ? 'flex' : 'none';
    }
  }

  function setTyping(show) {
    var el = document.getElementById('gk-typing');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  // ─── Field Capture ───────────────────────────────────────────────────────
  function showFieldForm(action, prompt) {
    // Remove any existing field form
    var existing = document.querySelector('.gk-field-prompt');
    if (existing) existing.remove();

    var container = document.getElementById('gk-messages');
    if (!container) return;

    var inputType = 'text';
    var placeholder = '';
    if (action === 'ask_name') { inputType = 'text'; placeholder = 'Your full name'; }
    if (action === 'ask_email') { inputType = 'email'; placeholder = 'you@example.com'; }
    if (action === 'ask_phone') { inputType = 'tel'; placeholder = '+91 98765 43210'; }

    // Add prompt bubble
    var promptBubble = '<div class="gk-msg gk-msg-bot"><div class="gk-msg-bubble">' + escapeHtml(prompt || 'Please share your details.') + '</div></div>';
    var formHtml = '<div class="gk-field-prompt">' + promptBubble + '<div class="gk-field-form"><input type="' + inputType + '" id="gk-field-input" class="gk-field-input" placeholder="' + escapeHtml(placeholder) + '"><button id="gk-field-submit" class="gk-field-btn">Send</button></div></div>';

    var typing = document.getElementById('gk-typing');
    if (typing) typing.insertAdjacentHTML('beforebegin', formHtml);
    else container.insertAdjacentHTML('beforeend', formHtml);

    container.scrollTop = container.scrollHeight;

    var input = document.getElementById('gk-field-input');
    if (input) input.focus();

    document.getElementById('gk-field-submit').onclick = submitField;
    input.onkeydown = function (e) { if (e.key === 'Enter') submitField(); };
  }

  function submitField() {
    var input = document.getElementById('gk-field-input');
    if (!input) return;
    var value = input.trim ? input.value.trim() : input.value && input.value.trim();
    if (!value) return;

    var form = document.querySelector('.gk-field-prompt');
    if (form) form.remove();

    var field = null;
    if (pendingAction === 'ask_name') field = 'name';
    if (pendingAction === 'ask_email') field = 'email';
    if (pendingAction === 'ask_phone') field = 'phone';

    addMessage('visitor', value);
    setTyping(true);

    captureField(field, value).then(function (res) {
      if (field === 'phone') {
        // Final field — qualify
        sendToTeleCRM();
        setTyping(false);
        addMessage('bot', "Perfect! I have everything I need. An advisor from Gradiks will reach out to you on WhatsApp shortly. In the meantime, feel free to explore the country pages — they have the full fee breakdowns.");
      } else {
        // More fields coming — wait for next Hermes response
        pendingAction = null;
        setTyping(false);
      }
    });
  }

  // ─── Send Handler ─────────────────────────────────────────────────────────
  function handleSend() {
    var input = document.getElementById('gk-input');
    if (!input) return;
    var text = (input.value || '').trim();
    if (!text) return;
    input.value = '';

    addMessage('visitor', text);
    setTyping(true);

    // Ensure session
    var sendTask = sessionId
      ? sendMessage(text)
      : startSession().then(function () { return sendMessage(text); });

    sendTask.then(function (res) {
      setTyping(false);

      if (!res || !res.ok) {
        addMessage('bot', "Something went wrong. Please try again.");
        return;
      }

      // Add bot text
      if (res.text) {
        addMessage('bot', res.text);
      }

      // Handle field capture action
      if (res.action && res.action !== 'qualify_lead') {
        pendingAction = res.action;
        showFieldForm(res.action, res.capturePrompt);
      }

      if (res.action === 'qualify_lead') {
        sendToTeleCRM();
        addMessage('bot', "Perfect! I have everything. An advisor will reach out on WhatsApp shortly.");
      }
    }).catch(function () {
      setTyping(false);
      addMessage('bot', "I'm having trouble responding right now. Please try again shortly.");
    });
  }

  // ─── Widget Toggle ────────────────────────────────────────────────────────
  function openWidget() {
    isOpen = true;
    unread = 0;
    renderUnread();
    var win = document.getElementById('gk-window');
    if (win) win.style.display = 'flex';
    var bubble = document.getElementById('gk-bubble');
    if (bubble) bubble.style.display = 'none';

    if (!sessionId) {
      startSession().then(function () {
        addMessage('bot', "Hi! I'm Priya from Gradiks 👋 What are you exploring — nursing or MBBS abroad? Or tell me which country you're interested in.");
      });
    }

    var input = document.getElementById('gk-input');
    if (input) setTimeout(function () { input.focus(); }, 200);
  }

  function closeWidget() {
    isOpen = false;
    var win = document.getElementById('gk-window');
    if (win) win.style.display = 'none';
    var bubble = document.getElementById('gk-bubble');
    if (bubble) bubble.style.display = 'flex';
  }

  // ─── Inject Styles ────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('gk-styles')) return;
    var css = document.createElement('style');
    css.id = 'gk-styles';
    css.textContent = [
      '#gk-root{position:fixed;bottom:24px;right:24px;z-index:9999;font-family:system-ui,-apple-system,sans-serif;}',
      '#gk-bubble{display:flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:50%;background:#be1e2d;color:#fff;cursor:pointer;box-shadow:0 4px 20px rgba(190,30,45,.35);transition:transform .2s,box-shadow .2s;position:relative;}',
      '#gk-bubble:hover{transform:scale(1.08);}',
      '#gk-bubble svg{width:26px;height:26px;}',
      '#gk-unread{display:none;position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;border-radius:10px;background:#f59e0b;color:#fff;font-size:11px;font-weight:700;align-items:center;justify-content:center;padding:0 5px;}',
      '#gk-window{display:none;flex-direction:column;width:clamp(300px,90vw,380px);height:clamp(420px,70vh,560px);border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.18);background:#fff;border:1px solid rgba(0,0,0,.08);position:absolute;bottom:80px;right:0;}',
      '@keyframes gk-slideUp{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}',
      '#gk-window{display:none;flex-direction:column;width:clamp(300px,90vw,380px);height:clamp(420px,70vh,560px);border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.18);background:#fff;border:1px solid rgba(0,0,0,.08);position:absolute;bottom:80px;right:0;animation:gk-slideUp .25s ease;}',
      '#gk-header{display:flex;align-items:center;padding:16px 18px;background:#1a2744;color:#fff;gap:12px;}',
      '#gk-header-avatar{width:38px;height:38px;border-radius:50%;background:#be1e2d;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0;}',
      '#gk-header-info{flex:1;min-width:0;}',
      '#gk-header-name{font-weight:600;font-size:14px;}',
      '#gk-header-status{font-size:11px;color:rgba(255,255,255,.55);}',
      '#gk-header-close{background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;padding:4px;display:flex;}',
      '#gk-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}',
      '.gk-msg{display:flex;}',
      '.gk-msg-visitor{justify-content:flex-end;}',
      '.gk-msg-bot{justify-content:flex-start;}',
      '.gk-msg-bubble{max-width:82%;padding:10px 14px;border-radius:16px;font-size:13.5px;line-height:1.55;word-break:break-word;}',
      '.gk-msg-visitor .gk-msg-bubble{background:#be1e2d;color:#fff;border-bottom-right-radius:4px;}',
      '.gk-msg-bot .gk-msg-bubble{background:#f1f5f9;color:#1e293b;border-bottom-left-radius:4px;}',
      '.gk-field-prompt{margin:4px 0;}',
      '.gk-field-form{display:flex;gap:8px;margin-top:8px;}',
      '.gk-field-input{flex:1;padding:10px 14px;border:1px solid #e2e8f0;border-radius:12px;font-size:13px;outline:none;}',
      '.gk-field-input:focus{border-color:#be1e2d;}',
      '.gk-field-btn{padding:10px 16px;background:#be1e2d;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;}',
      '#gk-typing{display:none;align-items:center;gap:6px;padding:0 14px 4px;font-size:12px;color:#94a3b8;}',
      '#gk-input-area{display:flex;gap:8px;padding:12px 14px;border-top:1px solid #f1f5f9;}',
      '#gk-input{flex:1;padding:11px 14px;border:1px solid #e2e8f0;border-radius:14px;font-size:13.5px;outline:none;}',
      '#gk-input:focus{border-color:#be1e2d;}',
      '#gk-send{width:42px;height:42px;border-radius:50%;background:#be1e2d;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '#gk-send svg{width:18px;height:18px;}',
    ].join('');
    document.head.appendChild(css);
  }

  // ─── Build DOM ───────────────────────────────────────────────────────────
  function buildWidget() {
    if (document.getElementById('gk-root')) return;
    injectStyles();

    var root = document.createElement('div');
    root.id = 'gk-root';
    root.innerHTML = [
      '<div id="gk-window">',
        '<div id="gk-header">',
          '<div id="gk-header-avatar">P</div>',
          '<div id="gk-header-info">',
            '<div id="gk-header-name">Priya — Gradiks Advisor</div>',
            '<div id="gk-header-status">Typically replies in minutes</div>',
          '</div>',
          '<button id="gk-close-btn">',
            '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
          '</button>',
        '</div>',
        '<div id="gk-messages"></div>',
        '<div id="gk-typing"><span>Priya is typing</span></div>',
        '<div id="gk-input-area">',
          '<input id="gk-input" type="text" placeholder="Ask me anything..." autocomplete="off">',
          '<button id="gk-send" aria-label="Send">',
            '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
          '</button>',
        '</div>',
      '</div>',
      '<div id="gk-bubble" title="Chat with Gradiks">',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">',
          '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>',
        '</svg>',
        '<div id="gk-unread">0</div>',
      '</div>',
    ].join('');
    document.body.appendChild(root);

    document.getElementById('gk-bubble').onclick = openWidget;
    document.getElementById('gk-close-btn').onclick = closeWidget;
    document.getElementById('gk-send').onclick = handleSend;
    document.getElementById('gk-input').onkeydown = function (e) {
      if (e.key === 'Enter') handleSend();
    };
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }
})();
