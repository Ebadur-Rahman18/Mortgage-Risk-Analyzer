-- Seed one knowledge entry per child category so no category is empty.
-- Idempotent: ON CONFLICT (slug) DO NOTHING.

INSERT INTO public.knowledge_entries (title, slug, content, status, category_id, summary, tags)
SELECT
  e.title,
  e.slug,
  e.content,
  'published',
  kc.id,
  e.summary,
  e.tags
FROM (
  VALUES
  -- ── Mortgage Topics ─────────────────────────────────────
  (
    'mortgage-basics',
    'Mortgage Basics: Key Concepts Every Loan Officer Should Know',
    'mortgage-basics-key-concepts',
    E'# Mortgage Basics\n\nA mortgage is a loan secured by real property. The borrower (mortgagor) pledges the property to the lender (mortgagee) as collateral.\n\n## Core Terms\n\n- **Principal** – The original loan amount.\n- **Interest Rate** – The cost of borrowing, expressed as an annual percentage.\n- **Amortization** – The schedule of periodic payments that retire both principal and interest over the loan term.\n- **LTV (Loan-to-Value)** – The ratio of the loan amount to the appraised value of the property.\n- **DTI (Debt-to-Income)** – The percentage of gross monthly income that goes toward debt payments.\n\n## Common Loan Types\n\n| Type | Key Feature |\n|------|-------------|\n| Fixed-rate | Interest rate stays the same for the entire term |\n| ARM | Rate adjusts periodically after an initial fixed period |\n| Interest-only | Borrower pays only interest for a set period |\n\n## Why It Matters\n\nUnderstanding these fundamentals helps loan officers set accurate borrower expectations and avoid costly errors during origination.',
    'Overview of core mortgage terminology, loan types, and fundamental concepts for loan officers.',
    ARRAY['basics','terminology','LTV','DTI']
  ),
  (
    'loan-programs-and-eligibility',
    'Loan Programs & Eligibility: Conventional, FHA, VA, USDA',
    'loan-programs-eligibility-guide',
    E'# Loan Programs & Eligibility\n\n## Conventional Loans\n- Conforming limits set by FHFA (2025: $766,550 in most areas).\n- Minimum 620 FICO; 3 % down for first-time buyers.\n- PMI required below 80 % LTV.\n\n## FHA Loans\n- Insured by the Federal Housing Administration.\n- Minimum 580 FICO for 3.5 % down; 500-579 requires 10 % down.\n- Upfront and annual MIP required.\n\n## VA Loans\n- Guaranteed by the Department of Veterans Affairs.\n- No down payment; no PMI.\n- Eligibility requires a Certificate of Eligibility (COE).\n\n## USDA Loans\n- For rural and suburban properties.\n- 100 % financing; income caps apply.\n- Guarantee fee required.\n\n## Quick Comparison\n\n| Feature | Conv. | FHA | VA | USDA |\n|---------|-------|-----|----|------|\n| Min Down | 3% | 3.5% | 0% | 0% |\n| PMI/MIP | Yes | Yes | No | Fee |\n| Min FICO | 620 | 580 | None | 640 |',
    'Quick-reference guide comparing Conventional, FHA, VA, and USDA loan programs.',
    ARRAY['FHA','VA','USDA','conventional','eligibility']
  ),
  (
    'underwriting-guidelines',
    'Underwriting Guidelines: What Underwriters Look For',
    'underwriting-guidelines-overview',
    E'# Underwriting Guidelines\n\nUnderwriting evaluates borrower risk across the **4 Cs**: Credit, Capacity, Collateral, and Capital.\n\n## Credit\n- Pull a tri-merge credit report.\n- Look for derogatory marks: lates, collections, BK, foreclosure.\n- Score thresholds vary by product (Conv ≥620, FHA ≥580).\n\n## Capacity (Income)\n- Verify stable income (W-2, paystubs, tax returns).\n- Front-end DTI typically ≤28 %; back-end ≤43-50 % depending on AUS.\n\n## Collateral\n- Appraisal confirms value and condition.\n- Property must meet minimum property requirements (MPR) for government loans.\n\n## Capital (Assets)\n- Verify reserves: 2-6 months PITI depending on loan type.\n- Gift funds allowed with a gift letter and paper trail.\n\n## Red Flags\n- Large undisclosed deposits.\n- Employment gaps > 30 days.\n- Declining income trends.',
    'Summary of underwriting criteria across credit, capacity, collateral, and capital dimensions.',
    ARRAY['underwriting','4Cs','credit','income','appraisal']
  ),
  (
    'rate-locks-and-pricing-concepts',
    'Rate Locks & Pricing: How Lock Periods and Pricing Work',
    'rate-locks-pricing-concepts',
    E'# Rate Locks & Pricing\n\n## What Is a Rate Lock?\nA rate lock guarantees a specific interest rate for a set period (typically 15-60 days). If rates rise during this window, the borrower keeps the locked rate.\n\n## Lock Period Options\n| Period | Typical Pricing Impact |\n|--------|------------------------|\n| 15 days | Best pricing |\n| 30 days | Standard |\n| 45 days | Slight premium |\n| 60 days | Higher premium |\n\n## Float-Down\nSome lock programs allow a one-time float-down if rates drop by ≥0.25 % after lock.\n\n## Key Policies\n- **Lock extensions**: Usually cost 0.125 % per 7-day extension.\n- **Renegotiations**: Typically not allowed unless rates drop significantly.\n- **Worst-case pricing**: Investor may apply worst-case pricing if lock expires before delivery.',
    'Explains rate lock mechanics, pricing tiers, float-down options, and extension policies.',
    ARRAY['rate-lock','pricing','float-down','lock-extension']
  ),
  (
    'closing-and-post-closing',
    'Closing & Post-Closing: Final Steps to Fund a Loan',
    'closing-post-closing-guide',
    E'# Closing & Post-Closing\n\n## Pre-Closing Checklist\n1. Clear-to-close (CTC) issued by underwriting.\n2. Final CD (Closing Disclosure) sent to borrower ≥3 business days before closing.\n3. Wire instructions verified with title company.\n4. Confirm homeowner''s insurance binder.\n\n## At the Closing Table\n- Borrower signs the note, deed of trust, and closing disclosure.\n- Funds are disbursed; title transfers.\n- Recording occurs at the county recorder''s office.\n\n## Post-Closing\n- Trailing documents sent to investor within 30 days.\n- First payment letter mailed to borrower.\n- Servicing transfer notice (if applicable) within 15 days.\n- Quality control (QC) review on selected files.',
    'Step-by-step guide to the closing and post-closing process in mortgage origination.',
    ARRAY['closing','post-closing','CTC','funding']
  ),
  (
    'mortgage-compliance-topics',
    'Mortgage Compliance: TRID, HMDA, and Fair Lending',
    'mortgage-compliance-trid-hmda',
    E'# Mortgage Compliance\n\n## TRID (TILA-RESPA Integrated Disclosures)\n- **Loan Estimate (LE)**: Must be issued within 3 business days of application.\n- **Closing Disclosure (CD)**: Must be received ≥3 business days before closing.\n- Tolerance limits: 0 %, 10 %, and no-limit buckets.\n\n## HMDA (Home Mortgage Disclosure Act)\n- Requires reporting of loan-level data on applications, originations, and denials.\n- Data used to detect discriminatory lending patterns.\n\n## Fair Lending\n- Equal Credit Opportunity Act (ECOA) prohibits discrimination.\n- Protected classes: race, color, religion, national origin, sex, marital status, age, and public assistance receipt.\n\n## Best Practices\n- Train all staff annually.\n- Use standardized checklists per loan type.\n- Document every adverse action with specific reasons.',
    'Overview of key compliance regulations (TRID, HMDA, Fair Lending) for mortgage professionals.',
    ARRAY['TRID','HMDA','compliance','fair-lending','ECOA']
  ),

  -- ── Loan Lifecycle ─────────────────────────────────────
  (
    'lead-intake',
    'Lead Intake: Capturing and Qualifying New Leads',
    'lead-intake-sop',
    E'# Lead Intake SOP\n\n## Objective\nCapture borrower intent, gather preliminary data, and determine next steps within 24 hours.\n\n## Required Information\n1. Borrower name, phone, email.\n2. Property address (or target area).\n3. Loan purpose: purchase, refinance, or cash-out.\n4. Estimated credit score range.\n5. Estimated income and down payment.\n\n## Qualification Steps\n- Pre-screen with soft credit pull (if permitted).\n- Run AUS (DU/LP) pre-qualification.\n- Issue pre-qualification letter if borrower qualifies.\n\n## Handoff\n- Assign to loan officer within CRM.\n- Set follow-up reminder at 48 hours if no response.',
    'Standard operating procedure for capturing and qualifying new mortgage leads.',
    ARRAY['lead','intake','pre-qualification','CRM']
  ),
  (
    'application',
    'Application Stage: Collecting a Complete 1003',
    'application-stage-guide',
    E'# Application Stage\n\n## The 1003 (URLA)\nThe Uniform Residential Loan Application is the backbone of every mortgage file.\n\n## Key Sections\n- **Section 1**: Borrower information\n- **Section 3**: Financial information (assets, liabilities)\n- **Section 4**: Loan and property information\n- **Section 5**: Declarations\n- **Section 8**: Demographics (optional, HMDA)\n\n## Best Practices\n- Use a digital application platform for faster collection.\n- Verify SSN matches credit report.\n- Trigger Loan Estimate within 3 business days of receiving the 6 TRID triggers.\n\n## TRID 6 Triggers\n1. Borrower name\n2. Income\n3. SSN\n4. Property address\n5. Estimated property value\n6. Loan amount',
    'Guide to collecting a complete URLA (1003) and triggering TRID disclosures.',
    ARRAY['1003','URLA','application','TRID-triggers']
  ),
  (
    'processing',
    'Processing: Ordering Services and Building the File',
    'processing-stage-guide',
    E'# Processing Stage\n\n## Processor Responsibilities\n1. Order appraisal, title, and flood certification.\n2. Verify employment (VOE) and bank statements (VOD).\n3. Request missing documents from borrower.\n4. Run preliminary title search.\n5. Submit file to underwriting when all conditions are met.\n\n## Common Bottlenecks\n- Appraisal delays (average 10-14 business days).\n- Borrower slow to return documents.\n- Employer verification taking > 5 days.\n\n## SLA Targets\n| Task | Target |\n|------|--------|\n| Appraisal ordered | Day 1 |\n| Title ordered | Day 1 |\n| Initial submission to UW | Day 10 |',
    'Overview of the processing stage, service ordering, and common bottleneck mitigation.',
    ARRAY['processing','appraisal','title','VOE']
  ),
  (
    'underwriting',
    'Underwriting Stage: File Review and Decision',
    'underwriting-stage-guide',
    E'# Underwriting Stage\n\n## Workflow\n1. Underwriter receives submitted file.\n2. Reviews credit, income, assets, and collateral.\n3. Issues one of: Approve/Eligible, Suspend, or Deny.\n\n## Conditional Approval\nMost files receive conditional approval with a list of **prior-to-doc (PTD)** and **prior-to-funding (PTF)** conditions.\n\n## Common Conditions\n- Updated paystubs covering the most recent 30 days.\n- Letter of explanation for credit inquiries.\n- Proof of homeowner''s insurance.\n- Final inspection (new construction).\n\n## Turn Time Goals\n- Initial review: 48 hours.\n- Condition review: 24 hours.\n- Final sign-off (CTC): Same day as conditions cleared.',
    'Guide to the underwriting review process, conditional approval, and turn-time targets.',
    ARRAY['underwriting','conditions','CTC','PTD','PTF']
  ),
  (
    'conditional-approval',
    'Conditional Approval: Clearing Conditions Efficiently',
    'conditional-approval-guide',
    E'# Clearing Conditions\n\n## Types of Conditions\n- **Prior-to-Doc (PTD)**: Must be cleared before closing docs are drawn.\n- **Prior-to-Funding (PTF)**: Must be cleared before wire is released.\n- **Prior-to-Purchase (PTP)**: Must be cleared before investor purchases the loan.\n\n## Efficient Clearing\n1. Prioritize PTD conditions first.\n2. Batch-submit conditions to underwriter (avoid one-at-a-time).\n3. Use a condition tracker to monitor status.\n\n## Communication\n- Notify borrower immediately when new conditions are added.\n- Provide clear instructions on what is needed and the deadline.',
    'Best practices for tracking and clearing underwriting conditions across PTD, PTF, and PTP stages.',
    ARRAY['conditions','PTD','PTF','PTP','clearing']
  ),
  (
    'closing',
    'Closing Stage: Coordinating the Final Settlement',
    'closing-stage-guide',
    E'# Closing Stage\n\n## Coordination Checklist\n- [ ] Schedule closing date with all parties.\n- [ ] Send final CD to borrower (3-day waiting period).\n- [ ] Verify wire instructions with title company.\n- [ ] Confirm hazard insurance binder.\n- [ ] Review HUD/CD for accuracy.\n\n## Day-of Closing\n- Borrower brings government-issued ID and certified funds (if applicable).\n- Notary witnesses signatures.\n- Closer reviews all documents page by page.\n\n## Common Issues\n- CD tolerance violations (cure required).\n- Name discrepancies between ID and documents.\n- Last-minute rate changes requiring re-disclosure.',
    'Checklist and coordination guide for the mortgage closing stage.',
    ARRAY['closing','CD','settlement','notary']
  ),
  (
    'post-closing',
    'Post-Closing: Trailing Docs and Investor Delivery',
    'post-closing-guide',
    E'# Post-Closing\n\n## Key Tasks\n1. **Trailing documents**: Collect recorded deed of trust, final title policy, and any outstanding conditions.\n2. **Investor delivery**: Ship the complete loan file to the investor within purchase timeline (typically 30-45 days).\n3. **Servicing transfer**: If servicing is released, send transfer notice to borrower within 15 days.\n4. **QC review**: Quality control selects ~10 % of closed files for post-close audit.\n\n## Common Defects Found in QC\n- Missing signatures or dates.\n- Income calculation errors.\n- Stale documents (expired before closing).\n- Appraisal discrepancies.',
    'Guide to post-closing responsibilities including trailing docs, investor delivery, and QC.',
    ARRAY['post-closing','trailing-docs','investor','QC']
  ),

  -- ── Product and Pricing ────────────────────────────────
  (
    'conventional',
    'Conventional Loans: Guidelines and Best Practices',
    'conventional-loans-guide',
    E'# Conventional Loans\n\nConventional loans are not insured or guaranteed by a government agency. They follow Fannie Mae (FNMA) or Freddie Mac (FHLMC) guidelines.\n\n## Key Parameters\n- **Max LTV**: 97 % (with PMI).\n- **Min FICO**: 620.\n- **Max DTI**: 50 % with strong compensating factors.\n- **Conforming limit**: $766,550 (2025, most areas).\n\n## PMI Removal\nPMI can be cancelled when LTV reaches 80 % based on original value, or 78 % automatically.\n\n## Common Pitfalls\n- Overlooking high-balance conforming limits in high-cost areas.\n- Not verifying reserves for investment properties (6 months PITI).',
    'Reference guide for conventional loan guidelines, limits, and PMI rules.',
    ARRAY['conventional','FNMA','FHLMC','PMI']
  ),
  (
    'fha',
    'FHA Loans: Program Rules and MIP Structure',
    'fha-loans-guide',
    E'# FHA Loans\n\nFHA loans are insured by the Federal Housing Administration, allowing lower credit scores and down payments.\n\n## MIP Structure\n- **UFMIP**: 1.75 % of the base loan amount (can be financed).\n- **Annual MIP**: 0.55 % for most 30-year loans with LTV > 95 %.\n- MIP is required for the life of the loan (unless refinanced to conventional).\n\n## Property Requirements\n- Must meet HUD Minimum Property Requirements (MPR).\n- Peeling paint on pre-1978 homes requires remediation.\n- Roof must have ≥2 years remaining useful life.\n\n## Manual Underwriting\nRequired when AUS returns a Refer. Additional compensating factors needed: reserves, low DTI, or residual income.',
    'Overview of FHA loan rules, MIP structure, and property requirements.',
    ARRAY['FHA','MIP','UFMIP','manual-underwriting']
  ),
  (
    'va',
    'VA Loans: Eligibility, Funding Fee, and Benefits',
    'va-loans-guide',
    E'# VA Loans\n\nGuaranteed by the Department of Veterans Affairs for eligible service members, veterans, and surviving spouses.\n\n## Eligibility\n- Active duty: 90 continuous days during wartime, 181 days during peacetime.\n- Reserves/Guard: 6 years of service.\n- Surviving spouses of service members who died in the line of duty.\n\n## Funding Fee\n| Down Payment | First Use | Subsequent Use |\n|---|---|---|\n| 0 % | 2.15 % | 3.3 % |\n| 5 %+ | 1.5 % | 1.5 % |\n| 10 %+ | 1.25 % | 1.25 % |\n\nFunding fee waived for veterans with service-connected disabilities.\n\n## Benefits\n- No down payment.\n- No monthly mortgage insurance.\n- Competitive interest rates.',
    'Guide to VA loan eligibility, funding fee tiers, and veteran benefits.',
    ARRAY['VA','funding-fee','COE','veteran']
  ),
  (
    'usda',
    'USDA Loans: Rural Development Financing',
    'usda-loans-guide',
    E'# USDA Loans\n\nUSDA Rural Development loans offer 100 % financing for properties in eligible rural and suburban areas.\n\n## Eligibility\n- Property must be in a USDA-eligible area (check eligibility map).\n- Household income ≤115 % of area median income.\n- Borrower must demonstrate repayment ability.\n\n## Fees\n- **Upfront guarantee fee**: 1.0 % of the loan amount.\n- **Annual fee**: 0.35 % of the unpaid balance.\n\n## Advantages\n- Zero down payment.\n- Below-market interest rates.\n- Closing costs can be rolled into the loan if appraised value exceeds purchase price.',
    'Overview of USDA Rural Development loan eligibility, fees, and advantages.',
    ARRAY['USDA','rural','guarantee-fee']
  ),
  (
    'jumbo',
    'Jumbo Loans: Non-Conforming Lending Guidelines',
    'jumbo-loans-guide',
    E'# Jumbo Loans\n\nJumbo loans exceed conforming loan limits and are held in portfolio or sold to private investors.\n\n## Typical Requirements\n- **Min FICO**: 700-720.\n- **Max LTV**: 80-90 % (varies by investor).\n- **Reserves**: 6-12 months PITI.\n- **Max DTI**: 43 %.\n\n## Key Differences from Conforming\n- Stricter documentation requirements.\n- May require two appraisals.\n- Higher interest rates (0.25-0.50 % above conforming).\n- Manual underwriting common.\n\n## Investor Overlays\nEach investor may add overlays beyond base guidelines. Always check the specific investor matrix before locking.',
    'Reference for jumbo loan requirements, investor overlays, and non-conforming guidelines.',
    ARRAY['jumbo','non-conforming','portfolio','overlays']
  ),
  (
    'lock-policy',
    'Lock Policy: Internal Rules for Rate Lock Management',
    'lock-policy-internal',
    E'# Lock Policy\n\n## Standard Lock Periods\n- 30-day lock: Default for purchase transactions.\n- 45-day lock: For new construction or complex files.\n- 60-day lock: Requires manager approval.\n\n## Lock Extensions\n- 7-day extension: 0.125 % fee.\n- 14-day extension: 0.25 % fee (max one per file).\n- Extensions beyond 14 days require VP approval.\n\n## Renegotiations\n- Allowed only for market improvements ≥0.25 % since lock date.\n- Must be requested before lock expiration.\n\n## Best-Efforts vs. Mandatory\n- **Best-efforts**: No penalty if loan doesn''t close. Used for most retail.\n- **Mandatory**: Pair-off fee if loan doesn''t deliver. Used for wholesale.',
    'Internal policy for rate lock periods, extensions, renegotiations, and delivery types.',
    ARRAY['lock-policy','extension','renegotiation','mandatory']
  ),
  (
    'rate-sheet-operations',
    'Rate Sheet Operations: Daily Pricing Workflow',
    'rate-sheet-operations-guide',
    E'# Rate Sheet Operations\n\n## Daily Workflow\n1. **Morning**: Receive rate sheet from investors/secondary desk by 9:00 AM.\n2. **Mid-day**: Monitor MBS market; issue mid-day reprice if market moves ≥25 bps.\n3. **Afternoon**: Lock desk closes at 5:00 PM ET.\n\n## Reading a Rate Sheet\n- **Par rate**: Rate at which the lender neither pays nor charges points.\n- **Discount points**: Borrower pays to buy down the rate.\n- **Rebate pricing**: Lender credits borrower closing costs; rate is above par.\n\n## Margin Components\n- Base investor price + company margin + LO comp = final borrower rate.\n- LLPA (Loan Level Price Adjustments) applied for FICO, LTV, property type.',
    'Guide to daily rate sheet operations, pricing components, and margin structure.',
    ARRAY['rate-sheet','pricing','LLPA','par-rate']
  ),

  -- ── Documents and Conditions ───────────────────────────
  (
    'income-documents',
    'Income Documentation: What to Collect and Verify',
    'income-documents-guide',
    E'# Income Documentation\n\n## Salaried Borrowers\n- Most recent 30-day paystub.\n- W-2s for the past 2 years.\n- Federal tax returns (1040) if income varies or includes commissions/bonuses.\n\n## Self-Employed Borrowers\n- 2 years of personal and business tax returns.\n- Year-to-date P&L statement (if > 3 months since last filing).\n- Business license or CPA letter.\n\n## Other Income\n- **Social Security**: Award letter + 2 months bank statements.\n- **Rental income**: Lease agreements + Schedule E from tax returns.\n- **Alimony/Child Support**: Court order + 12 months receipt history.\n\n## Verbal VOE\nRequired within 10 business days of closing for all employed borrowers.',
    'Checklist for income documentation requirements across salaried, self-employed, and other income types.',
    ARRAY['income','paystub','W-2','self-employed','VOE']
  ),
  (
    'asset-documents',
    'Asset Documentation: Verifying Funds for Closing',
    'asset-documents-guide',
    E'# Asset Documentation\n\n## Standard Requirements\n- 2 most recent consecutive monthly bank statements (all pages).\n- Retirement account statements (for reserves).\n- Gift letter and donor bank statements (if using gift funds).\n\n## Large Deposit Rules\n- Any deposit > 50 % of qualifying monthly income must be sourced.\n- Provide paper trail: transfer records, sale proceeds, etc.\n\n## Unacceptable Sources\n- Cash on hand (unsourced).\n- Cryptocurrency (most investors).\n- Borrowed funds not disclosed on the application.\n\n## Down Payment Sources by Loan Type\n| Source | Conv | FHA | VA | USDA |\n|--------|------|-----|----|------|\n| Savings | Yes | Yes | Yes | Yes |\n| Gift | Yes* | Yes | Yes | Yes |\n| Grant | Yes | Yes | Yes | Yes |\n\n*Conventional requires 5 % own funds for investment properties.',
    'Guide to asset documentation, large deposit rules, and acceptable fund sources.',
    ARRAY['assets','bank-statements','gift-funds','large-deposits']
  ),
  (
    'credit-documents',
    'Credit Documentation: Reports, Disputes, and Rapid Rescores',
    'credit-documents-guide',
    E'# Credit Documentation\n\n## Tri-Merge Credit Report\nPull from all three bureaus (Equifax, Experian, TransUnion). The qualifying score is the middle of three (or lower of two for two-score borrowers).\n\n## Common Issues\n- **Disputes**: Active disputes on accounts ≥$500 must be resolved or removed before closing.\n- **Authorized user accounts**: May be excluded if borrower is not the primary.\n- **Medical collections**: Excluded from FICO 10T and most AUS decisions.\n\n## Rapid Rescore\nA rapid rescore can update the credit report within 3-5 business days after:\n- Paying down a balance.\n- Removing an erroneous tradeline.\n- Adding a missing account.\n\nCost: ~$25-$75 per tradeline per bureau.',
    'Reference for credit report handling, dispute resolution, and rapid rescore process.',
    ARRAY['credit','tri-merge','rescore','disputes']
  ),
  (
    'property-documents',
    'Property Documents: Appraisal, Title, and Insurance',
    'property-documents-guide',
    E'# Property Documents\n\n## Appraisal\n- Ordered through an AMC (Appraisal Management Company).\n- Must comply with USPAP standards.\n- Valid for 120 days (180 days for FHA with update).\n\n## Title Search\n- Preliminary title report identifies liens, easements, and encumbrances.\n- Title insurance protects lender (and optionally the buyer) from defects.\n\n## Homeowner''s Insurance\n- Must be in place before closing.\n- Coverage ≥ replacement cost of the dwelling.\n- Flood insurance required if property is in a FEMA flood zone.\n\n## Survey\nRequired by some investors for detached properties. Confirms property boundaries match legal description.',
    'Guide to property-related documents including appraisal, title, insurance, and survey requirements.',
    ARRAY['appraisal','title','insurance','flood','survey']
  ),
  (
    'condition-clearing',
    'Condition Clearing: A Processor''s Playbook',
    'condition-clearing-playbook',
    E'# Condition Clearing Playbook\n\n## Prioritization\n1. **Showstoppers**: Items that block CTC (e.g., unresolved title issues, missing appraisal).\n2. **PTD conditions**: Must be cleared before docs are drawn.\n3. **PTF conditions**: Can be cleared between doc signing and funding.\n\n## Tips for Fast Turnaround\n- Submit conditions in batches, not one at a time.\n- Pre-check documents for completeness before sending to underwriter.\n- Use a shared tracker visible to LO, processor, and underwriter.\n\n## Common Rejections\n- Paystub doesn''t cover the required 30-day period.\n- Bank statement is missing pages.\n- LOE (Letter of Explanation) doesn''t address the specific question.',
    'Processor playbook for efficiently clearing underwriting conditions.',
    ARRAY['conditions','PTD','PTF','clearing','processor']
  ),
  (
    'trailing-documents',
    'Trailing Documents: Post-Closing Collection Guide',
    'trailing-documents-guide',
    E'# Trailing Documents\n\n## What Are Trailing Docs?\nDocuments that were not available at closing but are required for the investor to purchase the loan.\n\n## Common Trailing Documents\n- Recorded deed of trust (from county recorder).\n- Final title policy.\n- Corrected documents (if errors found post-close).\n- Final HUD-1/CD with recording stamps.\n\n## Timelines\n| Document | Deadline |\n|----------|----------|\n| Recorded deed | 60 days post-close |\n| Final title policy | 120 days post-close |\n| Corrected docs | As soon as identified |\n\n## Impact of Missing Trailing Docs\n- Investor may charge penalties or refuse to purchase.\n- Loan may be flagged in QC audit.',
    'Guide to post-closing trailing document requirements and investor delivery timelines.',
    ARRAY['trailing-docs','recorded-deed','title-policy','post-closing']
  ),

  -- ── Borrower Communication ─────────────────────────────
  (
    'status-updates',
    'Status Updates: Keeping Borrowers Informed',
    'status-updates-template',
    E'# Status Update Templates\n\n## When to Send Updates\n- **Application received**: Within 24 hours.\n- **Appraisal ordered**: Same day.\n- **Submitted to underwriting**: Same day.\n- **Conditional approval**: Within 4 hours.\n- **Clear to close**: Within 2 hours.\n\n## Template: Application Received\n\n> Dear [Borrower Name],\n>\n> Thank you for submitting your mortgage application. Your file has been assigned to [Processor Name], who will be your primary point of contact.\n>\n> **Next steps:**\n> 1. We will review your documents and may request additional items.\n> 2. Your appraisal will be ordered within the next 1-2 business days.\n>\n> Please don''t hesitate to reach out with questions.\n\n## Tips\n- Always include a timeline for next steps.\n- Use the borrower''s preferred communication channel (email, text, or portal).',
    'Templates and timing guidelines for borrower status update communications.',
    ARRAY['status-update','borrower','template','communication']
  ),
  (
    'condition-requests',
    'Condition Requests: How to Ask Borrowers for Documents',
    'condition-requests-template',
    E'# Condition Request Templates\n\n## Best Practices\n- Be specific about what is needed and why.\n- Provide a deadline (typically 48-72 hours).\n- Offer to help if the borrower doesn''t understand.\n\n## Template: Missing Document\n\n> Hi [Borrower Name],\n>\n> Our underwriter has reviewed your file and needs the following to proceed:\n>\n> **Item needed:** [Document name]\n> **Why:** [Brief explanation]\n> **Deadline:** [Date]\n>\n> You can upload this through your borrower portal or reply to this email with the document attached.\n>\n> Thank you for your prompt attention — this helps us stay on track for your [closing date] closing.\n\n## Follow-Up Cadence\n- Day 0: Initial request.\n- Day 2: Reminder if no response.\n- Day 4: Phone call from LO.',
    'Templates and follow-up cadence for requesting conditions from borrowers.',
    ARRAY['condition-request','borrower','template','follow-up']
  ),
  (
    'rate-lock-reminders',
    'Rate Lock Reminders: Protecting Borrower Rates',
    'rate-lock-reminders-template',
    E'# Rate Lock Reminder Templates\n\n## When to Send\n- **At lock**: Confirm rate, term, and expiration date.\n- **7 days before expiration**: Reminder with status update.\n- **3 days before expiration**: Urgent reminder.\n\n## Template: Lock Confirmation\n\n> Dear [Borrower Name],\n>\n> Great news! Your rate has been locked:\n>\n> - **Rate:** [X.XXX]%\n> - **Term:** [30] years fixed\n> - **Lock expiration:** [Date]\n>\n> To protect this rate, we need to close by the expiration date. Please respond promptly to any document requests.\n\n## Template: Expiration Warning\n\n> Hi [Borrower Name],\n>\n> Your rate lock expires on **[Date]** — that''s [X] days away. If we need to extend, there may be a fee of [0.125]%.\n>\n> **Action needed:** [Specific items still outstanding]',
    'Templates for rate lock confirmation and expiration reminder communications.',
    ARRAY['rate-lock','reminder','borrower','expiration']
  ),
  (
    'closing-notices',
    'Closing Notices: Preparing Borrowers for Settlement',
    'closing-notices-template',
    E'# Closing Notice Templates\n\n## Pre-Closing Notice (3-5 days before)\n\n> Dear [Borrower Name],\n>\n> Your closing is scheduled for:\n>\n> - **Date:** [Date]\n> - **Time:** [Time]\n> - **Location:** [Title Company / Attorney Office]\n>\n> **What to bring:**\n> 1. Government-issued photo ID (driver''s license or passport).\n> 2. Certified/cashier''s check for $[Amount] (if applicable).\n> 3. Any outstanding documents requested.\n>\n> **Do NOT:**\n> - Open new credit accounts.\n> - Make large purchases.\n> - Change jobs.\n>\n> Congratulations on reaching this milestone!\n\n## Post-Closing Welcome\n\n> Congratulations on your new home! Your first mortgage payment of $[Amount] is due on [Date]. You will receive a welcome packet from your loan servicer within 15 days.',
    'Templates for pre-closing and post-closing borrower communications.',
    ARRAY['closing','notice','borrower','settlement']
  ),
  (
    'realtor-updates',
    'Realtor Updates: Keeping Agents in the Loop',
    'realtor-updates-template',
    E'# Realtor Update Templates\n\n## When to Update Realtors\n- **Pre-approval issued**: Same day.\n- **Appraisal completed**: Within 24 hours.\n- **Clear to close**: Same day.\n- **Closing scheduled**: Immediately.\n\n## Template: Appraisal Update\n\n> Hi [Agent Name],\n>\n> The appraisal for [Property Address] has been completed:\n>\n> - **Appraised value:** $[Value]\n> - **Status:** [Meets / Below] contract price\n>\n> [If meets]: We are on track and the file is moving to final underwriting review.\n> [If below]: We may need to discuss options with the buyer. I''ll call you today to go over next steps.\n\n## Tips\n- Realtors are your referral source — keep them well-informed.\n- Copy the borrower on updates (with permission).\n- Never share confidential borrower financial data with the agent.',
    'Templates and guidelines for keeping real estate agents updated during the loan process.',
    ARRAY['realtor','agent','update','template','referral']
  ),

  -- ── Operations and Risk ────────────────────────────────
  (
    'pipeline-prioritization',
    'Pipeline Prioritization: Ranking Loans by Urgency',
    'pipeline-prioritization-sop',
    E'# Pipeline Prioritization SOP\n\n## Urgency Scoring\nRank each loan on a 0-100 urgency scale based on:\n\n| Factor | Weight | Description |\n|--------|--------|-------------|\n| Lock expiration | 30% | Days until lock expires |\n| SLA breach risk | 25% | Days in current stage vs target |\n| Borrower engagement | 20% | Days since last borrower response |\n| Close probability | 15% | AUS approval + conditions cleared % |\n| Loan amount | 10% | Higher amounts = higher priority |\n\n## Daily Review\n- Operations manager reviews top 10 priority loans each morning.\n- Reassign resources if a loan is at risk of lock expiration.\n- Escalate loans stuck > 5 days in any single stage.\n\n## Automation\nThe Pipeline Prioritization Agent runs nightly and updates urgency scores automatically.',
    'Standard operating procedure for ranking and prioritizing loans in the pipeline.',
    ARRAY['pipeline','prioritization','urgency','SLA']
  ),
  (
    'sla-and-turn-times',
    'SLA & Turn Times: Target Benchmarks by Stage',
    'sla-turn-times-guide',
    E'# SLA & Turn Times\n\n## Target Benchmarks\n\n| Stage | Target Turn Time | Escalation Trigger |\n|-------|------------------|-----------|\n| Application to Processing | 1 business day | 2 days |\n| Processing to UW Submission | 7 business days | 10 days |\n| Initial UW Review | 48 hours | 72 hours |\n| Condition Clearing | 5 business days | 7 days |\n| CTC to Closing | 3 business days | 5 days |\n| Closing to Funding | Same day | 1 day |\n\n## Measurement\n- Track cycle times in the loan timeline events table.\n- Calculate averages weekly by loan officer and branch.\n- Flag outliers (> 2x average) for manager review.\n\n## Accountability\n- Loan officers own intake-to-submission.\n- Processors own submission-to-CTC.\n- Closers own CTC-to-funding.',
    'Target SLA benchmarks and turn-time expectations for each mortgage pipeline stage.',
    ARRAY['SLA','turn-times','benchmarks','cycle-time']
  ),
  (
    'escalations',
    'Escalation Procedures: When and How to Escalate',
    'escalation-procedures',
    E'# Escalation Procedures\n\n## When to Escalate\n- Loan stuck in any stage beyond the SLA target.\n- Borrower is unresponsive for > 5 business days.\n- Rate lock expires within 3 days with outstanding conditions.\n- Appraisal comes in below contract price.\n- Fraud indicators identified.\n\n## Escalation Levels\n\n| Level | Who | Response Time |\n|-------|-----|---------------|\n| L1 | Team Lead | 4 hours |\n| L2 | Branch Manager | 8 hours |\n| L3 | VP Operations | 24 hours |\n| L4 | Compliance/Legal | Immediate |\n\n## Escalation Template\n\n> **Escalation:** [L1/L2/L3]\n> **Loan:** [Loan Number]\n> **Issue:** [Brief description]\n> **Impact:** [Lock expiry / SLA breach / Borrower complaint]\n> **Requested Action:** [What you need from the escalation recipient]',
    'Step-by-step escalation procedures with levels, response times, and templates.',
    ARRAY['escalation','SLA','stuck-loan','manager']
  ),
  (
    'compliance-checklists',
    'Compliance Checklists: Pre-Closing Verification',
    'compliance-checklists-guide',
    E'# Compliance Checklists\n\n## Pre-Closing Compliance Review\n\n- [ ] Loan Estimate delivered within 3 business days of application.\n- [ ] Revised LE issued for valid changed circumstances.\n- [ ] Closing Disclosure received by borrower ≥3 business days before closing.\n- [ ] TRID tolerance checks pass (0 %, 10 %, no-limit buckets).\n- [ ] HMDA data fields complete and accurate.\n- [ ] Fair lending — no disparate treatment indicators.\n- [ ] ECOA adverse action notices sent within 30 days of denial.\n- [ ] Flood determination current and accurate.\n- [ ] HOEPA/QM test — loan is not a high-cost mortgage (unless intended).\n\n## Post-Closing QC\n- Random selection of 10 % of closed files.\n- Re-verify income, assets, and employment.\n- Confirm appraisal independence.',
    'Pre-closing and post-closing compliance checklists for mortgage quality assurance.',
    ARRAY['compliance','TRID','HMDA','QC','checklist']
  ),
  (
    'exceptions',
    'Exception Handling: Documenting and Approving Exceptions',
    'exception-handling-guide',
    E'# Exception Handling\n\n## What Is an Exception?\nAn exception is a deviation from standard underwriting guidelines or company policy that requires documented approval.\n\n## Common Exceptions\n- DTI above investor limit with compensating factors.\n- LTV above standard with additional reserves.\n- Employment gap > 6 months with explanation.\n- Non-standard income documentation.\n\n## Approval Process\n1. Loan officer documents the exception and compensating factors.\n2. Underwriter reviews and provides recommendation.\n3. Branch manager or credit committee approves/denies.\n4. Decision is logged in the loan file with signatures.\n\n## Documentation Requirements\n- Written justification memo.\n- Compensating factors listed (reserves, low DTI, strong credit).\n- Approval signature and date.\n\n## Tracking\nAll exceptions are tracked quarterly for pattern analysis and risk reporting.',
    'Guide to documenting, approving, and tracking underwriting exceptions.',
    ARRAY['exception','compensating-factors','approval','risk']
  )
) AS e(category_slug, title, slug, content, summary, tags)
JOIN public.knowledge_categories kc ON kc.slug = e.category_slug
ON CONFLICT (slug) DO NOTHING;
