# DebtWise 💸

> Track every loan. Plan your payoff. Upload a sanction letter and let AI fill the rest.

A debt management web app built as a **Product Management portfolio project** — to demonstrate product thinking, interaction design, and AI-augmented UX in the personal finance space.

Built with HTML, CSS, and vanilla JavaScript. No frameworks. No build step.

---

## Why this exists

Most debt tracking apps are built for one loan. Add a second and you're back to Excel.

DebtWise is built for people managing multiple debts — personal loans, home loans, business credit — who want one place to see everything, understand their strategy, and never miss an EMI again. Built specifically for the Indian borrowing context (₹, EMI-first framing, Indian bank sanction letters).

This is **v1 — prototype grade**. Intentionally scoped. The PRD, user stories, and what's deliberately out of scope are all documented below and in `DebtWise_PRD_v1.md`.

---

## Screens

### 1. Onboarding (`debtwise_onboarding.html`)
The entry point. Login is the default view. Sign up available via tab toggle.

**What's working:**
- Login / Sign up tab toggle — Login is default
- Email login form with inline field validation (errors per field on blur)
- Sign up form with name, email, password, confirm password, terms checkbox
- Caps Lock tooltip — appears above password fields automatically when Caps Lock is on
- Password strength meter on sign up (4-bar: weak / fair / good / strong)
- Forgot password flow with email input
- EMI reminder opt-in checkbox on sign up
- User name + email saved to `localStorage` on sign up — used to personalise the dashboard greeting
- Enter key submits the active form

**Known issues (v2 roadmap):**
- Google login UI present but not functional — requires OAuth setup
- Phone / OTP login UI present but not functional — requires SMS gateway
- Login button mock only — no real authentication backend

---

### 2. Dashboard (`debtwise_dashboard.html`)
The home screen after login. Shows the full debt picture at a glance.

**What's working:**
- Summary metrics: total outstanding, monthly EMI load, next due date, interest paid YTD
- Loan cards with colour-coded status border: 🔴 overdue / 🟡 due soon / 🟢 paid this month
- Each card shows: loan type, bank name, outstanding amount, EMI, interest rate, progress bar
- Mark as paid modal — shows EMI amount with principal vs interest split, payment date, payment mode
- Upcoming payments timeline for the current month
- Add loan manually — modal form with all loan fields
- Sanction letter nudge inside the manual form — prompts user to upload instead
- Personalised greeting using name from `localStorage`
- Empty state with CTA when no loans are added yet
- Reads loan data saved by the upload screen via `localStorage` and renders dynamically

---

### 3. Payoff Strategy (`debtwise_strategy.html`)
Shows users how to get debt-free faster and smarter.

**What's working:**
- Snowball method (lowest balance first) and Avalanche method (highest interest first)
- Strategy toggle — switching updates all values and the chart instantly
- Extra payment slider (₹0–₹20,000) — all projections recalculate live on drag
- Summary metrics: months to debt-free, total interest, first loan payoff date
- Balance-over-time line chart comparing selected strategy vs minimum payments only (Chart.js)
- Ranked payoff order list with projected payoff date per loan
- Months saved and interest saved vs minimum payments
- Dynamic context tip explaining the selected strategy in plain language

---

### 4. Sanction Letter Upload (`debtwise_upload.html`)
The standout feature. Upload a bank letter and let AI fill in the form.

**What's working:**
- Drag-and-drop or click-to-browse file upload; accepts PDF and images
- 4-step processing animation: Document received → Reading → AI extraction → Verification
- Claude API (`claude-sonnet-4-20250514`) extracts: loan amount, EMI, interest rate, tenure, due date, lender name
- Confidence indicators per field — green border = high confidence, amber = please verify
- Low-confidence warning shown for uncertain fields with instruction to check
- All extracted fields are editable before saving
- Save writes loan to `localStorage` (`dw_loans` array) and redirects to dashboard
- Dashboard reads and renders the saved loan immediately
- Security note: document is not stored, only extracted fields are saved
- Supported lender list shown (HDFC, ICICI, SBI, Axis, Bajaj Finserv, Kotak + more)
- Re-upload option to discard and start over

---

## File Structure

```
debtwise/
├── index.html                  # Entry point — redirects to onboarding
├── debtwise_onboarding.html    # Login + Sign up screen
├── debtwise_onboarding.css     # Onboarding-specific styles
├── debtwise_onboarding.js      # All onboarding logic (validation, caps lock, OTP, etc.)
├── debtwise_dashboard.html     # Main home screen
├── debtwise_strategy.html      # Snowball vs Avalanche planner
├── debtwise_upload.html        # AI sanction letter extraction
├── debtwise.css                # Shared design system (tokens, typography, components)
├── DebtWise_PRD_v1.md          # Full PRD with user stories, metrics, out-of-scope
└── README.md
```

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | HTML5, CSS3, vanilla JS | No build step; every screen is self-contained |
| AI extraction | Claude API — `claude-sonnet-4-20250514` | Document understanding + structured JSON output |
| Icons | Tabler Icons (CDN) | Lightweight, consistent, free |
| Charts | Chart.js (CDN) | Used on strategy screen only |
| Fonts | Inter + Plus Jakarta Sans (Google Fonts) | Clean, readable, professional |
| State | `localStorage` | No backend; sufficient for single-device prototype |

---

## Running Locally

```bash
git clone https://github.com/giteshjethwa/DebtWise
cd DebtWise
open debtwise_onboarding.html
```

No install. No npm. Just open the file.

The AI upload screen requires an Anthropic API key. Add it to the fetch headers in `debtwise_upload.html`:

```js
headers: {
  "x-api-key": "YOUR_API_KEY",
  "Content-Type": "application/json"
}
```

> ⚠️ For production, API calls must go through a backend. Never expose API keys in client-side code.

---

## Design Decisions

**Why vanilla JS?**
The goal was to prototype fast and keep every screen shareable as a single file without any build overhead. The constraint also forced cleaner separation — HTML structure, CSS in a shared sheet, JS in a dedicated file per screen.

**Why separate CSS and JS files?**
v1 started with everything inline. Moving to separate files (`debtwise.css`, `debtwise_onboarding.js`) was a deliberate v1 improvement — makes the codebase maintainable and signals real engineering intent to anyone reviewing the repo.

**Why green (`#1A9E75`)?**
Financial calm. Assertive without being aggressive — it signals "under control" rather than "urgent." Distinct from the red/green of most finance apps which lean into anxiety.

**Why Indian context?**
The ₹ currency, HDFC/ICICI/Bajaj lender names, and EMI-first framing are deliberate. Most debt tracking tools are US-centric. DebtWise is built for how Indians actually borrow.

**Why confidence indicators on extracted fields?**
AI gets things wrong. Hiding uncertainty damages trust permanently when users catch a mistake. Surfacing it — amber border, explicit warning — keeps the user in control and makes the AI feel like a helpful assistant rather than a black box.

**Why include broken features in the README?**
Because this is a real portfolio project, not a marketing page. Hiring managers and PMs reading this repo should see what was built, what was scoped out, and why. That transparency is itself a product skill.

---

## What's Not Working (v1 Known Gaps)

| Feature | Status | Reason |
|---------|--------|--------|
| Google login | UI only | Requires OAuth app + backend |
| Phone / OTP login | UI only | Requires SMS gateway integration |
| Email reminders | Not built | Requires backend + email service (e.g. Resend) |
| Cross-device data sync | Not built | `localStorage` is device-local only |
| Real authentication | Not built | Prototype uses mock login flow |

---

## Roadmap — v2

- [ ] Supabase backend for persistent storage and real auth
- [ ] Google OAuth integration
- [ ] Email reminders via Resend (7 days and 1 day before due date)
- [ ] Amortisation schedule per loan
- [ ] Prepayment impact simulator ("what if I pay ₹5,000 extra this month?")
- [ ] Mark as paid updates outstanding balance dynamically
- [ ] Multi-currency support

---

## Product Artifacts

| Artifact | Location |
|----------|----------|
| PRD v1 (full) | [`DebtWise_PRD_v1.md`](./DebtWise_PRD_v1.md) |
| User stories | Inside PRD, per screen |
| Out-of-scope decisions | PRD Section 8 |
| Open questions for v2 | PRD Section 9 |

---

## Author

Built by **Gitesh Jethwa**

8 years in enterprise delivery (T-Systems, Infosys, Cognizant) — transitioning into AI Product Management. DebtWise is the first project in a portfolio built on real work, not certifications.

[LinkedIn](https://www.linkedin.com/in/gitesh-jethwa/) · [GitHub](https://github.com/giteshjethwa/DebtWise)
