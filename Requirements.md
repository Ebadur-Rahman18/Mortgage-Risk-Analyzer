# Requirements

## Overview

Build an AI-powered Mortgage Risk Copilot feature that enables users to manage mortgage applications, upload supporting documents, perform AI-driven risk analysis, and interact with an AI assistant for mortgage-specific questions.

The feature should integrate with an existing React and Supabase application. Authentication and the overall project structure are assumed to already exist.

---

# Functional Requirements

## 1. Mortgage Application Management

The system shall allow users to:

- Create a mortgage application
- View all mortgage applications
- View application details
- Edit an existing application
- Delete a mortgage application
- Automatically generate a unique loan number using the format:
  - `LOAN-YYYY-NNNN`

Each application must contain at least the following information:

- Borrower Name
- Email
- Phone
- Property Address
- Loan Amount
- Loan Type
- Loan Term
- Interest Rate
- Annual Income
- Monthly Debt
- Credit Score
- Employment Years
- Down Payment
- Property Value
- Status

Application status values:

- Pending
- Under Review
- Approved
- Rejected

---

## 2. Mortgage Import

The system shall support importing mortgage applications from:

- JSON
- XML

Imported data must automatically populate the mortgage application form.

The imported data must be validated before saving.

---

## 3. Document Upload

Users shall be able to upload multiple supporting documents for each mortgage application.

Supported document categories include:

- Mortgage Application
- Pay Stub
- Tax Return
- Bank Statement
- Credit Report
- Employment Verification
- Property Appraisal
- Other

Uploaded files shall be stored in Supabase Storage.

Storage path format:

```
{user_id}/{application_id}/{filename}
```

---

## 4. AI Mortgage Risk Analysis

Users shall be able to trigger an AI analysis for a mortgage application.

The AI analysis must generate:

- Risk Score (0–100)
- Risk Level
- Summary
- Risk Factors
- Recommendations

Risk Level values:

- High
- Medium
- Low

The analysis must use:

- Mortgage application information
- Uploaded documents
- Calculated DTI
- Calculated LTV

The analysis result shall be stored in the database.

---

## 5. Analysis History

The system shall:

- Preserve every analysis
- Never overwrite previous analyses
- Mark previous analyses as outdated whenever an application is edited
- Display the latest analysis by default

Dashboard statistics should only use the latest analysis.

---

## 6. AI Mortgage Chat

Users shall be able to chat with an AI assistant for each mortgage application.

The AI should answer questions using:

- Mortgage application data
- Uploaded documents
- Previous conversation history

Chat responses should be contextual to the selected mortgage application.

Streaming responses are not required.

---

## 7. Dashboard

Provide dashboard statistics including:

- Total mortgage applications
- Applications by status
- Risk distribution
- Recently analyzed applications
- Latest AI analysis summary

Dashboard metrics must only consider the latest analysis for each application.

---

## 8. Search and Filtering

Users shall be able to search applications by:

- Borrower Name
- Loan Number

Users shall be able to filter applications by:

- Loan Type
- Application Status
- Risk Level

---

## 9. Mortgage Calculations

Automatically calculate:

### Debt-to-Income Ratio (DTI)

```
DTI = Monthly Debt / (Annual Income / 12)
```

### Loan-to-Value Ratio (LTV)

```
LTV = Loan Amount / Property Value
```

These values must be included in the AI analysis request.

---

## 10. Validation

Use Zod validation for:

- Mortgage application forms
- JSON imports
- XML imports

Invalid data must not be saved.

---

# AI Requirements

Use Google Gemini 2.5 Flash through Supabase Edge Functions.

## Analyze Mortgage

Generate structured JSON using the following format:

```ts
interface AnalysisResult {
  riskScore: number;
  riskLevel: "High" | "Medium" | "Low";
  summary: string;
  riskFactors: string[];
  recommendations: string[];
}
```

## Mortgage Chat

Generate contextual text responses.

Streaming responses are not required.

---

# Database Requirements

Required tables:

- profiles
- mortgage_applications
- uploaded_documents
- risk_analysis
- chat_history

Required triggers:

- Generate loan number
- Create profile after user registration
- Mark previous analyses as outdated after application updates

---

# Security Requirements

- Use Supabase Row Level Security (RLS)
- Scope all records to the authenticated user
- Never expose the Gemini API key to the frontend
- All AI requests must go through Supabase Edge Functions

---

# Technical Requirements

- React
- TypeScript (strict mode)
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS
- Framer Motion (optional for animations)
- Recharts (dashboard visualizations)
- Supabase
- Supabase Storage
- Supabase Edge Functions

---

# Non-Functional Requirements

The feature should:

- Be responsive on desktop, tablet, and mobile
- Preserve AI analysis history
- Handle API failures gracefully
- Display loading states during AI operations
- Display user-friendly error messages
- Keep business logic outside UI components
- Use a service layer for backend communication

---

# Out of Scope

The following features are not required:

- PDF document parsing
- OCR
- Streaming AI responses
- Email verification
- Loan comparison
- PDF report export
- Multi-user collaboration
- Real-time updates