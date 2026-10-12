/* DebtWise — shared loan model, validation, storage and calculations.
 *
 * No UI in here. Every screen loads this one file so the rules live in one place.
 *
 * A stored loan looks like:
 *   {
 *     id:          'ln_…'            unique id
 *     type:        'Home loan'       one of LOAN_TYPES
 *     lender:      'HDFC Bank'
 *     amount:      1900000           original loan amount (₹)
 *     outstanding: 1480000           what is still owed today (₹)
 *     rate:        8.75              annual interest rate (%)
 *     emi:         28500             monthly instalment (₹)
 *     tenure:      240               total tenure (months)
 *     startDate:   '2022-04-05'      loan start date (YYYY-MM-DD)
 *     nextDue:     '2026-06-15'      next EMI date (YYYY-MM-DD)
 *     lastPaidOn:  null | '2026-06-03'   set when the user marks an EMI paid
 *     createdAt:   ISO timestamp
 *     isSample:    true              only on loans created by sampleLoans()
 *   }
 *
 * Loans are kept in localStorage under 'dw_loans' as a JSON array. localStorage is
 * per-browser and per-device, so nothing syncs between devices.
 */
(function (root) {
  'use strict';

  const KEY = 'dw_loans';
  const LOAN_TYPES = ['Personal loan', 'Home loan', 'Vehicle loan', 'Business loan'];
  const DUE_SOON_DAYS = 7;

  /* ---------- dates (all 'YYYY-MM-DD' strings, local time) ---------- */
  const pad = n => String(n).padStart(2, '0');
  function toDateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return toDateStr(new Date()); }
  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return (d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3]) ? d : null;
  }
  function daysBetween(a, b) {
    const A = parseDate(a), B = parseDate(b);
    return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) -
                       Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000);
  }
  function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d); }
  // Keeps the day of month where it exists, otherwise clamps (31 Jan + 1 month = 28/29 Feb).
  function addMonths(s, n) {
    const d = parseDate(s), day = d.getDate();
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(day, last));
    return toDateStr(t);
  }

  /* ---------- money maths ---------- */
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
  // Interest accrued in one month on the current balance.
  function monthlyInterest(outstanding, annualRate) { return outstanding * annualRate / 100 / 12; }
  // How one EMI splits between interest and principal at the current balance.
  function splitEmi(loan) {
    const interest = Math.min(loan.emi, Math.round(monthlyInterest(loan.outstanding, loan.rate)));
    return { interest: interest, principal: loan.emi - interest };
  }
  function repaidPercent(loan) {
    if (!(loan.amount > 0)) return 0;
    return Math.max(0, Math.min(100, Math.round((1 - loan.outstanding / loan.amount) * 100)));
  }

  /* ---------- status, totals, next due ---------- */
  // 'paid' | 'overdue' | 'due-soon' | 'upcoming'
  function statusOf(loan, today) {
    today = today || todayStr();
    if (loan.lastPaidOn && loan.lastPaidOn.slice(0, 7) === today.slice(0, 7)) return 'paid';
    const d = daysBetween(today, loan.nextDue);
    if (d < 0) return 'overdue';
    if (d <= DUE_SOON_DAYS) return 'due-soon';
    return 'upcoming';
  }
  function totals(loans, today) {
    today = today || todayStr();
    const t = { count: loans.length, totalAmount: 0, totalOutstanding: 0, repaidPercent: 0, monthlyEmi: 0, overdue: 0, dueSoon: 0, needAttention: 0 };
    loans.forEach(l => {
      t.totalAmount += l.amount;
      t.totalOutstanding += l.outstanding;
      t.monthlyEmi += l.emi;
      const s = statusOf(l, today);
      if (s === 'overdue') t.overdue++;
      if (s === 'due-soon') t.dueSoon++;
    });
    t.needAttention = t.overdue + t.dueSoon;
    t.repaidPercent = t.totalAmount > 0 ? Math.max(0, Math.min(100, Math.round((1 - t.totalOutstanding / t.totalAmount) * 100))) : 0;
    return t;
  }
  // The "Next due" tile needs two separate answers: what is already late, and what is coming.
  // Past dates never count as "next".
  function nextDueInfo(loans, today) {
    today = today || todayStr();
    const overdue = loans.filter(l => statusOf(l, today) === 'overdue');
    const upcoming = loans.filter(l => l.nextDue >= today).sort((a, b) => a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0);
    const next = upcoming.length ? { loan: upcoming[0], date: upcoming[0].nextDue, daysAway: daysBetween(today, upcoming[0].nextDue) } : null;
    return { overdue: overdue, next: next };
  }

  // Most urgent first: overdue, due soon, upcoming, then already paid; ties by due date.
  const URGENCY = { 'overdue': 0, 'due-soon': 1, 'upcoming': 2, 'paid': 3 };
  function sortByUrgency(loans, today) {
    today = today || todayStr();
    return loans.slice().sort((a, b) =>
      (URGENCY[statusOf(a, today)] - URGENCY[statusOf(b, today)]) || (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0));
  }

  /* ---------- validation (single source of truth for the add-loan form) ---------- */
  const toNum = v => (v === '' || v == null) ? NaN : Number(v);
  // Returns { fieldName: 'message' }; an empty object means the input is valid.
  function validateLoan(input, today) {
    today = today || todayStr();
    const e = {};
    const a = toNum(input.amount), o = toNum(input.outstanding), r = toNum(input.rate);
    const m = toNum(input.emi), t = toNum(input.tenure);

    if (LOAN_TYPES.indexOf(input.type) === -1) e.type = 'Pick a loan type';
    if (!String(input.lender || '').trim()) e.lender = 'Enter the lender name';
    if (isNaN(a) || a <= 0) e.amount = 'Enter the original loan amount';

    if (isNaN(o) || o <= 0) e.outstanding = 'Enter how much you still owe';
    else if (!isNaN(a) && o > a) e.outstanding = 'Outstanding can\u2019t be more than the loan amount (' + inr(a) + ')';

    if (isNaN(r) || r <= 0 || r > 50) e.rate = 'Enter a rate between 0.1 and 50';

    if (isNaN(m) || m <= 0) e.emi = 'Enter your monthly EMI';
    else if (!isNaN(o) && m > o) e.emi = 'EMI can\u2019t be more than the outstanding amount';
    else if (!isNaN(o) && !isNaN(r) && r > 0 && m <= monthlyInterest(o, r)) {
      e.emi = 'EMI is below this month\u2019s interest (' + inr(monthlyInterest(o, r)) + '), so the balance would never fall';
    }

    if (isNaN(t) || !Number.isInteger(t) || t < 1 || t > 480) e.tenure = 'Enter whole months, from 1 to 480';

    if (!parseDate(input.startDate)) e.startDate = 'Pick the loan start date';
    else if (input.startDate > today) e.startDate = 'Start date can\u2019t be in the future';

    if (!parseDate(input.nextDue)) e.nextDue = 'Pick your next EMI date';
    else if (parseDate(input.startDate) && input.nextDue < input.startDate) e.nextDue = 'Next EMI date can\u2019t be before the start date';

    return e;
  }

  /* ---------- storage ---------- */
  function readRaw() { try { return root.localStorage.getItem(KEY); } catch (err) { return null; } }
  function writeRaw(s) { try { root.localStorage.setItem(KEY, s); return true; } catch (err) { return false; } }

  function isStoredLoan(l) {
    return !!l && typeof l === 'object' && typeof l.id === 'string' && typeof l.type === 'string' &&
      typeof l.lender === 'string' &&
      ['amount', 'outstanding', 'rate', 'emi', 'tenure'].every(k => typeof l[k] === 'number' && isFinite(l[k])) &&
      !!parseDate(l.startDate) && !!parseDate(l.nextDue) &&
      (l.lastPaidOn === null || l.lastPaidOn === undefined || !!parseDate(l.lastPaidOn));
  }
  // Always returns an array. Corrupt JSON or malformed entries are dropped, never thrown.
  function loadLoans() {
    const raw = readRaw();
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data.filter(isStoredLoan) : [];
    } catch (err) { return []; }
  }
  function saveLoans(loans) { return writeRaw(JSON.stringify(loans)); }

  function newId() {
    if (root.crypto && root.crypto.randomUUID) return 'ln_' + root.crypto.randomUUID();
    return 'ln_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Validate, then store. Returns { ok:true, loan } or { ok:false, errors }.
  function createLoan(input, today) {
    const errors = validateLoan(input, today);
    if (Object.keys(errors).length) return { ok: false, errors: errors };
    const loan = {
      id: newId(),
      type: input.type,
      lender: String(input.lender).trim(),
      amount: toNum(input.amount),
      outstanding: toNum(input.outstanding),
      rate: toNum(input.rate),
      emi: toNum(input.emi),
      tenure: toNum(input.tenure),
      startDate: input.startDate,
      nextDue: input.nextDue,
      lastPaidOn: null,
      createdAt: new Date().toISOString()
    };
    const loans = loadLoans();
    loans.push(loan);
    if (!saveLoans(loans)) return { ok: false, errors: { _storage: 'This browser wouldn\u2019t let DebtWise save the loan. Check that storage isn\u2019t blocked (private mode can do this).' } };
    return { ok: true, loan: loan };
  }
  function deleteLoan(id) {
    const loans = loadLoans(), kept = loans.filter(l => l.id !== id);
    if (kept.length === loans.length) return false;
    return saveLoans(kept);
  }
  function clearLoans() { return saveLoans([]); }

  /* ---------- sample data (the three loans the dashboard used to hardcode) ---------- */
  // Dates are relative to `today` so the statuses always read the same way:
  // one overdue, one due in 6 days, one already paid this month.
  function sampleLoans(today) {
    today = today || todayStr();
    const paidDay = today.slice(0, 8) + pad(Math.min(3, +today.slice(8, 10)));
    const base = { lastPaidOn: null, createdAt: new Date().toISOString(), isSample: true };
    return [
      Object.assign({}, base, { id: 'sample_personal', type: 'Personal loan', lender: 'Bajaj Finserv', amount: 390000, outstanding: 242500, rate: 14.5, emi: 8350, tenure: 60, startDate: addMonths(today, -26), nextDue: addDays(today, -4) }),
      Object.assign({}, base, { id: 'sample_home', type: 'Home loan', lender: 'HDFC Bank', amount: 1900000, outstanding: 1480000, rate: 8.75, emi: 28500, tenure: 240, startDate: addMonths(today, -50), nextDue: addDays(today, 6) }),
      Object.assign({}, base, { id: 'sample_business', type: 'Business loan', lender: 'ICICI Bank', amount: 343000, outstanding: 120000, rate: 11, emi: 5500, tenure: 84, startDate: addMonths(today, -40), nextDue: addMonths(paidDay, 1), lastPaidOn: paidDay })
    ];
  }
  // Only fills an empty store, so it can never overwrite a user's own loans.
  function seedSampleLoans(today) {
    if (loadLoans().length) return false;
    return saveLoans(sampleLoans(today));
  }

  // Removes only the sample loans, leaving anything the user entered themselves.
  function clearSampleLoans() { return saveLoans(loadLoans().filter(l => !l.isSample)); }

  const api = {
    KEY: KEY, LOAN_TYPES: LOAN_TYPES, DUE_SOON_DAYS: DUE_SOON_DAYS,
    todayStr: todayStr, parseDate: parseDate, daysBetween: daysBetween, addDays: addDays, addMonths: addMonths,
    inr: inr, monthlyInterest: monthlyInterest, splitEmi: splitEmi, repaidPercent: repaidPercent,
    statusOf: statusOf, totals: totals, nextDueInfo: nextDueInfo, sortByUrgency: sortByUrgency,
    validateLoan: validateLoan,
    loadLoans: loadLoans, saveLoans: saveLoans, createLoan: createLoan, deleteLoan: deleteLoan, clearLoans: clearLoans,
    sampleLoans: sampleLoans, seedSampleLoans: seedSampleLoans, clearSampleLoans: clearSampleLoans
  };
  root.DebtWiseStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
