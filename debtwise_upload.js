/* debtwise_upload.js — sanction letter extraction logic */

// ── State ─────────────────────────────────────────────────
let currentFile = null;
let extractedData = {};

// ── API key management ────────────────────────────────────
function getApiKey() {
  return localStorage.getItem('dw_api_key') || '';
}
function saveApiKey() {
  const val = document.getElementById('api-key-input').value.trim();
  if (!val) return;
  localStorage.setItem('dw_api_key', val);
  document.getElementById('api-key-input').value = val;
  showToast('API key saved');
}
function initApiKeyField() {
  const saved = getApiKey();
  if (saved) {
    document.getElementById('api-key-input').value = saved;
  }
}

// ── File handling ─────────────────────────────────────────
function handleDrag(e, over) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.toggle('dragover', over);
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f) startProcessing(f);
}
function handleFile(f) {
  if (f) startProcessing(f);
}
function triggerCamera() {
  // On mobile this will open the camera; on desktop, the file picker
  const input = document.getElementById('file-input');
  input.setAttribute('capture', 'environment');
  input.click();
}

// ── Processing flow ───────────────────────────────────────
function startProcessing(file) {
  currentFile = file;
  const isPdf = file.name.toLowerCase().endsWith('.pdf');

  document.getElementById('preview-filename').textContent = file.name;
  document.getElementById('preview-filesize').textContent =
    (file.size / 1024 / 1024).toFixed(1) + ' MB · ' + (isPdf ? 'PDF document' : 'Image file');
  document.getElementById('preview-file-icon').className =
    isPdf ? 'ti ti-file-type-pdf' : 'ti ti-photo';

  showView('processing-view');
  resetStepIndicators();
  runExtraction(file);
}

function resetStepIndicators() {
  setStep('s1', 'done');
  setStep('s2', 'spinning');
  setStep('s3', 'pending');
  setStep('s4', 'pending');
}

function setStep(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  if (state === 'done') {
    el.className = 'step-circle done';
    el.innerHTML = '<i class="ti ti-check" style="font-size:14px" aria-hidden="true"></i>';
  } else if (state === 'spinning') {
    el.className = 'step-circle active';
    el.innerHTML = '<div class="spinner"></div>';
  } else if (state === 'pending') {
    el.className = 'step-circle';
    el.innerHTML = '<i class="ti ti-dots" style="font-size:14px" aria-hidden="true"></i>';
  } else if (state === 'error') {
    el.className = 'step-circle';
    el.style.background = '#FCEBEB';
    el.style.borderColor = '#E24B4A';
    el.style.color = '#A32D2D';
    el.innerHTML = '<i class="ti ti-x" style="font-size:14px" aria-hidden="true"></i>';
  }
}

async function runExtraction(file) {
  const apiKey = getApiKey();
  if (!apiKey) {
    showError(
      'API key not set',
      'Please enter your Anthropic API key above. It is stored only in your browser and never sent anywhere except directly to the Anthropic API.'
    );
    return;
  }

  try {
    // Step 2 — reading document
    setStep('s2', 'spinning');
    updateStepDesc('s2-desc', 'Reading and encoding your document…');

    const base64 = await fileToBase64(file);
    const mediaType = getMediaType(file);

    // Step 3 — AI extraction
    await delay(600);
    setStep('s2', 'done');
    setStep('s3', 'spinning');
    updateStepDesc('s3-desc', 'Sending to Claude AI for field extraction…');

    const result = await callClaudeAPI(base64, mediaType, file.name);

    // Step 4 — verification
    setStep('s3', 'done');
    setStep('s4', 'spinning');
    updateStepDesc('s4-desc', 'Verifying extracted values…');
    await delay(500);
    setStep('s4', 'done');

    extractedData = result;
    await delay(300);
    showResults(result);

  } catch (err) {
    console.error('Extraction error:', err);
    showError(
      'Extraction failed',
      err.message || 'Something went wrong while reading your document. Please try again or enter the details manually.'
    );
  }
}

// ── Claude API call ───────────────────────────────────────
async function callClaudeAPI(base64Data, mediaType, filename) {
  const apiKey = getApiKey();

  const systemPrompt = `You are a document parser specialised in Indian bank sanction letters and loan offer letters.
Extract loan details from the uploaded document and return ONLY a valid JSON object — no markdown, no explanation, no preamble.

JSON schema (all fields optional — use null if not found or not clear):
{
  "lender": string or null,          // Bank or NBFC name (e.g. "HDFC Bank", "Bajaj Finance")
  "loanType": string or null,        // e.g. "Home Loan", "Personal Loan", "Vehicle Loan", "Business Loan", "Loan Against Property"
  "sanctionedAmount": number or null, // Numeric rupee amount (no commas, no ₹ symbol)
  "disbursedAmount": number or null,  // If different from sanctioned; null otherwise
  "interestRate": number or null,     // Annual rate as a number e.g. 8.75 (not "8.75%")
  "rateType": string or null,         // "Fixed" or "Floating" or null
  "emiAmount": number or null,        // Monthly EMI in rupees as a number
  "tenureMonths": number or null,     // Total tenure in months as a number
  "firstEmiDate": string or null,     // ISO date string YYYY-MM-DD if found, else null
  "processingFee": number or null,    // If mentioned
  "borrowerName": string or null,
  "confidence": {                     // Your confidence for each field: "high", "low", or "missing"
    "lender": string,
    "loanType": string,
    "sanctionedAmount": string,
    "disbursedAmount": string,
    "interestRate": string,
    "rateType": string,
    "emiAmount": string,
    "tenureMonths": string,
    "firstEmiDate": string,
    "processingFee": string,
    "borrowerName": string
  }
}

Rules:
- Return ONLY the JSON object. No markdown fences. No text before or after.
- If a field is genuinely not present in the document, set it to null and confidence to "missing".
- Never guess or hallucinate values. If unsure, set null with confidence "low".
- Amounts should be plain numbers: 1900000 not "19,00,000" or "₹19 Lakh".
- Tenure: always convert to months (e.g. 20 years = 240 months).`;

  const userContent = [
    {
      type: 'text',
      text: `Please extract loan details from this sanction letter: ${filename}`
    }
  ];

  // Attach document — PDF or image
  if (mediaType === 'application/pdf') {
    userContent.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64Data }
    });
  } else {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64Data }
    });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    })
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = errBody?.error?.message || `API error ${response.status}`;
    // Surface auth errors clearly
    if (response.status === 401) throw new Error('Invalid API key. Please check and update it above.');
    if (response.status === 400 && msg.includes('credit')) throw new Error('Your Anthropic account has no credits. Please top up at console.anthropic.com.');
    throw new Error(msg);
  }

  const data = await response.json();
  const text = data.content.map(b => b.text || '').join('').trim();

  // Strip any accidental markdown fences
  const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Could not parse AI response as JSON. Please try again.');
  }
  return parsed;
}

// ── Render results ────────────────────────────────────────
function showResults(data) {
  showView('results-view');

  const fields = [
    { key: 'lender',           label: 'Bank / Lender',        type: 'text',   placeholder: 'e.g. HDFC Bank' },
    { key: 'loanType',         label: 'Loan type',            type: 'text',   placeholder: 'e.g. Home Loan' },
    { key: 'sanctionedAmount', label: 'Sanctioned amount (₹)',type: 'number', placeholder: 'e.g. 1900000' },
    { key: 'interestRate',     label: 'Interest rate (%)',    type: 'number', placeholder: 'e.g. 8.75' },
    { key: 'emiAmount',        label: 'EMI amount (₹)',       type: 'number', placeholder: 'e.g. 28500' },
    { key: 'tenureMonths',     label: 'Tenure (months)',      type: 'number', placeholder: 'e.g. 240' },
    { key: 'rateType',         label: 'Rate type',            type: 'text',   placeholder: 'Fixed / Floating' },
    { key: 'processingFee',    label: 'Processing fee (₹)',   type: 'number', placeholder: 'if mentioned' },
  ];
  const fullWidthFields = [
    { key: 'borrowerName',  label: 'Borrower name',     type: 'text', placeholder: 'As on the letter' },
    { key: 'firstEmiDate',  label: 'First EMI due date', type: 'date', placeholder: '' },
  ];

  const conf = data.confidence || {};
  let foundCount = 0;
  let warnCount = 0;
  let warnMessages = [];

  function renderField(f, fullWidth = false) {
    const rawVal = data[f.key];
    const c = conf[f.key] || (rawVal !== null && rawVal !== undefined ? 'high' : 'missing');
    const isEmpty = rawVal === null || rawVal === undefined || rawVal === '';

    if (!isEmpty) foundCount++;
    if (c === 'low') { warnCount++; warnMessages.push(f.label); }

    let displayVal = '';
    let inputClass = '';
    let confidenceHtml = '';

    if (isEmpty) {
      displayVal = '';
      inputClass = 'field-input empty';
      confidenceHtml = `<div class="confidence-tag c-empty"><i class="ti ti-minus" style="font-size:10px"></i> Not found</div>`;
    } else if (c === 'low') {
      displayVal = rawVal;
      inputClass = 'field-input warn';
      confidenceHtml = `<div class="confidence-tag c-low"><i class="ti ti-alert-triangle" style="font-size:10px"></i> Please verify</div>`;
    } else {
      displayVal = rawVal;
      inputClass = 'field-input ok';
      confidenceHtml = `<div class="confidence-tag c-high"><i class="ti ti-check" style="font-size:10px"></i> Extracted</div>`;
    }

    const inputPlaceholder = isEmpty ? f.placeholder : '';
    const inputVal = isEmpty ? '' : displayVal;

    const inputEl = f.type === 'date'
      ? `<input type="date" class="${inputClass}" id="field-${f.key}" value="${inputVal}" ${isEmpty ? '' : ''} />`
      : `<input type="${f.type}" class="${inputClass}" id="field-${f.key}" value="${inputVal}" placeholder="${inputPlaceholder}" step="${f.type === 'number' ? 'any' : ''}" />`;

    return `<div class="field-item ${fullWidth ? 'field-full' : ''}">
      <div class="field-label">${f.label}</div>
      ${inputEl}
      ${confidenceHtml}
    </div>`;
  }

  const gridHtml = fields.map(f => renderField(f)).join('');
  const fullHtml = fullWidthFields.map(f => renderField(f, true)).join('');

  document.getElementById('field-grid').innerHTML = gridHtml;
  document.getElementById('field-full-area').innerHTML = fullHtml;

  const totalFields = fields.length + fullWidthFields.length;

  // Banner
  if (foundCount === 0) {
    document.getElementById('result-banner').innerHTML = `
      <div class="partial-banner">
        <i class="ti ti-alert-triangle" aria-hidden="true"></i>
        <div>
          <div class="partial-text">No fields could be extracted</div>
          <div class="partial-sub">The document may not be a sanction letter. Please fill in the details manually.</div>
        </div>
      </div>`;
  } else if (warnCount > 0 || foundCount < totalFields) {
    const missing = totalFields - foundCount;
    document.getElementById('result-banner').innerHTML = `
      <div class="partial-banner">
        <i class="ti ti-alert-circle" aria-hidden="true"></i>
        <div>
          <div class="partial-text">Partially extracted — ${foundCount} of ${totalFields} fields found</div>
          <div class="partial-sub">${missing > 0 ? missing + ' field' + (missing > 1 ? 's' : '') + ' not found — please fill them in. ' : ''}${warnCount > 0 ? 'Verify: ' + warnMessages.join(', ') + '.' : ''}</div>
        </div>
      </div>`;
  } else {
    document.getElementById('result-banner').innerHTML = `
      <div class="success-banner">
        <i class="ti ti-circle-check" aria-hidden="true"></i>
        <div>
          <div class="success-text">Letter read successfully</div>
          <div class="success-sub">All ${totalFields} fields extracted — please review before saving.</div>
        </div>
      </div>`;
  }

  // Warning row inside card
  if (warnCount > 0) {
    document.getElementById('field-warning').innerHTML = `
      <div class="warning-row">
        <i class="ti ti-alert-triangle" aria-hidden="true"></i>
        <span>Some fields had low confidence. Please double-check: <strong>${warnMessages.join(', ')}</strong>.</span>
      </div>`;
  } else {
    document.getElementById('field-warning').innerHTML = '';
  }
}

// ── Save loan ─────────────────────────────────────────────
function saveLoanAndRedirect() {
  const lender        = fieldVal('lender');
  const loanType      = fieldVal('loanType');
  const sanctioned    = parseFloat(fieldVal('sanctionedAmount')) || 0;
  const rate          = parseFloat(fieldVal('interestRate')) || 0;
  const emi           = parseFloat(fieldVal('emiAmount')) || 0;
  const tenureMonths  = parseInt(fieldVal('tenureMonths')) || 0;
  const firstEmiDate  = fieldVal('firstEmiDate') || null;

  if (!lender && !loanType) {
    showToast('Please fill in at least the lender and loan type.');
    return;
  }
  if (sanctioned <= 0) {
    showToast('Please enter a valid loan amount.');
    return;
  }

  const loan = {
    type:        loanType  || 'Loan',
    lender:      lender    || 'Unknown',
    outstanding: sanctioned,
    original:    sanctioned,
    emi:         emi       || 0,
    rate:        rate      || 0,
    dueDate:     firstEmiDate
  };

  const loans = JSON.parse(localStorage.getItem('dw_loans') || '[]');
  loans.push(loan);
  localStorage.setItem('dw_loans', JSON.stringify(loans));

  window.location.href = 'debtwise_dashboard.html';
}

function fieldVal(key) {
  const el = document.getElementById('field-' + key);
  return el ? el.value.trim() : '';
}

// ── Error view ────────────────────────────────────────────
function showError(title, message) {
  showView('error-view');
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-msg').textContent = message;
}

// ── Utilities ─────────────────────────────────────────────
function showView(viewId) {
  ['upload-view', 'processing-view', 'results-view', 'error-view'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === viewId ? 'block' : 'none';
  });
}

function resetUpload() {
  currentFile = null;
  extractedData = {};
  document.getElementById('file-input').value = '';
  // Remove capture attribute so regular file picker works next time on desktop
  document.getElementById('file-input').removeAttribute('capture');
  showView('upload-view');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

function getMediaType(file) {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop().toLowerCase();
  const map = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  return map[ext] || 'application/octet-stream';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function updateStepDesc(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#111814;color:#fff;font-size:13px;padding:9px 16px;border-radius:8px;z-index:999;white-space:nowrap;opacity:0;transition:opacity 0.2s';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initApiKeyField();
  document.querySelector('.back-btn').addEventListener('click', () => {
    window.location.href = 'debtwise_dashboard.html';
  });
});
