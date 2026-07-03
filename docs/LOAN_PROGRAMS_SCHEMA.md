# Loan Programs Module – Database Schema & Structure

## Overview

This document defines the database structure for managing Loan Products and Loan Programs in the Mortgage LOS system.

The architecture separates:

- Product → High-level loan type (e.g., Conventional 30Y Fixed)
- Program → Specific configuration of a product (e.g., 95% LTV, 740+ FICO)

This allows scalability for pricing, eligibility rules, and reporting.

---

# 1️⃣ Loan Products Table

## Table: loan_products

Represents broad loan product categories selectable by Loan Officer.

| Column Name     | Type            | Description |
|---------------|----------------|-------------|
| id            | UUID (PK)      | Unique identifier |
| product_name  | VARCHAR(150)   | Display name (e.g., Conventional 30Y Fixed) |
| product_type  | VARCHAR(50)    | Conventional / FHA / VA / Jumbo / USDA / HELOC |
| term_months   | INT            | 360, 180, etc. |
| rate_type     | VARCHAR(20)    | Fixed / ARM |
| is_active     | BOOLEAN        | Whether visible in dropdown |
| created_at    | TIMESTAMP      | Record creation date |
| updated_at    | TIMESTAMP      | Last update date |
| created_by    | UUID (FK users.id) | Admin who created |

---

# 2️⃣ Loan Programs Table

## Table: loan_programs

Represents detailed program rules tied to a product.

| Column Name        | Type            | Description |
|-------------------|----------------|-------------|
| id                | UUID (PK)      | Unique identifier |
| product_id        | UUID (FK loan_products.id) | Linked product |
| program_code      | VARCHAR(50)    | Internal reference code |
| program_name      | VARCHAR(150)   | Example: Conv 30Y Fixed 95% LTV 740+ |
| min_credit_score  | INT            | Minimum FICO |
| max_ltv           | DECIMAL(5,2)   | Maximum Loan-to-Value |
| max_dti           | DECIMAL(5,2)   | Maximum Debt-to-Income |
| occupancy_type    | VARCHAR(50)    | Primary / Second Home / Investment |
| loan_limit        | DECIMAL(15,2)  | Max loan amount |
| is_active         | BOOLEAN        | Active for selection |
| created_at        | TIMESTAMP      | Created date |
| updated_at        | TIMESTAMP      | Updated date |
| created_by        | UUID (FK users.id) | Admin creator |

---

# 3️⃣ Relationship Diagram

loan_products (1)
        |
        | 1 → Many
        ↓
loan_programs (Many)

One Product can have multiple Programs.

Example:

Product:
- Conventional 30Y Fixed

Programs under it:
- 80% LTV – 700 FICO
- 90% LTV – 720 FICO
- 95% LTV – 740 FICO

---

# 4️⃣ Example Seed Data

## loan_products

| product_name | product_type | term_months | rate_type |
|--------------|-------------|------------|-----------|
| Conventional 30Y Fixed | Conventional | 360 | Fixed |
| FHA 30Y Fixed | FHA | 360 | Fixed |
| VA 30Y Fixed | VA | 360 | Fixed |
| Jumbo 30Y Fixed | Jumbo | 360 | Fixed |
| 5/1 ARM | Conventional | 360 | ARM |

---

## loan_programs

| program_name | min_credit_score | max_ltv | max_dti |
|-------------|------------------|--------|--------|
| Conv 30Y Fixed 80% LTV 700+ | 700 | 80.00 | 43.00 |
| Conv 30Y Fixed 95% LTV 740+ | 740 | 95.00 | 45.00 |
| FHA 30Y 96.5% LTV | 580 | 96.50 | 50.00 |
| VA 100% Financing | 620 | 100.00 | 50.00 |

---

# 5️⃣ Role-Based Control (Future Step)

Only:
- SuperAdmin
- Admin

Should have:
- Create Program
- Edit Program
- Disable Program

Loan Officer:
- Read-only (dropdown selection)

---

# 6️⃣ Design Principles

- Never allow free-text product entry.
- Always use foreign key relationship.
- Soft delete using `is_active = false`.
- Keep eligibility rules at Program level, not Product level.
- Prepare for future pricing integration by adding `pricing_engine_code` column if needed.

---

# End of Document
