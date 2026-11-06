# Razorpay student payments

## Test-mode configuration

Put these values in `backend/.env` for local work, or in the backend deployment's
secret/environment configuration. Do not put `RAZORPAY_KEY_SECRET` or
`RAZORPAY_WEBHOOK_SECRET` in frontend files or commit real credentials.

```dotenv
RAZORPAY_KEY_ID=rzp_test_your_test_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_signing_secret
```

The public Key ID is returned by the backend only when creating a Checkout
order. The secret remains backend-only. Start by using Razorpay Test Mode
credentials and test payment instruments; switch to Live Mode credentials only
after successful test and reconciliation.

## Database and backend deployment

From the `backend` directory, apply the additive PostgreSQL changes once:

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/add-razorpay-payment.sql
npx prisma generate
npm run build
```

Restart/redeploy the backend after configuring its environment variables. The
backend loads `backend/.env` when started from that directory; deployment
platform environment variables take precedence over `.env` values.

## Razorpay webhook

Create a webhook in the Razorpay Dashboard pointing to:

```text
https://YOUR_API_HOST/fees/razorpay/webhook
```

Set the webhook signing secret to the same value configured as
`RAZORPAY_WEBHOOK_SECRET`. Subscribe to `payment.captured` and `payment.failed`.
The backend verifies the signature against the unmodified request body, then
fetches captured payment status from Razorpay before updating fee records.

## Student portal flow

The student selects fees and an optional partial outstanding amount in the
existing payment modal, then chooses **Pay Online**. The backend recalculates
the total from pending database fees, creates an order through the official
Razorpay Node SDK, and records the order before returning its public key ID.
Razorpay Checkout offers the payment methods enabled for the merchant account
(such as UPI, cards, and net banking).

On checkout success, the backend validates the checkout signature and fetches
the payment from Razorpay. Only a captured payment marks selected fees complete
or adds the existing outstanding-payment ledger row. Webhooks provide the
server-to-server confirmation path. Order and payment IDs, payment status, and
gateway method are stored on the fee ledger and shown in receipts/payment
history. Repeated verification of the same captured order does not create
another fee payment.

Orders request automatic payment capture. If the browser callback is missed
after a UPI app return, the portal can reconcile the saved order directly with
Razorpay and applies fees only when Razorpay reports a captured payment. An
authorized, pending, or failed payment is never marked paid.

Admin/cash collection continues through its existing flow.

If a captured payment cannot be safely matched to still-pending fees, the order
is marked `REFUND_REQUIRED` for manual hostel-office reconciliation. Do not ask
the student to retry that captured payment; check the Razorpay Dashboard and
settle or refund it before resolving the fee ledger.

## Test checklist

1. Use only `rzp_test_` credentials and a non-production test database first.
2. Verify an accepted test payment marks the selected pending fees paid and
   saves the order/payment IDs.
3. Verify an unsuccessful/cancelled checkout reports failure and leaves fees
   pending.
4. Retry the verification call or webhook for one captured payment and ensure
   it does not add another ledger payment.
5. Submit an invalid signature and confirm that fee rows remain unchanged.
6. Test partial outstanding payment and check the remaining outstanding balance
   in the portal and Fees page.
7. Test admin cash collection to confirm the existing path remains unchanged.
