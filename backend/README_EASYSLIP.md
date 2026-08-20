EasySlip integration - quick start (dev)

This file explains how to test EasySlip integration locally and in dev.

Prerequisites
- Node.js, npm
- Project checked out at d:/CRM/crm_smartidea
- MongoDB running & configured for backend

Environment
- Recommended env vars (backend/.env or set in your shell):
  EASYSLIP_API_KEY=your_real_api_key_here
  EASYSLIP_BASE_URL=https://api.easyslip.com/v2
  EASYSLIP_MOCK=1            # set to 1 to run without a real API key (mock mode)
  EASYSLIP_WEBHOOK_SECRET=   # optional: set a secret to validate webhook signatures

Run backend (mock mode, no external calls)

1. Install dependencies and run:

```powershell
cd d:/CRM/crm_smartidea/backend
$env:EASYSLIP_MOCK = "1"
npm install
npm run dev
```

2. Create a transaction with slip via UI or curl (example):

```bash
curl -X POST http://localhost:5000/api/services/SERVICE_ID/transactions \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "amount=1000" \
  -F "transactionDate=2026-08-19" \
  -F "bank=KBANK" \
  -F "slipImage=@/full/path/to/slip.jpg"
```

3. The backend runs a background task and (in mock mode) will update the transaction.slipVerification to "verified".

Testing webhook locally using provided helper

- You can simulate an EasySlip webhook without ngrok by running:

```bash
cd d:/CRM/crm_smartidea/backend
npm run send-mock-webhook -- --imageUrl="https://example.com/slip.jpg"
```

- If you use a secret (`EASYSLIP_WEBHOOK_SECRET`), the send-mock-webhook does NOT include a signature header; use ngrok + EasySlip dashboard for full end-to-end.

Using ngrok for real webhook testing

1. Start ngrok to expose local server:

```bash
npx ngrok http 5000
```

2. Copy the public ngrok URL (e.g. https://abcd1234.ngrok.io) and add it to EasySlip dashboard as the webhook URL: `https://abcd1234.ngrok.io/api/webhooks/easyslip`

3. If EasySlip requires IP whitelisting, add the server IP (production) via dashboard > API usage > + Add IP address.

Notes
- `backend/utils/slipVerifier.js` supports mock mode via `EASYSLIP_MOCK=1` and calls the real API when `EASYSLIP_MOCK` is not set.
- `backend/routes/easyslipWebhook.js` will verify the HMAC-SHA256 signature provided in header `x-easyslip-signature` when `EASYSLIP_WEBHOOK_SECRET` is set.
- Keep your `EASYSLIP_API_KEY` secret; do not commit to repository.

If you want, I can produce step-by-step screenshots or help run these commands via your terminal (you run them; I will guide).