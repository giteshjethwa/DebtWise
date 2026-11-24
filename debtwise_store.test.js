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
test('addMonths can aim for a pinned day of month (no month-end drift)', () => {
  assert.strictEqual(S.addMonths('2026-02-28', 1, 31), '2026-03-31');
  assert.strictEqual(S.addMonths('2026-01-31', 1, 31), '2026-02-28');
  assert.strictEqual(S.addMonths('2028-01-31', 1, 31), '2028-02-29');
  let d = '2026-01-31'; const seen = [];
  for (let i = 0; i < 4; i++) { d = S.addMonths(d, 1, 31); seen.push(d); }
  assert.deepStrictEqual(seen, ['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
});
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
  assert.strictEqual(t.totalAmount, 2633000);
  assert.strictEqual(t.repaidPercent, 30);
});
test('totals of an empty list are all zero', () => {
  assert.deepStrictEqual(S.totals([], TODAY), { count: 0, activeCount: 0, paidOff: 0, totalAmount: 0, totalOutstanding: 0, repaidPercent: 0, monthlyEmi: 0, overdue: 0, dueSoon: 0, needAttention: 0 });
});
test('sortByUrgency: overdue, due-soon, upcoming, paid; ties by due date', () => {
  const [p, h, b] = S.sampleLoans(TODAY);
  const later = Object.assign({}, h, { id: 'later', nextDue: '2026-08-01' });
  const sooner = Object.assign({}, h, { id: 'sooner', nextDue: '2026-07-01' });
  assert.deepStrictEqual(S.sortByUrgency([b, later, h, sooner, p], TODAY).map(l => l.id),
    ['sample_personal', 'sample_home', 'sooner', 'later', 'sample_business']);
  assert.deepStrictEqual(S.sortByUrgency([], TODAY), []);
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
test('paid = EMI recorded this month and the next one is not already late', () => {
  const [p, , b] = S.sampleLoans(TODAY);
  assert.strictEqual(S.statusOf(b, TODAY), 'paid');
  // one payment recorded, but the due date is still in the past: still behind, so still overdue
  assert.strictEqual(S.statusOf(Object.assign({}, p, { lastPaidOn: '2026-06-08' }), TODAY), 'overdue');
  // the month rolls over: no longer 'paid' (next due 3 Jul is now two days away)
  assert.strictEqual(S.statusOf(b, '2026-07-01'), 'due-soon');
});
test('a loan with no balance is paid-off and is left out of EMIs, overdue and next due', () => {
  const [p, h, b] = S.sampleLoans(TODAY);
  const off = Object.assign({}, p, { outstanding: 0 });   // would otherwise be overdue
  assert.strictEqual(S.statusOf(off, TODAY), 'paid-off');
  assert.strictEqual(S.repaidPercent(off), 100);
  const t = S.totals([off, h, b], TODAY);
  assert.strictEqual(t.paidOff, 1); assert.strictEqual(t.activeCount, 2);
  assert.strictEqual(t.monthlyEmi, 28500 + 5500); assert.strictEqual(t.overdue, 0);
  assert.strictEqual(t.count, 3); assert.strictEqual(t.totalAmount, 390000 + 1900000 + 343000);
  assert.deepStrictEqual(S.nextDueInfo([off], TODAY), { overdue: [], next: null });
  assert.strictEqual(S.sortByUrgency([off, h, b], TODAY)[2].id, 'sample_personal');
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

console.log('payments');
const PAY = { date: '2026-06-09', mode: 'UPI' };
const seed = () => { S.saveLoans(S.sampleLoans(TODAY)); };
const get = id => S.loadLoans().find(l => l.id === id);
test('preview and record: balance falls by the principal, due date rolls from the DUE date', () => {
  seed();
  const before = get('sample_personal');
  assert.deepStrictEqual(S.previewPayment(before), { emi: 8350, interest: 2930, principal: 5420, final: false, outstandingAfter: 237080, nextDue: '2026-07-05' });
  assert.strictEqual(get('sample_personal').outstanding, 242500, 'preview must not change anything');
  const r = S.recordPayment('sample_personal', PAY, TODAY);   // due 5 Jun, paid 9 Jun
  assert.strictEqual(r.ok, true);
  const after = get('sample_personal');
  assert.strictEqual(after.outstanding, 237080);
  assert.strictEqual(after.nextDue, '2026-07-05');            // not 2026-07-09
  assert.strictEqual(after.lastPaidOn, '2026-06-09');
  assert.strictEqual(S.statusOf(after, TODAY), 'paid');
  assert.strictEqual(S.repaidPercent(after), 39);
  assert.deepStrictEqual(after.payments, [{ date: '2026-06-09', mode: 'UPI', emi: 8350, interest: 2930, principal: 5420,
    outstandingBefore: 242500, outstandingAfter: 237080, dueBefore: '2026-06-05', lastPaidBefore: null }]);
});
test('totals move after a payment (overdue clears, outstanding falls)', () => {
  seed(); S.recordPayment('sample_personal', PAY, TODAY);
  const t = S.totals(S.loadLoans(), TODAY);
  assert.strictEqual(t.totalOutstanding, 1842500 - 5420);
  assert.strictEqual(t.overdue, 0); assert.strictEqual(t.dueSoon, 1);
  assert.strictEqual(S.nextDueInfo(S.loadLoans(), TODAY).overdue.length, 0);
});
test('several months behind: each payment clears one instalment, overdue until fully caught up', () => {
  // due 5 Apr, today 9 Jun: the Apr, May and Jun instalments are all late
  const l = Object.assign({}, S.sampleLoans(TODAY)[0], { nextDue: '2026-04-05', dueDay: 5 });
  S.saveLoans([l]);
  const expectDue = ['2026-05-05', '2026-06-05', '2026-07-05'], expectStatus = ['overdue', 'overdue', 'paid'];
  for (let i = 0; i < 3; i++) {
    assert.strictEqual(S.recordPayment(l.id, PAY, TODAY).ok, true, 'payment ' + (i + 1));
    assert.strictEqual(get(l.id).nextDue, expectDue[i]);
    assert.strictEqual(S.statusOf(get(l.id), TODAY), expectStatus[i]);
  }
  assert.strictEqual(get(l.id).payments.length, 3);
  assert.strictEqual(S.recordPayment(l.id, PAY, TODAY).ok, false);       // caught up: nothing more to pay this month
});
test('a loan due on the 31st stays on the 31st across short months', () => {
  const l = Object.assign({}, S.sampleLoans(TODAY)[1], { nextDue: '2026-01-31', dueDay: 31, startDate: '2025-06-01', lastPaidOn: null });
  S.saveLoans([l]);
  S.recordPayment(l.id, { date: '2026-01-31', mode: 'UPI' }, '2026-01-31'); assert.strictEqual(get(l.id).nextDue, '2026-02-28');
  S.recordPayment(l.id, { date: '2026-02-28', mode: 'UPI' }, '2026-02-28'); assert.strictEqual(get(l.id).nextDue, '2026-03-31');
});
test('loans saved before dueDay/payments existed can still be paid', () => {
  const legacy = { id: 'old', type: 'Home loan', lender: 'X', amount: 100000, outstanding: 50000, rate: 12, emi: 3000, tenure: 36, startDate: '2025-01-10', nextDue: '2026-06-15', lastPaidOn: null, createdAt: 'x' };
  S.saveLoans([legacy]);
  assert.strictEqual(S.loadLoans().length, 1);
  assert.strictEqual(S.recordPayment('old', PAY, TODAY).ok, true);
  assert.strictEqual(get('old').dueDay, 15); assert.strictEqual(get('old').payments.length, 1);
  assert.strictEqual(get('old').nextDue, '2026-07-15');
});
test('final payment: smaller than the EMI, clears the loan, due date stays, then no more payments', () => {
  const l = Object.assign({}, S.sampleLoans(TODAY)[1], { outstanding: 3000, emi: 8350, rate: 14.5 });
  S.saveLoans([l]);
  const pv = S.previewPayment(l);
  assert.deepStrictEqual(pv, { emi: 3036, interest: 36, principal: 3000, final: true, outstandingAfter: 0, nextDue: l.nextDue });
  assert.strictEqual(S.recordPayment(l.id, PAY, TODAY).ok, true);
  assert.strictEqual(get(l.id).outstanding, 0);
  assert.strictEqual(S.statusOf(get(l.id), TODAY), 'paid-off');
  assert.strictEqual(S.recordPayment(l.id, PAY, TODAY).error, 'This loan is already paid off.');
});
test('exactly clearing the balance counts as the final payment', () => {
  const l = Object.assign({}, S.sampleLoans(TODAY)[1], { outstanding: 5420 + 0, emi: 8350, rate: 14.5 });
  // interest on 5,420 at 14.5% is 65; principal 8,285 >= 5,420
  assert.strictEqual(S.previewPayment(l).final, true);
});
test('the same EMI cannot be recorded twice (double click)', () => {
  seed();
  assert.strictEqual(S.recordPayment('sample_home', PAY, TODAY).ok, true);
  const again = S.recordPayment('sample_home', PAY, TODAY);
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.error, 'This month\u2019s EMI is already recorded.');
  assert.strictEqual(get('sample_home').payments.length, 1);
});
test('payment guards: unknown loan, bad/future/too-early date, bad mode; nothing is stored', () => {
  seed(); const snapshot = JSON.stringify(S.loadLoans());
  assert.strictEqual(S.recordPayment('nope', PAY, TODAY).error, 'That loan no longer exists.');
  assert.strictEqual(S.recordPayment('sample_home', { date: '', mode: 'UPI' }, TODAY).error, 'Pick the payment date.');
  assert.strictEqual(S.recordPayment('sample_home', { date: '2026-06-10', mode: 'UPI' }, TODAY).error, 'Payment date can\u2019t be in the future.');
  assert.strictEqual(S.recordPayment('sample_home', { date: '2019-01-01', mode: 'UPI' }, TODAY).error, 'Payment date can\u2019t be before the loan started.');
  assert.strictEqual(S.recordPayment('sample_home', { date: '2026-06-09', mode: 'Bitcoin' }, TODAY).error, 'Pick a payment mode.');
  assert.strictEqual(JSON.stringify(S.loadLoans()), snapshot);
});
test('a browser that blocks storage: payment fails clearly and the loan is unchanged', () => {
  seed(); const snapshot = JSON.stringify(S.loadLoans());
  failWrites = true;
  const r = S.recordPayment('sample_home', PAY, TODAY);
  failWrites = false;
  assert.strictEqual(r.ok, false); assert.ok(/storage/.test(r.error));
  assert.strictEqual(JSON.stringify(S.loadLoans()), snapshot);
});
test('new loans start with dueDay and an empty payment history; samples are internally consistent', () => {
  const l = S.createLoan(valid(), TODAY).loan;
  assert.strictEqual(l.dueDay, 5); assert.deepStrictEqual(l.payments, []);
  const b = S.sampleLoans(TODAY)[2], rec = b.payments[0];
  assert.strictEqual(rec.outstandingBefore - rec.principal, rec.outstandingAfter);
  assert.strictEqual(rec.outstandingAfter, b.outstanding);
  assert.strictEqual(rec.interest + rec.principal, rec.emi);
});
test('malformed payments / dueDay on a stored loan are dropped on load', () => {
  const good = S.sampleLoans(TODAY)[1];
  backing[S.KEY] = JSON.stringify([good, Object.assign({}, good, { id: 'a', payments: 'many' }), Object.assign({}, good, { id: 'b', dueDay: 40 })]);
  assert.deepStrictEqual(S.loadLoans().map(l => l.id), ['sample_home']);
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
test('clearSampleLoans removes only samples, keeps the user\u2019s own loans', () => {
  S.seedSampleLoans(TODAY);
  const mine = S.createLoan(valid(), TODAY).loan;
  assert.strictEqual(S.loadLoans().length, 4);
  S.clearSampleLoans();
  assert.deepStrictEqual(S.loadLoans().map(l => l.id), [mine.id]);
});
test('seedSampleLoans fills an empty store but never overwrites real loans', () => {
  assert.strictEqual(S.seedSampleLoans(TODAY), true);
  assert.strictEqual(S.loadLoans().length, 3);
  S.clearLoans(); S.createLoan(valid(), TODAY);
  assert.strictEqual(S.seedSampleLoans(TODAY), false);
  assert.strictEqual(S.loadLoans().length, 1);
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
