# DebtWise 💸
### A debt management app prototype — built as a UI/UX portfolio project

DebtWise helps people in India track all their loans in one place, plan smart repayment strategies, and never miss an EMI again. This is a fully interactive prototype built with HTML, CSS, and vanilla JavaScript — no frameworks, no backend.

---

## Screens

### 1. Onboarding & Signup
A 3-step flow — name & email → password → welcome confirmation. Includes form validation, a "Continue with Google" shortcut, and a toggle to opt into EMI reminders.

### 2. Dashboard
The home screen after login. Shows total outstanding balance, next EMI due, interest paid to date, and a card for every active loan with color-coded status (overdue / due soon / on track). Includes a "Mark as paid" modal with principal/interest breakdown, and an "Add loan" modal with a manual form.

### 3. Payoff Strategy
Snowball vs. Avalanche calculator. Lets the user set an extra monthly payment and see a live comparison — total interest saved, months to debt-free, and the recommended payoff order for each strategy. Includes a balance-over-time chart drawn in plain SVG.

### 4. Sanction Letter Upload
AI-powered loan onboarding. Upload a PDF or image of a bank sanction letter — the app extracts loan details automatically and pre-fills the form. Built with the Anthropic Claude API (claude-sonnet-4) for document extraction.

---

## Tech Stack

| Layer | Choices |
|---|---|
| UI | HTML5, CSS3 (custom properties), vanilla JS |
| AI extraction | Anthropic Claude API — `claude-sonnet-4-20250514` |
| Icons | Tabler Icons (CDN) |
| Charts | Plain SVG (no chart library) |
| Fonts | System font stack via CSS vars |

No build step. No npm. Just open an HTML file.

---

## Running locally

```bash
git clone https://github.com/your-username/debtwise
cd debtwise
open debtwise_onboarding.html   # or any screen
```

The AI upload screen requires an Anthropic API key. Add it to the fetch headers in `debtwise_upload.html`:

```js
headers: {
  "x-api-key": "YOUR_API_KEY",
  "Content-Type": "application/json"
}
```

> **Note:** In production, API calls should go through a backend. Never expose API keys in client-side code.

---

## File structure

```
debtwise/
├── debtwise_onboarding.html   # Signup flow (3 steps)
├── debtwise_dashboard.html    # Main home screen
├── debtwise_strategy.html     # Snowball vs Avalanche planner
├── debtwise_upload.html       # AI sanction letter extraction
└── README.md
```

---

## Design decisions

**Why vanilla JS?** The goal was to prototype fast without framework overhead. Every screen is self-contained and shareable as a single file.

**Why green?** Financial calm. #1D9E75 is assertive without being aggressive — it signals "under control" rather than "urgent."

**Why Indian context?** The ₹ currency, HDFC/ICICI lender names, and EMI-first framing are deliberate. Most debt tracking tools are US-centric. DebtWise is built for how Indians actually borrow.

**AI extraction flow:** The upload screen sends a base64-encoded document to Claude with a structured prompt asking for JSON. The response is parsed and fields are auto-populated — reducing the manual data entry that kills onboarding completion rates.

---

## What I'd build next

- [ ] Persistent storage (localStorage or Supabase)
- [ ] Amortisation schedule screen per loan
- [ ] Push/email reminders (via a simple backend)
- [ ] Prepayment impact simulator
- [ ] Multi-currency support

---

## Author

Built by **Gitesh Jethwa** as a portfolio project — to explore product thinking, interaction design, and AI-augmented UX in the personal finance space.

[LinkedIn](https://linkedin.com/in/your-handle) · [Portfolio](https://your-portfolio.com)
