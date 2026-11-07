const DEFAULT_URL = "https://sms.thrivevas.com/v1/message/send";
const DEFAULT_SENDER = "ThriveVas";
const MESSAGE_MAX = 480;

export class SmsDeliveryError extends Error {
  readonly providerStatus: number | null;

  constructor(message: string, providerStatus: number | null = null) {
    super(message);
    this.name = "SmsDeliveryError";
    this.providerStatus = providerStatus;
  }
}

export type SmsReceipt = {
  transactionId: string | null;
};

type ProviderBody = {
  status?: number;
  message?: string;
  transaction_id?: number | string;
};

export async function sendSms(
  msisdn: string,
  message: string,
): Promise<SmsReceipt> {
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) {
    throw new SmsDeliveryError("SMS is not configured.");
  }
  if (!message.trim() || message.length > MESSAGE_MAX) {
    throw new SmsDeliveryError("SMS message is empty or too long.");
  }

  const url = process.env.SMS_API_URL || DEFAULT_URL;
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
  const body = {
    message,
    msisdn,
    sender_id: process.env.SMS_SENDER_ID || DEFAULT_SENDER,
  };

  console.log("[sms] request", {
    url,
    headers: {
      ...headers,
      "x-api-key": `${apiKey.slice(0, 8)}…(${apiKey.length})`,
    },
    body,
  });

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  const raw = await response.text();
  console.log("[sms] response", {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: raw,
  });

  let payload: ProviderBody | null = null;
  if (raw) {
    try {
      payload = JSON.parse(raw) as ProviderBody;
    } catch {
      payload = null;
    }
  }
  const providerStatus =
    typeof payload?.status === "number" ? payload.status : response.status;
  if (!response.ok || providerStatus >= 400) {
    throw new SmsDeliveryError(
      "The SMS provider rejected the message.",
      providerStatus,
    );
  }

  return {
    transactionId:
      payload?.transaction_id == null ? null : String(payload.transaction_id),
  };
}
