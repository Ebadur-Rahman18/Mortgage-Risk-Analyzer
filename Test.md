# **How to Test Mortgage Risk Copilot (UI)**

Follow these steps in order. You need a logged-in user (loan officer or admin works best).

---

## **Before you start**

1. **Dev app running**
    
    `npm run dev` → open the app (usually `http://localhost:5173`).
    
2. **Module enabled**
    - Go to **Admin → Module Management**
    - Confirm **Mortgage Risk Copilot** is **on**
    - (It should be on by default after the migration.)
3. **Permissions**
    
    Your role should allow:
    
    - View loans
    - Run Risk Copilot analysis
    - Use Risk Copilot chat
    
    If **Run Analysis** or **Chat** is missing, an admin may need to grant:
    
    - `loan_risk_analyses:read`
    - `loan_risk_analyses:run`
    - `loan_risk_chat:use`
4. **Google AI configured**
    
    Analysis and chat need Gemini:
    
    - Admin → integrations: Google AI key, **or**
    - `GOOGLE_AI_API_KEY` set for edge functions
    
    Without this, **Run Analysis** / chat will fail with an API error.
    

---

## **Test 1 — Create a loan with Risk Copilot fields**

1. Sign in.
2. Sidebar → **Loans**.
3. Click **Add Loan** (or go to `/loans/new`).
4. **Essentials**
    - Leave **Loan number** blank → DB should auto-generate `LOAN-YYYY-NNNN` (e.g. `LOAN-2026-0001`).
    - Pick a **Borrower** (create one first under **Borrowers** if needed).
    - Set **Loan amount** (e.g. `350000`).
5. Open **Risk Copilot fields (optional)** and fill, for example:
    - Annual income: `95000`
    - Monthly debt: `1200`
    - Loan type: `Conventional`
    - Interest rate: `6.5`
    - Loan term (months): `360`
    - Down payment: `70000`
6. Open **Amounts & eligibility** → **Appraised value**: `420000`.
7. Watch **Calculated ratios** → **DTI** and **LTV** badges should update.
8. Save the loan.
9. Confirm you land on the loan detail page and the loan number looks like `LOAN-2026-XXXX` if you left it blank.

**Pass:** Loan saves; DTI/LTV show on the form; auto loan number if left empty.

---

## **Test 2 — Risk Copilot panel on loan detail**

1. Open the loan from Test 1 (**Loans** → click loan number).
2. Scroll to **Mortgage Risk Copilot** (below loan overview).
3. You should see:
    - **AI Risk Analysis** + **Run Analysis**
    - **Documents** (upload area)
    - **Risk Copilot Chat**

If the section is missing → check **Mortgage Risk Copilot** module is enabled.

---

## **Test 3 — Upload documents**

1. On the same loan detail, in **Documents** (inside Risk Copilot or loan documents area).
2. Upload a file (PDF/image is fine; no parsing required).
3. Pick a type, e.g. **Pay Stub**, **Bank Statement**, or **Other**.
4. Confirm the file appears in the list.

**Pass:** Document uploads and lists; analysis can reference document names later.

---

## **Test 4 — Run AI risk analysis**

1. On loan detail → **Mortgage Risk Copilot** → **Run Analysis**.
2. Wait (may take 10–30+ seconds).
3. On success you should see:
    - **Risk score** (0–100)
    - **Risk level** (High / Medium / Low)
    - **Summary**
    - **Risk factors** and **Recommendations**
    - **DTI** / **LTV** if the loan had those fields

**Pass:** Results appear; no error toast.

**If it fails:** Check Google API key and browser network tab for `analyze-mortgage` errors.

---

## **Test 5 — Analysis history & outdated flag**

1. **Edit loan** → change something that affects risk, e.g. **Annual income** or **Monthly debt**.
2. Save.
3. Back on loan detail → previous analysis should show as **Outdated** (or prompt to re-run).
4. Click **Run Analysis** again.
5. Open **Analysis history** → you should see multiple runs; the newest non-outdated one is “current.”

**Pass:** Edit marks old analysis outdated; new run creates a new history entry.

---

## **Test 6 — Risk Copilot chat**

1. On the same loan → **Risk Copilot Chat**.
2. Ask something specific, e.g.*“What is this borrower’s DTI and main risk factors?”*
3. Send and wait for a reply.
4. Ask a follow-up, e.g.*“What documents would reduce risk?”*
5. Refresh the page → messages should still be there.

**Pass:** Replies are relevant to the loan; history persists after refresh.

---

## **Test 7 — Loans list filters & badges**

1. Sidebar → **Loans**.
2. In search, try:
    - Loan number
    - Borrower first or last name
3. If Risk Copilot is enabled, use filters:
    - **Loan type** (e.g. Conventional)
    - **Risk level** (High / Medium / Low)
4. Check the **Copilot risk** column for badges on analyzed loans.

**Pass:** Search and filters work; analyzed loans show risk badges.

---

## **Test 8 — Risk Dashboard**

1. Sidebar → **Risk Dashboard** (or `/loans/risk-dashboard`).
2. You should see:
    - Total loans
    - Counts by risk level
    - **Applications by status** chart
    - **Risk distribution** chart
    - **Recently analyzed** table
    - **Latest analysis summaries**

**Pass:** Stats match loans you analyzed; recently analyzed includes your test loan.

---

## **Test 9 — JSON import (Risk Copilot)**

1. Go to **Loans** → import (or `/loans/import`).
2. Open the **JSON** tab.
3. Use **Download JSON template** or paste sample JSON, e.g.:

{

"borrowerName": "Jane Smith",

"email": "jane@example.com",

"phone": "555-0100",

"propertyAddress": "123 Main St",

"propertyCity": "Austin",

"propertyState": "TX",

"propertyPostalCode": "78701",

"loanAmount": 350000,

"loanType": "Conventional",

"loanTerm": 360,

"interestRate": 6.5,

"annualIncome": 95000,

"monthlyDebt": 1200,

"creditScore": 720,

"employmentYears": 5,

"downPayment": 70000,

"propertyValue": 420000,

"status": "Pending"

}

1. Click **Validate** → preview should show parsed fields.
2. Click **Create borrower & loan**.
3. You should be redirected to edit the new loan; then open detail and run analysis as in Tests 2–4.

**Pass:** Valid JSON creates borrower + loan; invalid JSON shows errors and does not save.

---

## **Test 10 — XML import (optional)**

1. Same import page → **XML** tab.
2. Paste XML with matching tags, e.g.:

<MortgageApplication>

<borrowerName>John Doe</borrowerName>

<email>john@example.com</email>

<propertyAddress>456 Oak Ave</propertyAddress>

<loanAmount>300000</loanAmount>

<annualIncome>80000</annualIncome>

<monthlyDebt>900</monthlyDebt>

<propertyValue>375000</propertyValue>

</MortgageApplication>

1. **Validate** → **Create borrower & loan** → same flow as JSON.

---

## **Quick checklist**

| **#** | **What to test** | **Where** |
| --- | --- | --- |
| 1 | Auto loan number + Risk Copilot fields + DTI/LTV | Add Loan |
| 2 | Copilot section visible | Loan detail |
| 3 | Document upload | Loan detail → Documents |
| 4 | Run analysis | Loan detail → Run Analysis |
| 5 | Outdated + history after edit | Edit loan → re-run analysis |
| 6 | Chat + persistence | Loan detail → Chat |
| 7 | Search & filters | Loans list |
| 8 | Charts & tables | Risk Dashboard |
| 9 | JSON import | Import → JSON |
| 10 | XML import | Import → XML |

---

## **Common issues**

| **Symptom** | **Likely cause** |
| --- | --- |
| No “Risk Dashboard” or Copilot section | Module off or missing permissions |
| “Run Analysis” fails immediately | Google API key not set for edge functions |
| No Copilot risk column on Loans | `mortgage_risk_copilot` module disabled |
| Chat empty after refresh | Edge function or DB error; check network/console |
| Loan number not auto-generated | You entered a number manually; trigger only runs when blank |

If you tell me your role (admin vs loan officer) and whether the Copilot section shows up, I can narrow this to a minimal 5-minute smoke test path.

Give me the route for module management

Module Management is at:

**`/admin/modules`**

With the dev server on port 5173:

**http://localhost:5173/admin/modules**

**How to get there in the UI**

1. Open the **Admin Panel** (profile menu → Admin, or sidebar if you’re an admin).
2. In the admin sidebar, click **Module Management**.

**Access:** Admin (or users with admin panel access). Non-admins are redirected if they open the URL directly.