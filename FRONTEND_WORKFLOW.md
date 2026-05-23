# FRONTEND_WORKFLOW.md

Complete guide for the DonorLedger frontend engineer.
Everything you need to build — pages, API calls, data shapes, and rules.

---

## Important: You Never Touch Blockchain Directly

The backend handles all blockchain interaction.
Your job is to call the backend API and display the results.
You do not need to understand Solidity, ethers.js, or smart contracts.
Think of the backend as a normal REST API — same as any other project.

---

## Backend Base URL

Development (local):
```
http://localhost:3001
```

Production (VPS):
```
http://103.40.204.245:3001
```

Put this in your `.env` file:
```
VITE_API_URL=http://localhost:3001
```

---

## Pages You Need To Build

```
1. Home / Campaign Browser      /
2. Campaign Detail              /campaign/:id
3. Donate Flow                  /campaign/:id/donate
4. Donor Tracker                /tracker/:donorHash
5. NGO Registration             /ngo/register
6. NGO Portal                   /ngo/dashboard
7. Bank Islam Admin             /admin
8. Demo Controls (hackathon)    /demo
```

---

## Page 1 — Home / Campaign Browser

### What it shows
- List of all verified active campaigns
- Each campaign shows: name, NGO name, cause type, progress bar,
  amount raised, target amount, donor count, days left
- Bank Islam verified badge on every campaign
- Search and filter by cause type

### API Call
```
GET /api/campaign

Response:
[
  {
    id: "clx123",
    contractAddress: "0xABC...",
    name: "Banjir Kelantan Relief 2026",
    causeType: "disaster_relief",
    ngo: {
      legalName: "Pertubuhan Kebajikan XYZ",
      riskTier: "low"
    },
    targetAmount: 100000,
    totalRaised: 87450,
    donorCount: 1247,
    daysLeft: 4,
    status: "active",
    progressPercent: 87,
    isVerified: true
  }
]
```

### Design Rules
- Verified badge must be prominent — this is the main trust signal
- Progress bar is the most important visual element
- Show "Verified by Bank Islam" text under the badge
- Unverified campaigns should NEVER appear in this list

---

## Page 2 — Campaign Detail

### What it shows
- Full campaign information
- Fund allocation breakdown (pie chart or bar: aid % / logistics % / admin %)
- List of approved vendors the donor can choose from
- Donate button
- Progress bar

### API Calls

```
GET /api/campaign/:id

Response:
{
  id: "clx123",
  name: "Banjir Kelantan Relief 2026",
  causeType: "disaster_relief",
  ngo: {
    legalName: "Pertubuhan Kebajikan XYZ",
    verifiedAt: "2026-01-15T00:00:00Z",
    riskTier: "low"
  },
  targetAmount: 100000,
  totalRaised: 87450,
  donorCount: 1247,
  daysLeft: 4,
  progressPercent: 87,
  allocation: {
    aidPercent: 70,
    logisticsPercent: 20,
    adminPercent: 10
  },
  status: "active"
}
```

```
GET /api/campaign/:id/vendors

Response:
[
  {
    id: "vendor_1",
    vendorName: "Syarikat Makanan ABC",
    serviceType: "Food Supply",
    description: "Provides food packs for flood victims"
  },
  {
    id: "vendor_2",
    vendorName: "Ekspres XYZ Sdn Bhd",
    serviceType: "Logistics",
    description: "Handles delivery to affected areas"
  }
]
```

### Design Rules
- Allocation breakdown should be visual — pie chart or colour bars
- Show vendor list clearly — donor picks ONE vendor when donating
- If campaign status is "frozen" or "under_review":
  Show banner: "This campaign is currently under review.
  Existing donations are safe and paused."
  Hide the donate button

---

## Page 3 — Donate Flow

### Steps
```
Step 1: Enter amount (minimum RM 1)
Step 2: Select vendor from approved list (required)
Step 3: Enter email (for tracker link)
Step 4: Confirm — "Pay via DuitNow" button
Step 5: Success — show tracker link
```

### API Call
```
POST /api/donate
Body:
{
  campaignId: "clx123",
  amount: 50,
  vendorId: "vendor_1",
  donorEmail: "donor@email.com"
}

Response:
{
  txHash: "0x4f2a...8c91",
  donorHash: "sha256hashstring",
  trackerUrl: "/tracker/sha256hashstring",
  message: "Donation recorded successfully"
}
```

### Design Rules
- Vendor selection is REQUIRED — disable submit without it
- Email is required — needed for tracker access
- After success: show tracker URL prominently
  "Your donation is confirmed. Track your impact here:"
  [clickable tracker link button]
- Tell user: "Save this link — you can check your donation anytime"
- Do NOT show txHash or donorHash to donor — only the tracker URL

---

## Page 4 — Donor Tracker

Most important donor-facing page. Works without login — URL is the key.

### API Call
```
GET /api/tracker/:donorHash

Response:
{
  donorHash: "sha256hashstring",
  campaignName: "Banjir Kelantan Relief 2026",
  amount: 50,
  vendorChoice: "Food Supply",
  journey: [
    {
      milestone: "RECEIVED",
      description: "Your RM50 donation was received",
      timestamp: "2026-05-22T09:32:00Z",
      status: "complete"
    },
    {
      milestone: "ALLOCATED",
      description: "Your donation has been allocated to food aid",
      timestamp: "2026-05-22T10:00:00Z",
      status: "complete"
    },
    {
      milestone: "RELEASED",
      description: "Funds released to Syarikat Makanan ABC",
      timestamp: "2026-05-25T14:00:00Z",
      status: "complete"
    },
    {
      milestone: "CONFIRMED",
      description: "Delivery confirmed in Kota Bharu",
      timestamp: null,
      status: "pending"
    }
  ],
  campaignStatus: "active"
}
```

### Milestone Display Rules

| milestone | What to show |
|---|---|
| RECEIVED | ✅ "Your RM[X] was received" |
| ALLOCATED | ✅ "Allocated to [vendorChoice]" |
| RELEASED | ✅ "Funds released to vendor" |
| CONFIRMED | ✅ "Delivery confirmed" |
| UNDER_REVIEW | ⏳ "Under review — funds paused" |
| FROZEN | 🔴 "Funds paused while we investigate" |
| COMPLETED | 🎉 "Your donation made an impact!" |

### CRITICAL Design Rules
- NEVER show blockchain transaction hashes
- NEVER show wallet addresses
- NEVER show AI confidence scores
- NEVER use the word "blockchain" on this page
- Plain English only
- If status is FROZEN: show reassurance message
  "Your donation is safe. Funds are held by Bank Islam
  while we investigate. We will update you shortly."
- Timeline: vertical, completed steps green, pending steps grey

---

## Page 5 — NGO Registration

### Form Fields
```
- Legal name
- Registration type (SSM Company / ROS Society / Both)
- Registration number
- Registered address
- Email + password for NGO portal login
- Director 1: name + MyKad number
- Director 2: name + MyKad number (optional)
- Bank account number + bank name
- Cause category (dropdown)
- Cause description
- Fund allocation:
    Aid %       ← must sum to 100 with others
    Logistics %
    Admin %
- Upload: SSM/ROS certificate (PDF)
- Upload: Latest audited financial statement (PDF)
```

### API Call
```
POST /api/ngo/register
Content-Type: multipart/form-data
Body includes: { name, registrationNum, contactEmail, password, contactPhone? }

Note: the frontend does not need to ask the NGO for a wallet address. If no
walletAddress is sent, the backend assigns an internal EVM audit identity for
Registry.sol.

Response:
{
  ngoId: "ngo_123",
  status: "pending_kyc",
  message: "Application received. Bank Islam will review within 3-5 business days."
}
```

### Design Rules
- Live percentage calculator — show running total as user types
- Red warning if percentages do not add up to 100
- File upload: PDF only, max 10MB
- After submit: show confirmation with reference number

---

## Page 6 — NGO Portal Dashboard

Requires NGO JWT login.

### Login
```
Route: /ngo/login
POST /api/ngo/login
Body: { email, password }
Response:
{
  token: "jwt...",
  role: "NGO",
  ngo: {
    id: "ngo_123",
    name: "Yayasan Example",
    status: "APPROVED",
    riskTier: "MEDIUM"
  }
}
```

### API Calls

```
GET /api/ngo/campaigns
Header: Authorization: Bearer <jwt>

Response:
[
  {
    id: "campaign_1",
    name: "Banjir Kelantan Relief 2026",
    status: "active",
    totalRaised: 87450,
    targetAmount: 100000,
    pendingEvidence: 1,
    aiAlerts: 0
  }
]
```

Create campaign application:
```
POST /api/ngo/campaign/create
Header: Authorization: Bearer <jwt>
Body:
{
  name: "Banjir Kelantan Relief 2026",
  causeType: "Disaster relief",
  description: "Aid for affected families...",
  aidPercent: 70,
  logisticsPercent: 20,
  adminPercent: 10,
  targetAmount: 100000,
  endDate: "2026-07-31T00:00:00.000Z"
}

Response:
{
  campaignId: "campaign_1",
  status: "DRAFT",
  message: "Campaign application submitted for Bank Islam review."
}
```

Submit disbursement evidence:
```
POST /api/evidence/submit
Header: Authorization: Bearer <jwt>
Content-Type: multipart/form-data
Body:
{
  campaignId: "campaign_1",
  category: "aid",
  amount: 15000,
  vendorId: "vendor_1",
  vendorRegistration: [file],
  serviceAgreement: [file],
  invoice: [file],
  deliveryProof: [file]
}

Response:
{
  evidenceId: "ev_123",
  documentHash: "sha256...",
  aiScore: 45,
  aiReason: "Spending within declared allocation limits",
  recommendation: "approve",
  status: "pending_bank_islam_review"
}
```

### Design Rules
- Show AI score to NGO (they can see their own)
- Colour code recommendation:
  Green: approve
  Orange: review
  Red: freeze
- All 4 documents required — show upload checklist
- Show which are uploaded, which are missing

---

## Page 7 — Bank Islam Admin Dashboard

Requires Bank Islam admin JWT.

### Login
```
Route: /admin/login
POST /api/admin/login
Body: { email, password }
Response: { token, role, name }
```

### Key API Calls

```
GET /api/admin/dashboard
Header: Authorization: Bearer <jwt>

Response:
{
  totalCampaigns: 12,
  totalRaised: 450000,
  activeAlerts: 3,
  frozenCampaigns: 1,
  pendingNGOs: 4,
  pendingVendors: 2
}
```

```
GET /api/admin/alerts
Header: Authorization: Bearer <jwt>

Response:
[
  {
    alertId: "alert_1",
    campaignName: "Banjir Kelantan Relief",
    evidenceId: "ev_123",
    aiScore: 88,
    reason: "Admin costs spike from 10% to 45%",
    flaggedPatterns: ["admin_cost_spike"],
    recommendation: "freeze",
    status: "open"
  }
]
```

```
POST /api/disbursement/approve
Body: { evidenceId: "ev_123" }

POST /api/disbursement/reject
Body: { evidenceId: "ev_123", reason: "Invoice not itemised" }

GET /api/admin/campaign/pending

POST /api/admin/campaign/:id/approve

POST /api/admin/campaign/:id/reject
Body: { reason: "Allocation plan needs clearer beneficiary detail" }

POST /api/admin/ngo/:id/approve

POST /api/admin/ngo/:id/revoke
Body: { reason: "Fraudulent activity confirmed" }
```

### Design Rules
- AI score colour coding:
  Red (above 85): auto-frozen
  Orange (60-85): manual review required
  Green (below 60): info only
- Show full AI reason text to Bank Islam admin
- Show flagged patterns as tags
- Approve/Reject buttons side by side
- Reject requires reason input before submitting

---

## Page 8 — Demo Controls (Hackathon Only)

Three big buttons for judges demo:

```
Button 1 — Simulate DuitNow Payment
POST /api/demo/simulate-duitnow
Body: { campaignId, amount, donorEmail, vendorId }
Shows: transaction confirmed + tracker link

Button 2 — Simulate Recipient Confirmation
POST /api/demo/recipient-confirm
Body: { evidenceId }
Shows: 5 second countdown then "Recipient confirmed ✅"

Button 3 — Simulate Fraud Detection
POST /api/demo/simulate-fraud
Body: { campaignId }
Shows: "AI detected anomaly — confidence 91%"
       "Campaign frozen automatically"
       "MACC alert sent"
Then redirect to donor tracker showing "Under Review"
```

### Design Notes
- Make buttons large and dramatic — judges need to see clearly
- Show live log below buttons — each action adds a timestamped line
- Colour: blue for payment, green for recipient, red for fraud

---

## Status Colour Coding (Use Consistently)

```
Green  #3ECFA0 — verified, approved, confirmed, complete
Orange #F0A84E — pending, under review, waiting
Red    #E05C5C — frozen, flagged, rejected, fraud
Purple #8B7FF5 — active, in progress
Grey           — pending milestone not yet reached
```

---

## Error Handling

All API errors return:
```json
{ "error": "Human readable message" }
```

Status codes:
```
400 — bad request (missing fields)
401 — not authenticated
403 — not authorised
404 — not found
500 — server error
```

Always show friendly message to user — never raw error objects.

---

## Authentication Summary

| Page | Who | Auth |
|---|---|---|
| Campaign Browser | Everyone | None |
| Campaign Detail | Everyone | None |
| Donate Flow | Donors | None |
| Donor Tracker | Donor with link | None |
| NGO Registration | Anyone | None |
| NGO Portal | NGOs | NGO JWT |
| Bank Islam Admin | Bank Islam staff | Admin JWT |
| Demo Controls | Judges | None |

---

## Contact Backend Engineer

If any API returns unexpected data or an endpoint is missing,
tell the backend engineer immediately — do not build workarounds.
If the response shape does not match what is documented here,
one of us needs to update — agree before building around it.
