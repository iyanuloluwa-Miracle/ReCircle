import { createError } from 'h3'
import { getServerConfig } from '../utils/config'
import { nairaToKobo, transferReferenceForRequest, verifyPaystackSignature } from '../../utils/paystack'

export { nairaToKobo, transferReferenceForRequest, verifyPaystackSignature }

const PAYSTACK_API = 'https://api.paystack.co'

function assertTestKeys(secret: string, publicKey: string) {
  if (!secret.startsWith('sk_test_')) {
    throw createError({
      statusCode: 503,
      statusMessage: 'PAYSTACK_SECRET_KEY must be a Paystack TEST secret (sk_test_…)'
    })
  }
  if (publicKey && !publicKey.startsWith('pk_test_')) {
    throw createError({
      statusCode: 503,
      statusMessage: 'PAYSTACK_PUBLIC_KEY must be a Paystack TEST public key (pk_test_…)'
    })
  }
}

/** Returns the TEST secret when configured; null when unset so callers can fall back to mock. */
export function getPaystackSecretOrNull(): string | null {
  const secret = String(getServerConfig().paystackSecretKey || '').trim()
  if (!secret) return null
  const publicKey = String(getServerConfig().paystackPublicKey || '').trim()
  assertTestKeys(secret, publicKey)
  return secret
}

export function requirePaystackSecret(): string {
  const secret = getPaystackSecretOrNull()
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'Paystack TEST keys are not configured' })
  }
  return secret
}

/** True only when TEST keys are present and valid. Live keys never enable Paystack. */
export function isPaystackConfigured() {
  try {
    return getPaystackSecretOrNull() !== null
  } catch {
    return false
  }
}

interface PaystackEnvelope<T> {
  status: boolean
  message: string
  data: T
}

async function paystackFetch<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown>; query?: Record<string, string> } = {}
): Promise<T> {
  const secret = requirePaystackSecret()
  const url = new URL(path.startsWith('http') ? path : `${PAYSTACK_API}${path}`)
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) url.searchParams.set(key, value)
  }
  const response = await fetch(url, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000)
  })
  let payload: PaystackEnvelope<T> | null = null
  try {
    payload = await response.json() as PaystackEnvelope<T>
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Paystack returned an invalid response' })
  }
  if (!response.ok || !payload?.status) {
    throw createError({
      statusCode: response.status >= 400 && response.status < 500 ? 400 : 502,
      statusMessage: payload?.message || 'Paystack request failed'
    })
  }
  return payload.data
}

export interface PaystackBank {
  name: string
  code: string
  active: boolean
  currency: string
  type: string
}

export async function listNigerianBanks(): Promise<Array<{ name: string; code: string }>> {
  const data = await paystackFetch<PaystackBank[]>('/bank', { query: { currency: 'NGN', country: 'nigeria' } })
  return data
    .filter(bank => bank.active && bank.currency === 'NGN')
    .map(bank => ({ name: bank.name, code: bank.code }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function resolveBankAccount(accountNumber: string, bankCode: string) {
  const data = await paystackFetch<{ account_number: string; account_name: string; bank_id?: number }>(
    '/bank/resolve',
    { query: { account_number: accountNumber, bank_code: bankCode } }
  )
  return {
    accountNumber: data.account_number,
    accountName: data.account_name
  }
}

export async function createTransferRecipient(options: {
  name: string
  accountNumber: string
  bankCode: string
}) {
  const data = await paystackFetch<{
    recipient_code: string
    details: { account_number: string; account_name: string | null; bank_code: string }
  }>('/transferrecipient', {
    method: 'POST',
    body: {
      type: 'nuban',
      name: options.name,
      account_number: options.accountNumber,
      bank_code: options.bankCode,
      currency: 'NGN'
    }
  })
  return {
    recipientCode: data.recipient_code,
    accountNumber: data.details.account_number,
    accountName: data.details.account_name,
    bankCode: data.details.bank_code
  }
}

export async function initiateTransfer(options: {
  amountNaira: number
  recipientCode: string
  reference: string
  reason: string
}) {
  const data = await paystackFetch<{
    transfer_code: string
    reference: string
    status: string
    amount: number
  }>('/transfer', {
    method: 'POST',
    body: {
      source: 'balance',
      amount: nairaToKobo(options.amountNaira),
      recipient: options.recipientCode,
      reason: options.reason,
      reference: options.reference,
      currency: 'NGN'
    }
  })
  return {
    transferCode: data.transfer_code,
    reference: data.reference,
    status: data.status
  }
}
