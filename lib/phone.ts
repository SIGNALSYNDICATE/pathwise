import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/mobile'

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'KE'

const NAME_PATTERN = /^[\p{L}][\p{L}\s.'’-]{1,79}$/u
const MOBILE_TYPES = new Set(['MOBILE', 'FIXED_LINE_OR_MOBILE'])

export type ProfileField = 'fullName' | 'phone' | 'smsOptIn'
export type ProfileErrors = Partial<Record<ProfileField, string>>

export type ProfileInput = {
  fullName: string
  phone: string
  phoneCountry: string
  smsOptIn: boolean
}

export type PreparedProfile = {
  fullName: string | null
  phoneE164: string | null
  phoneCountry: CountryCode | null
  smsOptIn: boolean
}

export type CountryOption = {
  code: CountryCode
  label: string
}

function regionName(code: CountryCode): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

export const COUNTRY_OPTIONS: CountryOption[] = getCountries()
  .flatMap((code) => {
    try {
      const calling = getCountryCallingCode(code)
      return [{ code, label: `${regionName(code)} (+${calling})` }]
    } catch {
      return []
    }
  })
  .sort((a, b) => a.label.localeCompare(b.label))

export function isCountryCode(value: string): value is CountryCode {
  return (getCountries() as string[]).includes(value)
}

function parseMobile(phone: string, country: string): { e164: string; country: CountryCode } | { error: string } {
  if (!isCountryCode(country)) {
    return { error: 'Choose a country for this number.' }
  }

  const parsed = phone.startsWith('+')
    ? parsePhoneNumberFromString(phone)
    : parsePhoneNumberFromString(phone, country)

  if (!parsed || !parsed.isValid() || !parsed.country) {
    return { error: 'Enter a valid mobile number for the selected country.' }
  }

  const type = parsed.getType()
  if (type && !MOBILE_TYPES.has(type)) {
    return { error: 'Enter a mobile number. Landlines and service numbers cannot receive these texts.' }
  }

  return { e164: parsed.number, country: parsed.country }
}

export function validateProfile(input: ProfileInput): {
  errors: ProfileErrors
  value: PreparedProfile | null
} {
  const errors: ProfileErrors = {}
  const fullName = input.fullName.trim().replace(/\s+/g, ' ')
  const phone = input.phone.trim()

  if (fullName && (fullName.length < 2 || fullName.length > 80 || !NAME_PATTERN.test(fullName))) {
    errors.fullName = 'Use 2–80 letters. Apostrophes, hyphens, and spaces are allowed.'
  }

  let phoneE164: string | null = null
  let phoneCountry: CountryCode | null = null

  if (phone) {
    const parsed = parseMobile(phone, input.phoneCountry.trim().toUpperCase())
    if ('error' in parsed) {
      errors.phone = parsed.error
    } else {
      phoneE164 = parsed.e164
      phoneCountry = parsed.country
    }
  } else if (input.smsOptIn) {
    errors.phone = 'Add a mobile number to turn on text alerts.'
  }

  if (Object.keys(errors).length > 0) {
    return { errors, value: null }
  }

  return {
    errors,
    value: {
      fullName: fullName || null,
      phoneE164,
      phoneCountry,
      smsOptIn: Boolean(phoneE164) && input.smsOptIn,
    },
  }
}

export function isDeliverableMobile(e164: string): boolean {
  const parsed = parsePhoneNumberFromString(e164)
  if (!parsed || !parsed.isValid()) return false
  const type = parsed.getType()
  return !type || MOBILE_TYPES.has(type)
}

export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return ''
  const parsed = parsePhoneNumberFromString(e164)
  return parsed ? parsed.formatInternational() : e164
}
