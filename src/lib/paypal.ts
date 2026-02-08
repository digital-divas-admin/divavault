import paypal from "@paypal/payouts-sdk";

// Singleton PayPal client
let client: paypal.core.PayPalHttpClient | null = null;

function getPayPalClient(): paypal.core.PayPalHttpClient {
  if (client) return client;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || "sandbox";

  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required");
  }

  const environment =
    mode === "live"
      ? new paypal.core.LiveEnvironment(clientId, clientSecret)
      : new paypal.core.SandboxEnvironment(clientId, clientSecret);

  client = new paypal.core.PayPalHttpClient(environment);
  return client;
}

export interface PayoutItem {
  senderItemId: string;
  recipientEmail: string;
  amountCents: number;
  currency?: string;
  note?: string;
}

export interface BatchPayoutResult {
  paypalBatchId: string;
  batchStatus: string;
}

export async function createBatchPayout(
  senderBatchId: string,
  items: PayoutItem[]
): Promise<BatchPayoutResult> {
  const ppClient = getPayPalClient();

  const request = new paypal.payouts.PayoutsPostRequest();
  request.requestBody({
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject: "You have a payment from Made Of Us",
      email_message:
        "You received a payment for your contributions to Made Of Us.",
    },
    items: items.map((item) => ({
      recipient_type: "EMAIL",
      amount: {
        value: (item.amountCents / 100).toFixed(2),
        currency: item.currency || "USD",
      },
      receiver: item.recipientEmail,
      sender_item_id: item.senderItemId,
      note: item.note || "Payment for your contributions",
    })),
  });

  const response = await ppClient.execute(request);
  const result = response.result;
  if (!result?.batch_header) {
    throw new Error("No result returned from PayPal");
  }
  const batchHeader = result.batch_header;

  return {
    paypalBatchId: batchHeader.payout_batch_id,
    batchStatus: batchHeader.batch_status,
  };
}

// Direct REST call to get an access token (for webhook verification)
async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || "sandbox";

  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required");
  }

  const baseUrl =
    mode === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function verifyPayPalWebhook(
  headers: Record<string, string>,
  body: string,
  webhookId: string
): Promise<boolean> {
  const mode = process.env.PAYPAL_MODE || "sandbox";
  const baseUrl =
    mode === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  const accessToken = await getAccessToken();

  const res = await fetch(
    `${baseUrl}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    }
  );

  if (!res.ok) {
    console.error("PayPal webhook verification failed:", res.status);
    return false;
  }

  const data = await res.json();
  return data.verification_status === "SUCCESS";
}
