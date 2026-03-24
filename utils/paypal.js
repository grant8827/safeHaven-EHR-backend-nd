'use strict';

/**
 * PayPal REST API utility (server-side only).
 *
 * Uses the PayPal Orders v2 API to:
 *   - Obtain a short-lived OAuth access token
 *   - Fetch and verify a captured order
 *
 * Required env vars (set in backend .env):
 *   PAYPAL_CLIENT_ID  – your live/sandbox app Client ID
 *   PAYPAL_SECRET     – your live/sandbox app Secret
 *
 * The base URL automatically switches between sandbox and live based on
 * NODE_ENV.  Set NODE_ENV=production for live charges.
 */

const PAYPAL_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

/**
 * Exchange Client ID + Secret for a short-lived Bearer token.
 * @returns {Promise<string>} access_token
 */
async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret   = process.env.PAYPAL_SECRET;

  if (!clientId || !secret) {
    throw new Error(
      'PayPal credentials are not configured. ' +
      'Set PAYPAL_CLIENT_ID and PAYPAL_SECRET in your backend .env file.'
    );
  }

  const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64');

  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal auth failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Fetch a PayPal order by ID and confirm it is COMPLETED.
 *
 * @param {string} orderId – the PayPal order/transaction ID
 * @param {number} expectedAmount – the dollar amount we expected to be paid
 * @param {string} [currency='USD']
 * @returns {Promise<object>} the full PayPal order object on success
 * @throws if the order is not found, not COMPLETED, or the amount doesn't match
 */
async function verifyOrder(orderId, expectedAmount, currency = 'USD') {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal order lookup failed (${response.status}): ${text}`);
  }

  const order = await response.json();

  // Must be fully captured
  if (order.status !== 'COMPLETED') {
    throw new Error(
      `PayPal order ${orderId} is not COMPLETED (status: ${order.status}). ` +
      'Payment cannot be recorded until it is fully captured.'
    );
  }

  // Verify the captured amount matches what the invoice expects
  const units = order.purchase_units ?? [];
  const captured = units
    .flatMap(u => u.payments?.captures ?? [])
    .filter(c => c.status === 'COMPLETED');

  if (captured.length === 0) {
    throw new Error(`PayPal order ${orderId} has no completed captures.`);
  }

  const capturedTotal = captured.reduce(
    (sum, c) => sum + parseFloat(c.amount?.value ?? '0'),
    0
  );

  const expectedRounded = Math.round(parseFloat(expectedAmount) * 100);
  const capturedRounded = Math.round(capturedTotal * 100);

  // Allow a 1-cent tolerance for floating-point rounding
  if (Math.abs(expectedRounded - capturedRounded) > 1) {
    throw new Error(
      `PayPal captured amount ($${capturedTotal.toFixed(2)}) does not match ` +
      `the expected invoice amount ($${parseFloat(expectedAmount).toFixed(2)}).`
    );
  }

  return order;
}

module.exports = { getAccessToken, verifyOrder };
