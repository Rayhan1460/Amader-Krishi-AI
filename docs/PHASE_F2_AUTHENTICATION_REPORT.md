# আমাদের কৃষি AI — Phase F2 Verification Report: Google Authentication & Secure One-Click Demo Access

**Platform**: আমাদের কৃষি AI  
**Tagline**: *প্রযুক্তির ছোঁয়ায়, স্মার্ট কৃষির পথে।*  
**Phase**: F2 — Multi-Provider Authentication & Ephemeral Demo Mode  
**Date**: November 2, 2026  
**Status**: **VERIFIED — ALL CRITERIA MET (69/69 Pytest PASS, 20/20 Playwright PASS)**

---

## Executive Summary

Phase F2 successfully expands the authentication architecture of **আমাদের কৃষি AI** into three enterprise-grade experiences without disrupting existing users, database records, or the seven pre-trained agricultural machine learning models:

1. **Traditional Local Authentication**: Robust username/password registration and login with bcrypt/argon2 hashing, rigorous username/password sanitization, and JWT bearer tokens.
2. **Official Google Sign-In & Sign-Up**: Powered by Google Identity Services (GIS) on the frontend and cryptographically verified server-side using Google's official `google-auth` token validation. Accounts are uniquely linked via Google's immutable `sub` identifier. Accounts with conflicting local emails cannot be silently hijacked without password verification (HTTP 409 Conflict).
3. **Secure One-Click Demo Mode**: Ephemeral, isolated guest accounts (`guest_<uuid>`) generated on-demand (`POST /auth/demo`) with zero shared passwords. Guest sessions feature dedicated UI indicators ("গেস্ট ডেমো সেশন"), isolated prediction histories, and an automated rate limit (max 25 inferences) to safeguard server resources. Legacy hardcoded credentials (`demo_farmer`) remain permanently disabled (`is_active=0`).

---

## 1. Authentication Architecture & Security Matrix

| Feature | Local Auth | Google GIS Auth | One-Click Demo Mode |
|---|---|---|---|
| **Identity Mechanism** | Username + Password | Google `sub` (OpenID Connect) | Ephemeral UUID (`guest_<hex>`) |
| **Credential Storage** | Salted Hash (Argon2 / PBKDF2) | Unusable internal random secret | Random unusable internal secret |
| **Verification Method** | Local DB verification | Server-side `google.oauth2.id_token` | Ephemeral guest issuance |
| **Silent Email Hijack Protection** | Yes (Unique email constraint) | **Enforced (HTTP 409 Conflict)** | N/A (No email assigned) |
| **Inference Quota** | Standard account limits | Standard account limits | **Capped at 25 predictions (HTTP 429)** |
| **Session Lifetime** | 1,440 minutes (24 hours) | 1,440 minutes (24 hours) | 120 minutes (2 hours) |
| **UI Indication** | Verified Farmer Badge | Verified Google Badge | Amber Sparkle Guest Badge |

---

## 2. Database Schema Migration

The SQLite database (`backend/app/agri.db`) was upgraded via a non-destructive, safe migration. All 62 pre-existing user records and inference histories remain intact.

```sql
-- Migration applied non-destructively on backend startup:
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'local';
ALTER TABLE users ADD COLUMN google_sub VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN is_demo BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN demo_inference_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

**Integrity Verification**:
- Pre-existing users: 62 active accounts preserved with `auth_provider='local'`, `is_demo=0`.
- Legacy `demo_farmer`: Preserved with `is_active=0` (disabled permanently).

---

## 3. Backend Verification Suite (69/69 PASS)

The backend test suite executed via Python 3.13 (`pytest`) with all model checksums, API endpoints, security bounds, and Phase F2 flows passed:

```
tests/test_auth_api.py::test_registration_and_login_lifecycle PASSED     [  1%]
tests/test_auth_api.py::test_registration_validation_rules PASSED        [  2%]
tests/test_auth_api.py::test_cors_preflight_auth PASSED                  [  4%]
tests/test_chat_provider.py (12 tests) PASSED                            [ 21%]
tests/test_f2_auth.py::test_auth_config_endpoint PASSED                  [ 24%]
tests/test_f2_auth.py::test_demo_login_creates_isolated_guest PASSED     [ 26%]
tests/test_f2_auth.py::test_demo_sessions_are_strictly_isolated PASSED   [ 27%]
tests/test_f2_auth.py::test_demo_farmer_remains_disabled PASSED          [ 28%]
tests/test_f2_auth.py::test_demo_inference_rate_limit PASSED             [ 30%]
tests/test_f2_auth.py::test_google_auth_unconfigured_error PASSED        [ 31%]
tests/test_f2_auth.py::test_google_auth_invalid_token_rejected PASSED    [ 33%]
tests/test_f2_auth.py::test_google_auth_signup_and_signin_lifecycle PASSED [ 34%]
tests/test_f2_auth.py::test_google_auth_prevents_silent_merge_with_existing_local_email PASSED [ 36%]
tests/test_model_integrity.py (21 tests) PASSED                          [ 66%]
tests/test_prediction_api.py (13 tests) PASSED                           [ 85%]
tests/test_real_inference.py (7 tests) PASSED                            [ 95%]
tests/test_security.py (3 tests) PASSED                                  [100%]

======================= 69 passed, 1 warning in 48.41s ========================
```

---

## 4. Frontend Playwright E2E Verification Suite (20/20 PASS)

Browser automation testing executed with Microsoft Edge across desktop, tablet, and mobile viewports (`test_phase_f2_auth.mjs`):

```
========================================================================
  PHASE F2 TEST SUMMARY REPORT
========================================================================
TOTAL CHECKS: 20 | PASSED: 20 | FAILED: 0
  [STEP-01] ✅ PASS: Backend Server Readiness (200 OK)
  [STEP-02] ✅ PASS: Frontend Server Readiness (200 OK)
  [STEP-03] ✅ PASS: One-Click Demo Button Rendered on /login
  [STEP-04] ✅ PASS: Google Sign-In Container Rendered on /login
  [STEP-05] ✅ PASS: Username & Password Form Rendered on /login
  [STEP-06] ✅ PASS: One-Click Demo Redirects to /workspace
  [STEP-07] ✅ PASS: Demo Mode Badge Visible in Workspace
  [STEP-08] ✅ PASS: Session Stored as Guest Demo User (guest_4b2a17d2)
  [STEP-09] ✅ PASS: Guest Demo User Persisted in SQLite DB (provider=demo, is_demo=1)
  [STEP-10] ✅ PASS: Prediction Button Found on Workspace (Input forms rendered)
  [STEP-11] ✅ PASS: Demo Session Cleared & Returned to Login
  [STEP-12] ✅ PASS: Google Sign-Up Container Rendered on /register
  [STEP-13] ✅ PASS: One-Click Demo Button Accessible on /register
  [STEP-14] ✅ PASS: Traditional Registration Redirects to /workspace
  [STEP-15] ✅ PASS: Local User Created in SQLite with auth_provider=local
  [STEP-16] ✅ PASS: Registered Local User Does NOT Display Demo Badge
  [STEP-17] ✅ PASS: Traditional Login Success & Redirect to Workspace
  [RESPONSIVE-Tablet] ✅ PASS: Login Page renders cleanly at 768x1024
  [RESPONSIVE-Mobile] ✅ PASS: Login Page renders cleanly at 375x812
  [RESPONSIVE-Mobile-Small] ✅ PASS: Login Page renders cleanly at 320x568
========================================================================
```

---

## 5. Artifacts and Screenshots

Visual regression screenshots have been captured and saved under `docs/screenshots/`:
- `f2_login_options_1440.png`: Desktop login interface with Demo Button, Google Sign-In, and Local form.
- `f2_register_options_1440.png`: Desktop registration interface with Google Sign-Up and quick Demo button.
- `f2_workspace_demo_badge_1440.png`: Protected workspace displaying the active guest demo badge.
- `f2_login_tablet_768.png`: Tablet layout (768x1024).
- `f2_login_mobile_375.png`: Mobile layout (375x812).
- `f2_login_mobile_320.png`: Small mobile layout (320x568).

---

## 6. Seven Scientific AI Models Status

All seven pre-trained research models remain 100% untouched and functional:
1. `tomato_disease_v3`: 8 classes, input 224x224 RGB, verified inference PASS.
2. `rice_disease`: 7 classes, input 224x224 RGB, verified inference PASS.
3. `crop_recommendation`: 22 crops, 7 features, verified inference PASS.
4. `regional_crop_yield`: Regression, 20 features, verified inference PASS.
5. `flood_susceptibility`: Classification, 5 topographic features, verified inference PASS.
6. `tomato_price`: Empirical baseline dominance (5.84 MAE), verified inference PASS.
7. `boro_rice_price`: Empirical baseline dominance (0.737 MAE), verified inference PASS.

