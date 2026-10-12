// Run with:  node debtwise_store.test.js     (no install needed)
const assert = require('assert');

// Minimal in-memory localStorage so the store can run outside a browser.
let backing = {}, failWrites = false;
globalThis.localStorage = {
  getItem: k => (k in backing ? backing[k] : null),
  setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceeded'); backing[k] = String(v); },
  removeItem: k => { delete backing[k]; }
};
const S = require('./debtwise_store.js');

let passed = 0;
function test(name, fn) {
  backing = {}; failWrites = false;
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
const TODAY = '2026-06-09';
const valid = () => ({ type: 'Home loan', lender: 'HDFC Bank', amount: 500000, outstanding: 420000, rate: 12, emi: 12000, tenure: 240, startDate: '2024-01-10', nextDue: '2026-11-05' });

console.log('dates');
test('addMonths keeps the day, clamps at month end, crosses years', () => {
  assert.strictEqual(S.addMonths('2026-01-31', 1), '2026-02-28');
  assert.strictEqual(S.addMonths('2028-01-31', 1), '2028-02-29');
  assert.strictEqual(S.addMonths('2026-12-15', 1), '2027-01-15');
  assert.strictEqual(S.addMonths('2026-03-15', -4), '2025-11-15');
});
test('parseDate rejects impossible dates; daysBetween spans months', () => {
  assert.strictEqual(S.parseDate('2026-02-30'), null);
  assert.strictEqual(S.parseDate('05/06/2026'), null);
  assert.strictEqual(S.daysBetween('2026-06-09', '2026-06-15'), 6);
  assert.strictEqual(S.daysBetween('2026-06-30', '2026-07-02'), 2);
  assert.strictEqual(S.daysBetween('2026-06-09', '2026-06-05'), -4);
});

console.log('maths (pins the numbers shown on the dashboard)');
test('EMI split uses balance x monthly rate', () => {
  const [personal, home] = S.sampleLoans(TODAY);
  assert.deepStrictEqual(S.splitEmi(personal), { interest: 2930, principal: 5420 });
  assert.deepStrictEqual(S.splitEmi(home), { interest: 10792, principal: 17708 });
});
test('interest never exceeds the EMI', () => {
  assert.deepStrictEqual(S.splitEmi({ emi: 500, outstanding: 1000000, rate: 12 }), { interest: 500, principal: 0 });
});
test('repaid % matches the cards (38, 22, 65) and is clamped', () => {
  assert.deepStrictEqual(S.sampleLoans(TODAY).map(S.repaidPercent), [38, 22, 65]);
  assert.strictEqual(S.repaidPercent({ amount: 500000, outstanding: 900000 }), 0);
  assert.strictEqual(S.repaidPercent({ amount: 0, outstanding: 0 }), 0);
});

console.log('status, totals, next due');
test('sample statuses: overdue, due-soon, paid', () => {
  assert.deepStrictEqual(S.sampleLoans(TODAY).map(l => S.statusOf(l, TODAY)), ['overdue', 'due-soon', 'paid']);
});
test('sample statuses hold on awkward days (1st, 2nd, 31st)', () => {
  ['2026-06-01', '2026-06-02', '2026-07-31', '2026-03-01'].forEach(d =>
    assert.deepStrictEqual(S.sampleLoans(d).map(l => S.statusOf(l, d)), ['overdue', 'due-soon', 'paid'], d));
});
test('totals match the dashboard (18,42,500 / 42,350 / 2 need attention)', () => {
  const t = S.totals(S.sampleLoans(TODAY), TODAY);
  assert.strictEqual(t.totalOutstanding, 1842500);
  assert.strictEqual(t.monthlyEmi, 42350);
  assert.strictEqual(t.count, 3);
  assert.strictEqual(t.overdue, 1);
  assert.strictEqual(t.needAttention, 2);
});
test('Next due never picks a past date (the review bug)', () => {
  const info = S.nextDueInfo(S.sampleLoans(TODAY), TODAY);
  assert.strictEqual(info.overdue.length, 1);
  assert.strictEqual(info.overdue[0].lender, 'Bajaj Finserv');
  assert.strictEqual(info.next.date, '2026-06-15');
  assert.strictEqual(info.next.daysAway, 6);
  assert.strictEqual(info.next.loan.lender, 'HDFC Bank');
});
test('Next due with no loans, and with only overdue loans', () => {
  assert.deepStrictEqual(S.nextDueInfo([], TODAY), { overdue: [], next: null });
  const only = [S.sampleLoans(TODAY)[0]];
  const info = S.nextDueInfo(only, TODAY);
  assert.strictEqual(info.overdue.length, 1);
  assert.strictEqual(info.next, null);
});
test('a loan marked paid this month is not overdue', () => {
  const l = Object.assign({}, S.sampleLoans(TODAY)[0], { lastPaidOn: '2026-06-08' });
  assert.strictEqual(S.statusOf(l, TODAY), 'paid');
});

console.log('validation (same rules and messages as the add-loan form)');
test('valid input and all three sample loans pass', () => {
  assert.deepStrictEqual(S.validateLoan(valid(), TODAY), {});
  S.sampleLoans(TODAY).forEach(l => assert.deepStrictEqual(S.validateLoan(l, TODAY), {}, l.lender));
});
test('empty input flags every field', () => {
  const e = S.validateLoan({}, TODAY);
  assert.deepStrictEqual(Object.keys(e).sort(), ['amount', 'emi', 'lender', 'nextDue', 'outstanding', 'rate', 'startDate', 'tenure', 'type']);
});
test('outstanding cannot exceed loan amount', () => {
  const e = S.validateLoan(Object.assign(valid(), { amount: 500000, outstanding: 900000 }), TODAY);
  assert.strictEqual(e.outstanding, 'Outstanding can\u2019t be more than the loan amount (\u20B95,00,000)');
});
test('EMI must exceed monthly interest', () => {
  const e = S.validateLoan(Object.assign(valid(), { emi: 4000 }), TODAY);
  assert.strictEqual(e.emi, 'EMI is below this month\u2019s interest (\u20B94,200), so the balance would never fall');
});
test('EMI cannot exceed outstanding', () => {
  assert.ok(S.validateLoan(Object.assign(valid(), { emi: 500000 }), TODAY).emi);
});
test('dates: future start, due before start, impossible date', () => {
  assert.strictEqual(S.validateLoan(Object.assign(valid(), { startDate: '2026-07-09' }), TODAY).startDate, 'Start date can\u2019t be in the future');
  assert.strictEqual(S.validateLoan(Object.assign(valid(), { startDate: '2024-01-10', nextDue: '2023-12-01' }), TODAY).nextDue, 'Next EMI date can\u2019t be before the start date');
  assert.ok(S.validateLoan(Object.assign(valid(), { startDate: '2026-02-30' }), TODAY).startDate);
});
test('tenure and rate bounds; numeric strings from form inputs are accepted', () => {
  assert.ok(S.validateLoan(Object.assign(valid(), { tenure: 240.5 }), TODAY).tenure);
  assert.ok(S.validateLoan(Object.assign(valid(), { tenure: 481 }), TODAY).tenure);
  assert.ok(S.validateLoan(Object.assign(valid(), { rate: 0 }), TODAY).rate);
  assert.ok(S.validateLoan(Object.assign(valid(), { rate: 51 }), TODAY).rate);
  const strings = { type: 'Home loan', lender: 'HDFC', amount: '500000', outstanding: '420000', rate: '12', emi: '12000', tenure: '240', startDate: '2024-01-10', nextDue: '2026-11-05' };
  assert.deepStrictEqual(S.validateLoan(strings, TODAY), {});
});
test('unknown loan type (e.g. credit card) is rejected', () => {
  assert.strictEqual(S.validateLoan(Object.assign(valid(), { type: 'Credit card' }), TODAY).type, 'Pick a loan type');
});

console.log('storage');
test('empty store loads as []', () => assert.deepStrictEqual(S.loadLoans(), []));
test('createLoan stores a normalised loan and it loads back', () => {
  const r = S.createLoan(Object.assign(valid(), { lender: '  HDFC Bank  ', amount: '500000' }), TODAY);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.loan.lender, 'HDFC Bank');
  assert.strictEqual(r.loan.amount, 500000);
  assert.strictEqual(r.loan.lastPaidOn, null);
  assert.ok(/^ln_/.test(r.loan.id));
  assert.deepStrictEqual(S.loadLoans(), [r.loan]);
});
test('createLoan refuses invalid input and stores nothing', () => {
  const r = S.createLoan(Object.assign(valid(), { outstanding: 900000 }), TODAY);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.outstanding);
  assert.deepStrictEqual(S.loadLoans(), []);
});
test('ids are unique', () => {
  const a = S.createLoan(valid(), TODAY).loan, b = S.createLoan(valid(), TODAY).loan;
  assert.notStrictEqual(a.id, b.id);
  assert.strictEqual(S.loadLoans().length, 2);
});
test('deleteLoan removes one loan; unknown id returns false', () => {
  const a = S.createLoan(valid(), TODAY).loan; S.createLoan(valid(), TODAY);
  assert.strictEqual(S.deleteLoan(a.id), true);
  assert.strictEqual(S.loadLoans().length, 1);
  assert.strictEqual(S.deleteLoan('nope'), false);
});
test('corrupt JSON, wrong shape and malformed entries never throw', () => {
  backing[S.KEY] = '{not json'; assert.deepStrictEqual(S.loadLoans(), []);
  backing[S.KEY] = '{"a":1}'; assert.deepStrictEqual(S.loadLoans(), []);
  const good = S.sampleLoans(TODAY)[1];
  backing[S.KEY] = JSON.stringify([good, { id: 'x' }, null, 5, Object.assign({}, good, { id: 'y', emi: 'lots' })]);
  assert.deepStrictEqual(S.loadLoans().map(l => l.id), ['sample_home']);
});
test('a browser that blocks storage gives a clear error, not a silent loss', () => {
  failWrites = true;
  const r = S.createLoan(valid(), TODAY);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors._storage);
});
test('seedSampleLoans fills an empty store but never overwrites real loans', () => {
  assert.strictEqual(S.seedSampleLoans(TODAY), true);
  assert.strictEqual(S.loadLoans().length, 3);
  S.clearLoans(); S.createLoan(valid(), TODAY);
  assert.strictEqual(S.seedSampleLoans(TODAY), false);
  assert.strictEqual(S.loadLoans().length, 1);
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
