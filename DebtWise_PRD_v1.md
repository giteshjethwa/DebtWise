# DebtWise — Product Requirements Document
**Version:** 1.0
**Author:** Gitesh Jethwa
**Date:** June 2026
**Status:** Released — Prototype
**Repo:** https://github.com/giteshjethwa/DebtWise

---

## 1. Problem Statement

Individuals managing multiple debts — personal loans, home loans, business credit — have no single reliable tool that gives them a complete, real-time picture of what they owe, when it's due, and how to pay it off intelligently.

Free Android apps are either too simple (no multi-debt view) or too generic (not built for Indian loan structures). Most people fall back to Excel — which has no reminders, no intelligence, and no strategy layer.

**Core gap:** No free tool combines a unified debt dashboard, sanction letter parsing, and a payoff strategy engine in one place.

---

## 2. Target User

**Primary:** Salaried or self-employed individuals in India, aged 25–45, managing 2–5 concurrent debts (personal loans, home loans, vehicle loans, business credit). Currently using Excel, notes apps, or nothing at all.

**Key insight:** They don't want a finance lesson. They want to open an app, see exactly what's due, and know they're on top of it.

---

## 3. Goals

| Goal | Description |
|------|-------------|
| Clarity | Give users a single view of all their debts |
| Awareness | Surface due dates before they're missed |
| Strategy | Show users how to pay off debt faster |
| Accessibility | Remove the friction of manually entering loan details |

---

## 4. Scope — Version 1

This PRD covers features that are **built and working** in the current prototype. Features that are incomplete or deferred to v2 are listed separately in Section 8.

---

## 5. Features — Working in v1

### 5.1 Onboarding Screen

**File:** `debtwise_onboarding.html`

#### What works

| Feature | Description |
|---------|-------------|
| App branding | DebtWise logo, name, and tagline visible on load |
| Login as default | Login tab is selected by default when the page loads |
| Login / Sign up toggle | Tab switch between Login and Sign up panels |
| Email login form | Email + password fields with submit button |
| Sign up form | Name, email, password, confirm password, terms checkbox |
| Caps Lock tooltip | Tooltip appears above password field when Caps Lock is detected |
| Password strength meter | 4-bar strength indicator on the sign up password field (weak / fair / good / strong) |
| Inline field validation | Errors shown per field on blur — not just on submit |
| Terms checkbox | Sign up blocked if Terms not accepted |
| EMI reminder opt-in | Checkbox to opt into email reminders before EMI due dates |
| Forgot password link | Links to a reset flow with email input |
| User data persistence | Name and email saved to localStorage on sign up for dashboard greeting |
| Enter key submission | Pressing Enter submits the active form |

#### User Stories

- As a returning user, I want Login to be the default screen so I don't have to navigate away from it.
- As a new user, I want to sign up with my name and email so I can create an account.
- As a user typing my password, I want a Caps Lock warning so I don't get locked out for a typo.
- As a user creating a password, I want to see how strong it is so I can make a better choice.
- As a user, I want to see field errors clearly so I know exactly what to fix before submitting.

---

### 5.2 Dashboard Screen

**File:** `debtwise_dashboard.html`

#### What works

| Feature | Description |
|---------|-------------|
| Summary metrics | Total outstanding balance, total monthly EMIs, next due date, interest paid YTD |
| Loan cards | Each loan displayed as a card with: loan type, bank name, outstanding amount, EMI, interest rate, progress bar, status badge |
| Colour-coded status | Red border = overdue, amber = due soon, green = paid this month |
| Mark as paid | Button on each loan card opens a payment confirmation modal showing EMI amount, principal/interest split, payment date, and payment mode |
| Upcoming payments | Timeline section below cards showing all EMIs for the current month with status |
| Add loan manually | "Add loan" button opens a form modal to enter loan details manually |
| Sanction letter nudge | Manual add form includes a link to the upload screen as an alternative |
| Personalised greeting | Greeting uses name from localStorage if available |
| Empty state | When no loans are saved, shows an empty state with a CTA to add the first loan |
| localStorage reads | Dashboard reads loan data saved by the upload screen and renders dynamically |

#### User Stories

- As a user, I want to see all my debts on one screen so I always know my total burden at a glance.
- As a user, I want colour-coded status on each loan so I can see what needs attention without reading every card.
- As a user who just paid an EMI, I want to mark it as paid and see the interest vs principal split so I understand what my money actually did.
- As a user with no loans added yet, I want a clear prompt to add my first loan so the empty screen doesn't confuse me.

---

### 5.3 Payoff Strategy Screen

**File:** `debtwise_strategy.html`

#### What works

| Feature | Description |
|---------|-------------|
| Snowball method | Displays payoff order sorted by lowest balance first; highlights motivational aspect |
| Avalanche method | Displays payoff order sorted by highest interest rate first; highlights interest savings |
| Strategy toggle | Switching between Snowball and Avalanche updates all values and the chart in real time |
| Extra payment slider | User sets an extra monthly payment (₹0–₹20,000); all projections update live |
| Summary metrics | Months to debt-free, total interest, first loan payoff date — all recalculated on slider move and strategy switch |
| Balance-over-time chart | Line chart comparing selected strategy vs minimum payments only; redraws on every change |
| Payoff order list | Numbered list showing which loan gets paid first, second, third — with projected payoff date for each |
| Context tip | Dynamic tip at the bottom explains why the selected strategy does what it does in plain language |
| Months saved | Displays how many months sooner the user becomes debt-free with extra payments |
| Interest saved | Displays total interest saved compared to minimum payments only |

#### User Stories

- As a user with extra money some months, I want to see how much interest I save by paying more so I can decide whether it's worth it.
- As a user who doesn't know which loan to pay first, I want a ranked list with projected payoff dates so I have a clear action.
- As a user considering strategies, I want to switch between Snowball and Avalanche and see the difference instantly so I can make an informed choice.

---

### 5.4 Sanction Letter Upload Screen

**File:** `debtwise_upload.html`

#### What works

| Feature | Description |
|---------|-------------|
| File upload zone | Drag-and-drop or click-to-browse; accepts PDF and image files |
| File type indicators | Shows accepted formats: PDF, JPG/PNG, Scanned image |
| Processing animation | 4-step animated progress: Document received → Reading → AI extraction → Verification |
| AI field extraction | Sends document to Claude API (claude-sonnet-4); parses loan amount, rate, EMI, tenure, bank, due date |
| Confidence indicators | Green border = high confidence; amber border = needs review |
| Low-confidence warning | Warning message shown for any field the AI is uncertain about, with an instruction to verify |
| All fields editable | Extracted fields are editable inputs — user can correct anything before saving |
| Save to localStorage | On save, loan object is written to localStorage `dw_loans` array |
| Redirect to dashboard | After saving, user is navigated to the dashboard which reads and renders the new loan |
| Security note | Explicit note before upload that the document is not stored and only extracted fields are saved |
| Bank compatibility list | Shows supported lenders: HDFC, ICICI, SBI, Axis, Bajaj Finserv, Kotak, + 40 more |
| Re-upload option | Button to discard extracted data and start over with a new file |

#### User Stories

- As a user who just got a new loan, I want to upload my sanction letter so I don't have to manually type all the details.
- As a user reviewing AI-extracted data, I want to see which fields the AI is confident about so I know what to double-check.
- As a user worried about security, I want to know my document isn't being stored so I feel safe uploading a financial document.
- As a user who saved a loan from the upload screen, I want to see it on my dashboard immediately so the screens feel connected.

---

## 6. Success Metrics

| Metric | Description |
|--------|-------------|
| Loan add completion rate | % of users who complete adding at least one loan |
| Upload parse accuracy | % of sanction letter fields correctly extracted by AI |
| Strategy engagement | % of users who interact with the extra payment slider |
| Return sessions | % of users who return to the dashboard after initial setup |

---

## 7. Technical Notes

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | HTML5, CSS3, vanilla JS | No build step; every screen is self-contained and shareable |
| AI extraction | Claude API — `claude-sonnet-4-20250514` | Best-in-class document understanding; structured JSON output |
| Icons | Tabler Icons (CDN) | Lightweight, consistent, free |
| Charts | Chart.js | Minimal; used only on strategy screen |
| Fonts | Inter + Plus Jakarta Sans (Google Fonts) | Clean, readable, professional |
| Data persistence | localStorage | No backend needed for prototype; sufficient for single-device demo |

---

## 8. Out of Scope — v1

The following were identified during build but deliberately excluded from v1 to maintain scope and shipping momentum:

| Feature | Reason deferred |
|---------|----------------|
| Google OAuth | Requires backend/OAuth app setup |
| Phone OTP | Requires SMS gateway integration |
| Email reminders | Requires backend and email service (e.g. Resend) |
| Amortisation schedule per loan | Deferred to v2 |
| Prepayment impact simulator | Deferred to v2 |
| Multi-currency support | Out of scope for Indian-market v1 |
| Native Android / iOS app | Web prototype first |
| Backend / cloud storage | localStorage sufficient for prototype |

---

## 9. Open Questions for v2

1. Should users sign in to access the dashboard, or allow anonymous use with localStorage only?
2. How should the app handle floating-rate loans where EMI changes mid-tenure?
3. Should the strategy screen be visible to users with only one loan, or gated for 2+?
4. What happens when a sanction letter is in a regional language (Hindi, Marathi, Tamil)?
5. Should "Mark as paid" update the outstanding balance dynamically, or require manual confirmation?

---

## 10. Screens Summary

| Screen | File | Status |
|--------|------|--------|
| Onboarding | `debtwise_onboarding.html` | ✅ v1 complete |
| Dashboard | `debtwise_dashboard.html` | ✅ v1 complete |
| Payoff Strategy | `debtwise_strategy.html` | ✅ v1 complete |
| Sanction Letter Upload | `debtwise_upload.html` | ✅ v1 complete |

---

*PRD written by Gitesh Jethwa — DebtWise portfolio project, June 2026.*
