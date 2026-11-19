/* app.js - UX: live IBAN validation, smart amount formatting, conflict highlight,
   live byte counter, tooltips, dark mode toggle, i18n, IBAN spacing */

let LANG = "en";
let hasQR = false;
const FORM_FIELD_IDS = ["name","iban","amount","rem_unstruct","rem_struct","purpose","bic","b2o","version","charset"];
const USER_PAYMENT_FIELD_IDS = ["name","iban","amount","rem_unstruct","rem_struct","purpose","bic","b2o"];
const SAVED_PAYMENTS_STORAGE_KEY = "epcQrSavedPayments.v1";
const SAVED_PAYMENTS_LIMIT = 100;

// Additional locales (separate files in assets/i18n/)
const OPTIONAL_LOCALES = ["de"];

// Derive human readable language names without hardcoding a fragile table
function languageLabel(code){
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'language' });
    const name = dn.of(code);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

// ---------- i18n helpers ----------
function ensureI18N(){
  if (!window.I18N) window.I18N = {};
  if (!window.I18N.en) {
    // Minimal inline EN fallback if i18n-core.js failed
    window.I18N.en = {
      title:"EPC QR Code Offline Generator", paymentData:"Payment details", advanced:"Advanced (optional)",
      l_name:"Recipient (name)", l_iban:"IBAN", l_amount:"Amount in EUR", l_unstruct:"Payment reference",
      l_struct:"Structured reference", h_struct:"Use only if no payment reference (free text) is provided.",
      l_purpose:"Purpose code (optional)", h_purpose:"Standardized four-letter codes (e.g., GDDS, SALA, CHAR).",
      l_bic:"BIC (only in special cases)", l_b2o:"Note to originator", l_version:"Version", l_charset:"Character set",
      h_limit:"Maximum payload 331 bytes. No extra line break after the last field.",
      btn_gen:"Generate QR code", btn_ex:"Example data",
      saved_payments:"Saved payment references", saved_select_placeholder:"Select a saved reference...",
      saved_search_label:"Search saved references", saved_search_placeholder:"Search by name, IBAN or reference",
      saved_name_label:"Name to save under", saved_name_placeholder:"e.g., Monthly rent",
      saved_no_matches:"No saved references match the search.",
      saved_hint:"Saved locally in this browser only.", btn_save_new_reference:"Save as new",
      btn_duplicate_reference:"Duplicate selected", btn_update_reference:"Update selected", btn_delete_reference:"Delete selected",
      btn_export_references:"Export JSON", btn_import_references:"Import JSON",
      copy_word:"copy",
      status_reference_loaded:'Loaded saved reference "{label}".', status_reference_saved:'Saved reference "{label}".',
      status_reference_duplicated:'Duplicated saved reference as "{label}".',
      status_reference_updated:'Updated saved reference "{label}".', status_reference_deleted:'Deleted saved reference "{label}".',
      status_references_exported:'Exported {count} saved reference(s).', status_references_imported:'Imported {count} saved reference(s).',
      err_reference_empty:"Enter payment details before saving a reference.",
      err_reference_name:"Please enter a name to save this payment under.",
      err_reference_exists:"A saved reference with this name already exists. Use Update selected or choose another name.",
      err_reference_select:"Select a saved reference first.",
      err_reference_storage:"Could not access local storage in this browser.",
      err_reference_missing:"The selected saved reference could not be found.",
      err_import_file:"Please select a JSON file.", err_import_json:"The selected file does not contain valid saved payment references.",
      confirm_reference_overwrite:'A saved reference named "{label}" already exists. Overwrite it?',
      confirm_reference_delete:'Delete saved reference "{label}"?',
      theme_dark:"Dark", theme_light:"Light",
      hint_iban_ok:"IBAN looks valid.", hint_iban_bad:"IBAN is invalid.", hint_amount_fmt:"Will be formatted to two decimals on generate.",
      live_checks:"Live checks:", live_ok:"OK", live_conflict:"Conflict: use either Structured reference OR Payment reference.",
      tooltip_struct:"Use RF creditor reference (ISO 11649). If you set this, leave Payment reference empty.",
      tooltip_purpose:"Standard code like GDDS (goods), SALA (salary), CHAR (charity). Optional.",
      totalBytes:"Total bytes:", qrInfo:"QR info:", details:"Show details (EPC payload)", lf:"Line breaks are shown as \\n.",
      placeholders:{ name:"e.g., Example GmbH", iban:"DE89 3704 0044 0532 0130 00", amount:"12.34", unstruct:"Invoice 4711, Customer 123", struct:"e.g., RF18XXXX", purpose:"e.g., GDDS", bic:"usually empty in EU", b2o:"optional" },
      exdata:{ name:"Example GmbH", iban:"DE71 1102 2033 0123 4567 89", amount:"12.30", unstruct:"Invoice 4711", struct:"", purpose:"", bic:"", b2o:"" },
      status_ok:"QR code created. Scan with your banking app.", status_prefill:"Example data filled. Click 'Generate QR code'.",
      err_name:"Recipient is required.", err_iban:"IBAN is invalid.", err_purpose:"Purpose code must be 1-4 alphanumeric characters.", err_bic:"Invalid BIC format.", err_amount_min:"Invalid amount: at least 0.01 EUR.",
      err_len:(b)=>`Text too long: payload exceeds 331 bytes (${b}). Please shorten.`, err_qrlib:"QR library not loaded. Ensure assets/qrcode.min.js exists and is loaded before app.js.",
      footer_offline:"This page works fully offline. Just open index.html."
    };
  }
}
function t(){ ensureI18N(); return window.I18N[LANG] || window.I18N.en; }

function loadLocale(lang){
  ensureI18N();
  if (window.I18N[lang]) return Promise.resolve(true);
  if (!OPTIONAL_LOCALES.includes(lang)) return Promise.resolve(false);
  return new Promise((resolve)=>{
    const s = document.createElement('script');
    s.src = `./assets/i18n/${lang}.js`;
    s.async = true;
    s.onload = ()=> { try{ stripLocaleTitles(); }catch{} resolve(!!window.I18N[lang]); };
    s.onerror = ()=> resolve(false);
    document.head.appendChild(s);
  });
}
function detectPreferredLang(){
  const stored = localStorage.getItem('lang');
  if (stored) return stored;
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"])
               .map(x => String(x||"").toLowerCase());
  for (const tag of list) {
    const base = tag.split('-')[0];
    if ((window.I18N && window.I18N[base]) || OPTIONAL_LOCALES.includes(base)) return base;
  }
  return "en";
}
function populateLangSelect(current){
  const select = document.getElementById('lang');
  if (!select) return;
  const allCodes = ["en", ...OPTIONAL_LOCALES];
  select.innerHTML = "";
  for (const code of allCodes) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = languageLabel(code);
    if (code === current) opt.selected = true;
    select.appendChild(opt);
  }
  if (!select._bound) {
    select.addEventListener('change', async (e)=>{
      await maybeLoadAndApply(e.target.value);
    });
    select._bound = true;
  }
}
function applyLang(lang){
  try{ stripLocaleTitles(); }catch{}
  LANG = lang;
  const dict = t();
  document.documentElement.lang = lang;

  // Section headings
  // Keep product title constant across languages
  document.getElementById("t_title").textContent = (window.I18N?.en?.title) || "EPC QR Code Offline Generator";
  document.getElementById("t_paymentData").textContent = dict.paymentData;
  document.querySelector("summary#t_advanced").textContent = dict.advanced;

  // Labels (.title spans) & hints
  document.querySelector("#l_name .title").textContent = dict.l_name;
  document.querySelector("#l_iban .title").textContent = dict.l_iban;
  document.querySelector("#l_amount .title").textContent = dict.l_amount;
  document.querySelector("#l_unstruct .title").textContent = dict.l_unstruct;
  document.querySelector("#l_struct .title").textContent = dict.l_struct;
  document.getElementById("h_struct").textContent = dict.h_struct;
  document.querySelector("#l_purpose .title").textContent = dict.l_purpose;
  document.getElementById("h_purpose").textContent = dict.h_purpose;
  document.querySelector("#l_bic .title").textContent = dict.l_bic;
  document.querySelector("#l_b2o .title").textContent = dict.l_b2o;
  document.querySelector("#l_version .title").textContent = dict.l_version;
  document.querySelector("#l_charset .title").textContent = dict.l_charset;
  document.getElementById("h_limit").textContent = dict.h_limit;

  // Buttons
  document.getElementById("gen").textContent = dict.btn_gen;
  document.getElementById("ex").textContent = dict.btn_ex;
  document.getElementById("saveNewReference").textContent = tx('btn_save_new_reference', 'Save as new');
  document.getElementById("duplicateReference").textContent = tx('btn_duplicate_reference', 'Duplicate selected');
  document.getElementById("updateSelectedReference").textContent = tx('btn_update_reference', 'Update selected');
  document.getElementById("deleteReference").textContent = tx('btn_delete_reference', 'Delete selected');
  document.getElementById("exportReferences").textContent = tx('btn_export_references', 'Export JSON');
  document.getElementById("importReferences").textContent = tx('btn_import_references', 'Import JSON');

  // Meta labels
  document.getElementById("t_totalBytes").innerHTML = "<strong>"+dict.totalBytes+"</strong>";
  document.getElementById("t_qrInfo").innerHTML = "<strong>"+dict.qrInfo+"</strong>";
  document.getElementById("t_details").textContent = dict.details;
  document.getElementById("t_lf").textContent = dict.lf;
  document.getElementById("t_liveValidity").innerHTML = "<strong>"+dict.live_checks+"</strong>";

  // Placeholders
  const p = dict.placeholders;
  document.getElementById("name").placeholder = p.name;
  document.getElementById("iban").placeholder = p.iban;
  document.getElementById("amount").placeholder = p.amount;
  document.getElementById("rem_unstruct").placeholder = p.unstruct;
  document.getElementById("rem_struct").placeholder = p.struct;
  document.getElementById("purpose").placeholder = p.purpose;
  document.getElementById("bic").placeholder = p.bic;
  document.getElementById("b2o").placeholder = p.b2o;

  document.getElementById("t_savedPaymentSearch").textContent = tx('saved_search_label', 'Search saved references');
  document.getElementById("t_savedPaymentName").textContent = tx('saved_name_label', 'Name to save under');
  document.getElementById("t_savedPayments").textContent = tx('saved_payments', 'Saved payment references');
  document.getElementById("savedPaymentSearch").placeholder = tx('saved_search_placeholder', 'Search by name, IBAN or reference');
  document.getElementById("savedPaymentName").placeholder = tx('saved_name_placeholder', 'e.g., Monthly rent');
  document.getElementById("h_savedPayments").textContent = tx('saved_hint', 'Saved locally in this browser only.');
  renderSavedPayments(document.getElementById('savedPaymentSelect')?.value || '');

  // Footer
  document.getElementById("f_offline").innerHTML = dict.footer_offline.replace("index.html","<em>index.html</em>");

  // Tooltips
  document.getElementById("qm_struct").title = dict.tooltip_struct;
  document.getElementById("qm_purpose").title = dict.tooltip_purpose;

  // Amount hint
  document.getElementById("amountHint").textContent = dict.hint_amount_fmt;

  // Dark toggle label
  updateThemeButton();

  // Language selector + remember
  populateLangSelect(lang);
  localStorage.setItem('lang', lang);

  // Reformat amount according to new locale rules (space thousands + localized decimal)
  const amountEl = document.getElementById('amount');
  if (amountEl && amountEl.value) {
    const n = parseAmountToNumber(amountEl.value);
    if (isFinite(n)) amountEl.value = formatAmountLocalized(n, lang);
    else amountEl.value = sanitizeAmountValue(amountEl.value);
  }
}
async function maybeLoadAndApply(lang){
  if (!window.I18N?.[lang]) await loadLocale(lang);
  applyLang(window.I18N?.[lang] ? lang : "en");
  clearQR();       // do not show "no QR" message here
  updateLiveUI();  // refresh live checks
}

// ---------- Theme ----------
function updateThemeButton(){
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.textContent = isDark ? t().theme_light : t().theme_dark;
}
function setTheme(mode){
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);
  updateThemeButton();
}
function initTheme(){
  const stored = localStorage.getItem('theme');
  if (stored) { setTheme(stored); return; }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(prefersDark ? 'dark' : 'light');
}

// Remove locale-specific titles; keep only EN base
function stripLocaleTitles(){
  if (!window.I18N) return;
  for (const k of Object.keys(window.I18N)){
    if (k !== 'en' && window.I18N[k] && typeof window.I18N[k] === 'object'){
      try { delete window.I18N[k].title; } catch {}
    }
  }
}

function tx(key, fallback){
  const current = t();
  const en = window.I18N?.en || {};
  return current[key] ?? en[key] ?? fallback;
}
function formatText(template, vars = {}){
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}
function normalizeSavedPaymentData(values = {}){
  const parsedAmount = parseAmountToNumber(values.amount);
  return {
    name: String(values.name || '').trim(),
    iban: ibanClean(values.iban || ''),
    amount: isFinite(parsedAmount) ? parsedAmount.toFixed(2) : sanitizeAmountValue(values.amount || ''),
    rem_unstruct: String(values.rem_unstruct || '').trim(),
    rem_struct: String(values.rem_struct || '').trim().toUpperCase(),
    purpose: String(values.purpose || '').trim().toUpperCase(),
    bic: String(values.bic || '').trim().toUpperCase(),
    b2o: String(values.b2o || '').trim(),
    version: String(values.version || '') === '002' ? '002' : '001',
    charset: /^[1-8]$/.test(String(values.charset || '')) ? String(values.charset) : '1'
  };
}
function normalizeSavedPaymentEntry(entry){
  if (!entry || typeof entry !== 'object') return null;
  const label = String(entry.label || '').trim();
  if (!label) return null;
  return {
    id: String(entry.id || `saved-${Date.now()}-${Math.random().toString(36).slice(2,8)}`),
    label,
    createdAt: entry.createdAt || '',
    updatedAt: entry.updatedAt || '',
    values: normalizeSavedPaymentData(entry.values || {})
  };
}
function loadSavedPayments(){
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_PAYMENTS_STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .map(normalizeSavedPaymentEntry)
      .filter(Boolean)
      .slice(0, SAVED_PAYMENTS_LIMIT)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity:'base' }));
  } catch {
    return [];
  }
}
function persistSavedPayments(items){
  try {
    localStorage.setItem(SAVED_PAYMENTS_STORAGE_KEY, JSON.stringify(items.slice(0, SAVED_PAYMENTS_LIMIT)));
    return true;
  } catch {
    setStatus(tx('err_reference_storage', 'Could not access local storage in this browser.'), false);
    return false;
  }
}
function getSavedPaymentSearchTerm(){
  return String(document.getElementById('savedPaymentSearch')?.value || '').trim().toLowerCase();
}
function getSavedPaymentName(){
  return String(document.getElementById('savedPaymentName')?.value || '').trim();
}
function setSavedPaymentName(value = ''){
  const input = document.getElementById('savedPaymentName');
  if (input) input.value = value;
}
function promptForSavedPaymentName(){
  const input = document.getElementById('savedPaymentName');
  setStatus(tx('err_reference_name', 'Please enter a name to save this payment under.'), false);
  if (input) {
    try { input.focus(); input.select(); } catch {}
  }
}
function filterSavedPayments(items, query){
  if (!query) return items;
  return items.filter((item) => {
    const haystack = [
      item.label,
      item.values?.name,
      item.values?.iban,
      item.values?.rem_unstruct,
      item.values?.rem_struct,
      item.values?.bic,
      item.values?.b2o
    ].filter(Boolean).join('\n').toLowerCase();
    return haystack.includes(query);
  });
}
function ensureSavedPaymentVisible(item){
  if (!item) return;
  const query = getSavedPaymentSearchTerm();
  if (!query) return;
  const visible = filterSavedPayments([item], query).length > 0;
  if (!visible) {
    const searchInput = document.getElementById('savedPaymentSearch');
    if (searchInput) searchInput.value = '';
  }
}
function updateSavedPaymentButtons(){
  const select = document.getElementById('savedPaymentSelect');
  const hasSelection = !!(select && select.value);
  const duplicateBtn = document.getElementById('duplicateReference');
  const updateBtn = document.getElementById('updateSelectedReference');
  const deleteBtn = document.getElementById('deleteReference');
  const exportBtn = document.getElementById('exportReferences');
  if (duplicateBtn) duplicateBtn.disabled = !hasSelection;
  if (updateBtn) updateBtn.disabled = !hasSelection;
  if (deleteBtn) deleteBtn.disabled = !hasSelection;
  if (exportBtn) exportBtn.disabled = !hasSelection;
}
function renderSavedPayments(selectedId = ''){
  const select = document.getElementById('savedPaymentSelect');
  if (!select) return;
  const allItems = loadSavedPayments();
  const filteredItems = filterSavedPayments(allItems, getSavedPaymentSearchTerm());
  const currentValue = selectedId || select.value || '';
  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = filteredItems.length
    ? tx('saved_select_placeholder', 'Select a saved reference...')
    : tx('saved_no_matches', 'No saved references match the search.');
  select.appendChild(placeholder);

  for (const item of filteredItems) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.label;
    option.title = [item.values?.name, item.values?.iban].filter(Boolean).join(' • ');
    select.appendChild(option);
  }

  select.value = filteredItems.some(item => item.id === currentValue) ? currentValue : '';
  updateSavedPaymentButtons();
}

// ---------- Validation & helpers ----------
function ibanClean(s){ return String(s||'').replace(/[\s\-]/g,'').toUpperCase(); }
function ibanIsValid(iban){
  const s = ibanClean(iban);
  if(!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(s)) return false;
  const moved = s.slice(4)+s.slice(0,4);
  const num = moved.replace(/[A-Z]/g, c => (c.charCodeAt(0)-55).toString());
  let rem = 0;
  for (let i=0;i<num.length;i+=7) rem = parseInt(String(rem)+num.substr(i,7),10)%97;
  return rem===1; // ISO 13616 mod-97
}
// --- Amount helpers (locale-specific separators) ---
const DOT_DECIMAL_LANGS = new Set(["en","ga","cy","gd","mt"]);
function getDecimalSeparator(lang){ return DOT_DECIMAL_LANGS.has(lang) ? '.' : ','; }
function parseAmountToNumber(amount){
  const s = String(amount||'').trim().replace(/\s+/g,'');
  // be tolerant: treat comma as decimal when present, else dot
  const normalized = s.includes(',') ? s.replace(',', '.') : s;
  const n = Number(normalized);
  return isFinite(n) ? n : NaN;
}
function formatAmountLocalized(n, lang){
  const dec = getDecimalSeparator(lang);
  const sign = n < 0 ? '-' : '';
  const fixed = Math.abs(n).toFixed(2);
  const [intPart, fracPart] = fixed.split('.');
  // group thousands with spaces
  const g = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return sign + g + (dec + fracPart);
}
function sanitizeAmountValue(value){
  // allow digits, dot, comma; last separator becomes decimal, others removed
  // Examples: "1.234,56" -> "1234.56", "1,234.56" -> "1234.56"
  let s = String(value||'').replace(/\s+/g, '').replace(/[^0-9.,]/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const sepIndex = Math.max(lastDot, lastComma);
  let intPart = s, fracPart = '';
  if (sepIndex !== -1){
    intPart = s.slice(0, sepIndex);
    fracPart = s.slice(sepIndex + 1);
  }
  intPart = intPart.replace(/[.,]/g, '');
  fracPart = fracPart.replace(/[.,]/g, '');
  return sepIndex !== -1 ? intPart + '.' + fracPart : intPart;
}

function formatAmountUIKeepCaret(inputEl, lang){
  const raw = String(inputEl.value||'');
  const caret = inputEl.selectionStart ?? raw.length;
  // Count digits before caret in the original raw input
  const digitsBefore = (raw.slice(0, caret).match(/\d/g) || []).length;
  const rawBefore = raw.slice(0, caret);
  const justTypedDecimal = /[.,]$/.test(rawBefore);

  // Sanitize and normalize
  let s = sanitizeAmountValue(raw); // digits, spaces, single dot as decimal (dot)
  // remove spaces for numeric processing
  s = s.replace(/\s+/g,'');
  // split into int/frac by dot (if any)
  let intPart = s, fracPart = '';
  const dotIdx = s.indexOf('.');
  const hadDot = dotIdx !== -1; // remember if user typed a decimal separator
  if (dotIdx !== -1) {
    intPart = s.slice(0, dotIdx);
    fracPart = s.slice(dotIdx + 1);
  }
  intPart = intPart.replace(/\D/g, '');
  fracPart = fracPart.replace(/\D/g, '');

  // group thousands with spaces
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const dec = getDecimalSeparator(lang);
  // Show decimal separator if user just typed it, even without fractional digits yet
  const formatted = grouped + ((fracPart || hadDot) ? (dec + fracPart) : '');

  // determine new caret position: after same number of digits
  let seen = 0, newCaret = 0;
  for (const ch of formatted) {
    if (/\d/.test(ch)) seen++;
    newCaret++;
    if (seen >= digitsBefore) break;
  }
  if (digitsBefore === 0) newCaret = 0;
  if (digitsBefore > (intPart + fracPart).length) newCaret = formatted.length;
  // If user just entered decimal separator and no fractional digits yet, place caret after separator
  if (justTypedDecimal && fracPart.length === 0 && formatted.includes(dec)) {
    newCaret = formatted.indexOf(dec) + 1;
  }

  inputEl.value = formatted;
  try { inputEl.setSelectionRange(newCaret, newCaret); } catch {}
}
function asEUR(amount){
  if(!amount) return '';
  const n = parseAmountToNumber(amount);
  if(!isFinite(n)||n<0.01) throw new Error(t().err_amount_min);
  return 'EUR'+n.toFixed(2);
}
function formatAmountFieldToTwoDecimals(){
  const el = document.getElementById('amount');
  const n = parseAmountToNumber(el.value);
  if (!isFinite(n)) return;
  el.value = formatAmountLocalized(n, LANG);
}
function getFormValues(){
  return {
    name: document.getElementById('name').value || '',
    iban: document.getElementById('iban').value || '',
    amount: document.getElementById('amount').value || '',
    rem_unstruct: document.getElementById('rem_unstruct').value || '',
    rem_struct: document.getElementById('rem_struct').value || '',
    purpose: document.getElementById('purpose').value || '',
    bic: document.getElementById('bic').value || '',
    b2o: document.getElementById('b2o').value || '',
    version: document.getElementById('version').value,
    charset: document.getElementById('charset').value
  };
}
function hasSaveablePaymentData(values){
  return USER_PAYMENT_FIELD_IDS.some((id) => String(values[id] || '').trim());
}
function generateUniqueSavedPaymentLabel(baseLabel, items){
  const normalizedBase = String(baseLabel || '').trim() || 'Reference';
  const labels = new Set(items.map(item => String(item.label || '').trim().toLowerCase()));
  if (!labels.has(normalizedBase.toLowerCase())) return normalizedBase;

  const copyWord = tx('copy_word', 'copy');
  const escapedCopyWord = copyWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rootLabel = normalizedBase.replace(new RegExp(` \\(${escapedCopyWord}\\)(?: \\d+)?$`, 'i'), '') || normalizedBase;
  const copyBase = `${rootLabel} (${copyWord})`;
  if (!labels.has(copyBase.toLowerCase())) return copyBase;

  let i = 2;
  while (labels.has(`${copyBase} ${i}`.toLowerCase())) i++;
  return `${copyBase} ${i}`;
}
function applyFormValues(values){
  const data = normalizeSavedPaymentData(values || {});
  document.getElementById('name').value = data.name;
  document.getElementById('iban').value = data.iban;
  document.getElementById('amount').value = data.amount
    ? (()=>{
        const n = parseAmountToNumber(data.amount);
        return isFinite(n) ? formatAmountLocalized(n, LANG) : data.amount;
      })()
    : '';
  document.getElementById('rem_unstruct').value = data.rem_unstruct;
  document.getElementById('rem_struct').value = data.rem_struct;
  document.getElementById('purpose').value = data.purpose;
  document.getElementById('bic').value = data.bic;
  document.getElementById('b2o').value = data.b2o;
  document.getElementById('version').value = data.version;
  document.getElementById('charset').value = data.charset;

  const ibanEl = document.getElementById('iban');
  if (ibanEl.value) formatIbanUIKeepCaret(ibanEl);
  clearQR();
  updateLiveUI();
}
function loadSelectedReference(){
  const select = document.getElementById('savedPaymentSelect');
  if (!select) return;
  updateSavedPaymentButtons();
  if (!select.value) return;

  const item = loadSavedPayments().find(entry => entry.id === select.value);
  if (!item) {
    renderSavedPayments('');
    setStatus(tx('err_reference_missing', 'The selected saved reference could not be found.'), false);
    return;
  }

  setSavedPaymentName(item.label);
  applyFormValues(item.values || {});
  setStatus(formatText(tx('status_reference_loaded', 'Loaded saved reference "{label}".'), { label: item.label }), true);
}
function saveNewReference(){
  const values = getFormValues();
  if (!hasSaveablePaymentData(values)) {
    setStatus(tx('err_reference_empty', 'Enter payment details before saving a reference.'), false);
    return;
  }

  const label = getSavedPaymentName();
  if (!label) {
    promptForSavedPaymentName();
    return;
  }

  const items = loadSavedPayments();
  const duplicate = items.find(item => item.label.toLowerCase() === label.toLowerCase());
  if (duplicate) {
    setStatus(tx('err_reference_exists', 'A saved reference with this name already exists. Use Update selected or choose another name.'), false);
    return;
  }

  const now = new Date().toISOString();
  const entry = {
    id: `saved-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    label,
    createdAt: now,
    updatedAt: now,
    values: normalizeSavedPaymentData(values)
  };

  if (!persistSavedPayments([...items, entry])) return;
  ensureSavedPaymentVisible(entry);
  renderSavedPayments(entry.id);
  setSavedPaymentName(entry.label);
  setStatus(formatText(tx('status_reference_saved', 'Saved reference "{label}".'), { label }), true);
}
function duplicateSelectedReference(){
  const select = document.getElementById('savedPaymentSelect');
  if (!select || !select.value) {
    setStatus(tx('err_reference_select', 'Select a saved reference first.'), false);
    return;
  }

  const values = getFormValues();
  if (!hasSaveablePaymentData(values)) {
    setStatus(tx('err_reference_empty', 'Enter payment details before saving a reference.'), false);
    return;
  }

  const items = loadSavedPayments();
  const selectedItem = items.find(item => item.id === select.value);
  if (!selectedItem) {
    renderSavedPayments('');
    setStatus(tx('err_reference_missing', 'The selected saved reference could not be found.'), false);
    return;
  }

  const preferredLabel = getSavedPaymentName() || selectedItem.label;
  const label = generateUniqueSavedPaymentLabel(preferredLabel, items);
  const now = new Date().toISOString();
  const entry = {
    id: `saved-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    label,
    createdAt: now,
    updatedAt: now,
    values: normalizeSavedPaymentData(values)
  };

  if (!persistSavedPayments([...items, entry])) return;

  ensureSavedPaymentVisible(entry);
  renderSavedPayments(entry.id);
  setSavedPaymentName(entry.label);
  setStatus(formatText(tx('status_reference_duplicated', 'Duplicated saved reference as "{label}".'), { label }), true);
}
function updateSelectedReference(){
  const select = document.getElementById('savedPaymentSelect');
  if (!select || !select.value) {
    setStatus(tx('err_reference_select', 'Select a saved reference first.'), false);
    return;
  }

  const values = getFormValues();
  if (!hasSaveablePaymentData(values)) {
    setStatus(tx('err_reference_empty', 'Enter payment details before saving a reference.'), false);
    return;
  }

  const items = loadSavedPayments();
  const selectedItem = items.find(item => item.id === select.value);
  if (!selectedItem) {
    renderSavedPayments('');
    setStatus(tx('err_reference_missing', 'The selected saved reference could not be found.'), false);
    return;
  }

  const label = getSavedPaymentName();
  if (!label) {
    promptForSavedPaymentName();
    return;
  }

  const duplicate = items.find(item => item.label.toLowerCase() === label.toLowerCase() && item.id !== selectedItem.id);
  if (duplicate) {
    const overwrite = window.confirm(formatText(
      tx('confirm_reference_overwrite', 'A saved reference named "{label}" already exists. Overwrite it?'),
      { label }
    ));
    if (!overwrite) return;
  }

  const now = new Date().toISOString();
  const idsToReplace = new Set([selectedItem.id, duplicate?.id].filter(Boolean));
  const entry = {
    id: selectedItem.id,
    label,
    createdAt: selectedItem.createdAt || now,
    updatedAt: now,
    values: normalizeSavedPaymentData(values)
  };

  const nextItems = items.filter(item => !idsToReplace.has(item.id));
  nextItems.push(entry);
  if (!persistSavedPayments(nextItems)) return;

  ensureSavedPaymentVisible(entry);
  renderSavedPayments(entry.id);
  setSavedPaymentName(entry.label);
  setStatus(formatText(tx('status_reference_updated', 'Updated saved reference "{label}".'), { label }), true);
}
function deleteSelectedReference(){
  const select = document.getElementById('savedPaymentSelect');
  if (!select || !select.value) {
    setStatus(tx('err_reference_select', 'Select a saved reference first.'), false);
    return;
  }

  const items = loadSavedPayments();
  const item = items.find(entry => entry.id === select.value);
  if (!item) {
    renderSavedPayments('');
    setStatus(tx('err_reference_missing', 'The selected saved reference could not be found.'), false);
    return;
  }

  const confirmed = window.confirm(formatText(
    tx('confirm_reference_delete', 'Delete saved reference "{label}"?'),
    { label: item.label }
  ));
  if (!confirmed) return;

  if (!persistSavedPayments(items.filter(entry => entry.id !== item.id))) return;
  renderSavedPayments('');
  setSavedPaymentName('');
  setStatus(formatText(tx('status_reference_deleted', 'Deleted saved reference "{label}".'), { label: item.label }), true);
}
function safeFilenamePart(value){
  return String(value || 'reference')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'reference';
}
function getSelectedSavedPayment(){
  const select = document.getElementById('savedPaymentSelect');
  if (!select || !select.value) return null;
  return loadSavedPayments().find(entry => entry.id === select.value) || null;
}
function buildSavedPaymentExport(item){
  return {
    app: 'EPC QR Code Offline Generator',
    schema: SAVED_PAYMENTS_STORAGE_KEY,
    exportedAt: new Date().toISOString(),
    savedPayment: item
  };
}
function downloadJson(payload, filename){
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportSavedPayments(){
  const item = getSelectedSavedPayment();
  if (!item) {
    setStatus(tx('err_reference_select', 'Select a saved reference first.'), false);
    updateSavedPaymentButtons();
    return;
  }

  const payload = buildSavedPaymentExport(item);
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(payload, `epc-qr-${safeFilenamePart(item.label)}-${date}.json`);
  setStatus(formatText(tx('status_references_exported', 'Exported {count} saved reference(s).'), { count: 1 }), true);
}
function parseSavedPaymentsImport(data){
  let rawItems = null;
  if (Array.isArray(data)) rawItems = data;
  else if (Array.isArray(data?.savedPayments)) rawItems = data.savedPayments;
  else if (Array.isArray(data?.items)) rawItems = data.items;
  else if (data?.savedPayment && typeof data.savedPayment === 'object') rawItems = [data.savedPayment];
  else if (data?.label && data?.values && typeof data.values === 'object') rawItems = [data];
  if (!rawItems) return [];

  const seen = new Set();
  return rawItems
    .map(normalizeSavedPaymentEntry)
    .filter(Boolean)
    .filter((item) => {
      const key = `${item.id}\n${item.label.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, SAVED_PAYMENTS_LIMIT);
}
function mergeSavedPayments(existingItems, importedItems){
  const next = existingItems.slice();
  for (const imported of importedItems) {
    const idIndex = next.findIndex(item => item.id === imported.id);
    const labelIndex = next.findIndex(item => item.label.toLowerCase() === imported.label.toLowerCase());
    const replaceIndex = idIndex >= 0 ? idIndex : labelIndex;
    if (replaceIndex >= 0) next[replaceIndex] = imported;
    else next.push(imported);
  }
  return next.slice(0, SAVED_PAYMENTS_LIMIT);
}
async function importSavedPaymentsFromFile(event){
  const input = event?.target;
  const file = input?.files?.[0];
  if (input) input.value = '';
  if (!file) return;

  if (file.name && !file.name.toLowerCase().endsWith('.json')) {
    setStatus(tx('err_import_file', 'Please select a JSON file.'), false);
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    const importedItems = parseSavedPaymentsImport(parsed);
    if (!importedItems.length) throw new Error(tx('err_import_json', 'The selected file does not contain valid saved payment references.'));

    const firstImported = importedItems[0];
    const mergedItems = mergeSavedPayments(loadSavedPayments(), importedItems);
    if (!persistSavedPayments(mergedItems)) return;

    ensureSavedPaymentVisible(firstImported);
    renderSavedPayments(firstImported.id);
    setSavedPaymentName(firstImported.label);
    applyFormValues(firstImported.values || {});
    setStatus(formatText(tx('status_references_imported', 'Imported {count} saved reference(s).'), { count: importedItems.length }), true);
  } catch (err) {
    setStatus(err.message || tx('err_import_json', 'The selected file does not contain valid saved payment references.'), false);
  }
}

// IBAN auto spacing with caret preservation
function formatIbanUIKeepCaret(inputEl){
  const raw = inputEl.value;
  const selStart = inputEl.selectionStart || 0;
  let rawIndex = 0;
  for (let i=0, r=0; i<raw.length && i<selStart; i++){
    if (/\S/.test(raw[i])) r++;
    rawIndex = r;
  }
  const normalized = raw.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  const chunks = normalized.match(/.{1,4}/g) || [];
  const formatted = chunks.join(' ');
  let formattedCaret = 0, seenRaw = 0;
  for (const ch of formatted){
    if (ch !== ' ') { seenRaw++; }
    formattedCaret++;
    if (seenRaw >= rawIndex) break;
  }
  if (selStart === raw.length) formattedCaret = formatted.length;
  inputEl.value = formatted;
  inputEl.setSelectionRange(formattedCaret, formattedCaret);
}

function byteLenUtf8(str){ return new TextEncoder().encode(str).length; }

function collectPayloadFields(v, opts={}){
  const lines = [];
  const draft = opts.draft;
  lines.push('BCD', v.version || '001', v.charset || '1', 'SCT');
  // Ensure BIC is uppercase in the payload
  lines.push(v.bic ? v.bic.trim().toUpperCase() : '');
  lines.push((v.name||'').trim());
  lines.push(ibanClean(v.iban));
  if (draft) {
    const n = parseAmountToNumber(v.amount);
    lines.push(isFinite(n) && n>=0.01 ? 'EUR'+n.toFixed(2) : '');
  } else {
    lines.push(v.amount || '');
  }
  lines.push(v.purpose ? v.purpose.toUpperCase() : '');
  const hasStruct = !!v.rem_struct, hasUnstruct = !!v.rem_unstruct;
  lines.push(hasStruct ? v.rem_struct.trim() : '');
  lines.push(hasUnstruct ? v.rem_unstruct.trim() : '');
  lines.push(v.b2o ? v.b2o.trim() : '');
  return lines;
}

// Build payload "draft" to compute live byte length even if not valid yet
function buildPayloadDraft(){
  const v = {
    name: document.getElementById('name').value || '',
    iban: document.getElementById('iban').value || '',
    amount: document.getElementById('amount').value || '',
    rem_unstruct: document.getElementById('rem_unstruct').value || '',
    rem_struct: document.getElementById('rem_struct').value || '',
    purpose: document.getElementById('purpose').value || '',
    bic: document.getElementById('bic').value || '',
    b2o: document.getElementById('b2o').value || '',
    version: document.getElementById('version').value,
    charset: document.getElementById('charset').value
  };
  const lines = collectPayloadFields(v, {draft:true});
  return lines.join('\n').replace(/(\n)+$/,'');
}

function ensureLimits(payload){
  const bytes = byteLenUtf8(payload);
  if (bytes > 331) throw new Error(t().err_len(bytes));
  return bytes;
}

// ---------- QR rendering ----------
function renderQR(text){
  if (typeof window.QRCode === "undefined") throw new Error(t().err_qrlib);
  const box = document.getElementById('qrcanvas');
  box.innerHTML = '';
  const qr = new QRCode(box, { width:300, height:300, correctLevel: QRCode.CorrectLevel.M });
  if (typeof qr.makeCode === 'function') qr.makeCode(text);
  else {
    box.innerHTML = '';
    new QRCode(box, { text, width:300, height:300, correctLevel: QRCode.CorrectLevel.M });
  }
  hasQR = true;
}
function setStatus(msg, ok=false, warn=false){
  const s = document.getElementById('status');
  s.textContent = msg;
  s.className = 'status ' + (warn? 'warn' : (ok?'ok':'err'));
}

function buildPayload(v){
  const hasStruct = !!v.rem_struct, hasUnstruct = !!v.rem_unstruct;
  if (hasStruct && hasUnstruct)
    throw new Error(LANG==="de"
      ? "Bitte nur EINE Referenz verwenden: entweder 'Strukturiert' ODER 'Verwendungszweck'."
      : "Use only ONE reference: either structured OR free text.");
  const lines = collectPayloadFields({
    ...v,
    amount: v.amount ? asEUR(v.amount) : ''
  });
  return lines.join('\n').replace(/(\n)+$/,'');
}

// --- Safe overrides to normalize previously mis-encoded strings ---
function clearQR(){
  document.getElementById('qrcanvas').innerHTML = '';
  document.getElementById('payload').textContent = '';
  document.getElementById('bytes').textContent = '';
  document.getElementById('liveInfo').textContent = '';
  hasQR = false;
}
function showPayload(payload, bytes){
  document.getElementById('payload').textContent = payload.replace(/\n/g,'\\n\n');
  document.getElementById('bytes').textContent = `${bytes} / 331`;
}

// ---------- Live UX updates ----------
function updateLiveUI(){
  const dict = t();

  // --- IBAN-Validierung (live) ---
  const ibanEl = document.getElementById('iban');
  const ibanHint = document.getElementById('ibanHint');
  const clean = ibanClean(ibanEl.value);

  if (clean.length >= 8) {
    const ok = ibanIsValid(ibanEl.value);
    ibanEl.classList.toggle('is-valid', ok);
    ibanEl.classList.toggle('is-invalid', !ok);
    ibanHint.textContent = ok ? dict.hint_iban_ok : dict.hint_iban_bad;
  } else {
    ibanEl.classList.remove('is-valid','is-invalid');
    ibanHint.textContent = '';
  }

  // --- Conflict: structured reference vs. payment reference ---
  const unstructEl = document.getElementById('rem_unstruct');
  const structEl   = document.getElementById('rem_struct');
  const conflict = !!unstructEl.value.trim() && !!structEl.value.trim();
  const liveInfo = document.getElementById('liveInfo');

  // Reset first
  unstructEl.classList.remove('is-invalid');
  structEl.classList.remove('is-invalid');

  if (conflict) {
    // Beide rot hervorheben (Fehlerzustand hat via CSS Fokus-Prio)
    unstructEl.classList.add('is-invalid');
    structEl.classList.add('is-invalid');

    liveInfo.textContent = dict.live_conflict;
    setStatus(dict.live_conflict, false, true);
  } else {
    liveInfo.textContent = dict.live_ok;
    // Clear warning status if it only came from the conflict
    const s = document.getElementById('status');
    if (s.classList.contains('warn')) setStatus('');
  }

  // --- Live byte counter based on draft payload ---
  try {
    const draft = buildPayloadDraft();
    const bytes = byteLenUtf8(draft);
    document.getElementById('bytes').textContent = `${bytes} / 331`;
  } catch {
    document.getElementById('bytes').textContent = '';
  }
}

// Debounced live UI updates to avoid excessive re-renders while typing
let _liveUITimer = null;
function queueLiveUI(delayMs = 120){
  try { clearTimeout(_liveUITimer); } catch {}
  _liveUITimer = setTimeout(updateLiveUI, delayMs);
}


// ---------- Events ----------
document.getElementById('gen').addEventListener('click', ()=>{
  try{
    // normalize amount visually
    const amountEl = document.getElementById('amount');
    // sanitize current value according to language rules
    amountEl.value = sanitizeAmountValue(amountEl.value);
    const n = parseAmountToNumber(amountEl.value);
    if (isFinite(n)) amountEl.value = formatAmountLocalized(n, LANG);

    const v = {
      name: document.getElementById('name').value || '',
      iban: document.getElementById('iban').value || '',
      amount: document.getElementById('amount').value || '',
      rem_unstruct: document.getElementById('rem_unstruct').value || '',
      rem_struct: document.getElementById('rem_struct').value || '',
      purpose: document.getElementById('purpose').value || '',
      bic: document.getElementById('bic').value || '',
      b2o: document.getElementById('b2o').value || '',
      version: document.getElementById('version').value,
      charset: document.getElementById('charset').value
    };

    const dict = t();
    if(!v.name.trim()) throw new Error(dict.err_name);
    if(!ibanIsValid(v.iban)) throw new Error(dict.err_iban);
    if(v.purpose && !/^[A-Za-z0-9]{1,4}$/.test(v.purpose)) throw new Error(dict.err_purpose);
    // Enforce uppercase BIC: convert in UI; validate uppercase pattern here
    if(v.bic && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v.bic)) throw new Error(dict.err_bic);

    const payload = buildPayload(v);
    const bytes = ensureLimits(payload);

    renderQR(payload);
    showPayload(payload, bytes);
    setStatus(dict.status_ok, true);
  }catch(err){
    setStatus(err.message || String(err), false);
    console.error(err);
  }
});

document.getElementById('savedPaymentSearch').addEventListener('input', ()=>{
  renderSavedPayments(document.getElementById('savedPaymentSelect')?.value || '');
});
document.getElementById('savedPaymentSelect').addEventListener('change', loadSelectedReference);
document.getElementById('saveNewReference').addEventListener('click', saveNewReference);
document.getElementById('duplicateReference').addEventListener('click', duplicateSelectedReference);
document.getElementById('updateSelectedReference').addEventListener('click', updateSelectedReference);
document.getElementById('deleteReference').addEventListener('click', deleteSelectedReference);
document.getElementById('exportReferences').addEventListener('click', exportSavedPayments);
document.getElementById('importReferences').addEventListener('click', ()=> document.getElementById('importReferencesFile').click());
document.getElementById('importReferencesFile').addEventListener('change', importSavedPaymentsFromFile);

// Example data
document.getElementById('ex').addEventListener('click', ()=>{
  const dict = t();
  const ex = dict.exdata;
  const map = {
    name: ex.name, iban: ex.iban, amount: ex.amount,
    rem_unstruct: ex.unstruct, rem_struct: ex.struct, purpose: ex.purpose,
    bic: ex.bic, b2o: ex.b2o
  };
  for (const id in map) { const el = document.getElementById(id); if (el) el.value = map[id]; }
  const ibanEl = document.getElementById('iban'); if (ibanEl && ibanEl.value) formatIbanUIKeepCaret(ibanEl);
  clearQR();
  setStatus(dict.status_prefill, true);
  updateLiveUI();
});

// Input reactions: clear QR, IBAN spacing, live checks
for (const id of FORM_FIELD_IDS) {
  const el = document.getElementById(id);
  if (!el) continue;
  el.addEventListener("input", ()=>{
    if (id === "iban") formatIbanUIKeepCaret(el);
    if (id === "amount") formatAmountUIKeepCaret(el, LANG);
    if (id === "bic" || id === "rem_struct") {
      const pos = el.selectionStart;
      el.value = String(el.value||"").toUpperCase();
      if (typeof pos === 'number') try{ el.setSelectionRange(pos, pos); }catch{}
    }
    if (hasQR) clearQR();
    queueLiveUI();
  });
  if (id === "amount") el.addEventListener("blur", formatAmountFieldToTwoDecimals);
}

// Theme toggle
document.getElementById('themeToggle').addEventListener('click', ()=>{
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

// ---------- Init ----------
(function init(){
  ensureI18N();
  initTheme();
  const pref = detectPreferredLang();
  populateLangSelect(pref);
  if (!window.I18N[pref] && OPTIONAL_LOCALES.includes(pref)) {
    loadLocale(pref).then(()=> applyLang(window.I18N[pref] ? pref : "en"));
  } else {
    applyLang(window.I18N[pref] ? pref : "en");
  }
  // Accessibility and validation attributes (avoid relying on possibly corrupted inline HTML)
  try {
    // Fix base EN strings if source encoding ever got mangled
    const en = window.I18N && window.I18N.en;
    const statusEl = document.getElementById('status');
    if (statusEl) { statusEl.setAttribute('role','status'); statusEl.setAttribute('aria-live','polite'); }
    const ibanEl = document.getElementById('iban');
    if (ibanEl) {
      ibanEl.setAttribute('autocapitalize','characters');
      ibanEl.setAttribute('inputmode','text');
      ibanEl.setAttribute('pattern','^[A-Z]{2}[0-9]{2}[A-Z0-9 ]{0,30}$');
      ibanEl.setAttribute('title','Starts with country code + 2 digits; letters/digits, spaces allowed');
    }
    const structEl = document.getElementById('rem_struct');
    if (structEl) {
      structEl.setAttribute('autocapitalize','characters');
      structEl.setAttribute('pattern','^RF[0-9]{2}[A-Z0-9]{1,21}$');
      structEl.setAttribute('title','RF + 2 digits + 1-21 letters/digits (no spaces)');
    }
  } catch {}
  const ibanEl = document.getElementById('iban');
  if (ibanEl && ibanEl.value) formatIbanUIKeepCaret(ibanEl);
  clearQR(); // start disabled
  updateLiveUI();
})();


