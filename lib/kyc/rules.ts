import type { AutoCheck, KycFields } from '@/utils/types';

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PINCODE_RE = /^[1-9][0-9]{5}$/;
export const MOBILE_RE = /^[6-9][0-9]{9}$/;
export const LAST4_RE = /^[0-9]{4}$/;
export const ACCOUNT_RE = /^[0-9]{9,18}$/;

export const INCOME_RANGES = [
  'Below ₹10 lakh',
  '₹10-25 lakh',
  '₹25 lakh-1 crore',
  '₹1-5 crore',
  'Above ₹5 crore',
];
export const SOURCES_OF_FUNDS = [
  'Salary',
  'Business income',
  'Investments',
  'Inheritance',
  'Sale of property',
  'Other',
];
export const OCCUPATIONS = [
  'Salaried',
  'Self-employed',
  'Business owner',
  'Professional',
  'Retired',
  'Other',
];
export const REQUIRED_DOCS = ['pan_card', 'address_proof', 'bank_proof', 'photo'] as const;
export const DOC_LABEL: Record<string, string> = {
  pan_card: 'PAN card',
  address_proof: 'Address proof',
  bank_proof: 'Bank proof (cancelled cheque or statement)',
  photo: 'Recent photograph',
};

export const emptyFields = (): KycFields => ({
  legalName: '',
  dob: '',
  mobile: '',
  panNumber: '',
  aadhaarLast4: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  occupation: '',
  incomeRange: '',
  sourceOfFunds: '',
  isPep: '',
  isUsPerson: '',
  taxResidency: 'India',
  bankHolder: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankName: '',
});

export function ageOn(dob: string, today = new Date()): number {
  const d = new Date(dob + 'T00:00:00Z');
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  if (
    today.getUTCMonth() < d.getUTCMonth() ||
    (today.getUTCMonth() === d.getUTCMonth() && today.getUTCDate() < d.getUTCDate())
  )
    age--;
  return age;
}

const tokens = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
// Share of the shorter name's words that appear in the other name. Order and initials do not
// matter.
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a),
    tb = new Set(tokens(b));
  if (!ta.length || !tb.size) return 0;
  const [short, long] = ta.length <= tb.size ? [ta, tb] : [[...tb], new Set(ta)];
  return short.filter((t) => long.has(t)).length / short.length;
}

// Problems that block submission. Each entry is a human-readable message.
export function submissionProblems(f: KycFields, docs: string[]): string[] {
  const p: string[] = [];
  const need = (ok: boolean, msg: string) => {
    if (!ok) p.push(msg);
  };
  need(f.legalName.trim().length >= 3, 'Enter your full name exactly as on your PAN card');
  need(
    /^\d{4}-\d{2}-\d{2}$/.test(f.dob) && ageOn(f.dob) >= 18,
    'You must be at least 18 years old (enter your date of birth)',
  );
  need(MOBILE_RE.test(f.mobile), 'Enter a valid 10-digit Indian mobile number');
  need(PAN_RE.test(f.panNumber), 'Enter a valid PAN (for example ABCPE1234F)');
  need(f.panNumber[3] === 'P', 'The PAN must belong to an individual (the 4th character is P)');
  need(LAST4_RE.test(f.aadhaarLast4), 'Enter the last 4 digits of your Aadhaar');
  need(f.addressLine1.trim().length >= 5, 'Enter your address');
  need(f.city.trim().length >= 2 && f.state.trim().length >= 2, 'Enter your city and state');
  need(PINCODE_RE.test(f.pincode), 'Enter a valid 6-digit pincode');
  need(
    !!f.occupation && !!f.incomeRange && !!f.sourceOfFunds,
    'Select your occupation, income range and source of funds',
  );
  need(f.isPep !== '' && f.isUsPerson !== '', 'Answer the PEP and US-person questions');
  need(f.taxResidency.trim().length >= 2, 'Enter your country of tax residency');
  need(f.bankHolder.trim().length >= 3, 'Enter the bank account holder name');
  need(ACCOUNT_RE.test(f.bankAccountNumber), 'Enter a valid bank account number (9-18 digits)');
  need(IFSC_RE.test(f.bankIfsc), 'Enter a valid IFSC (for example HDFC0001234)');
  need(f.bankName.trim().length >= 2, 'Enter your bank name');
  for (const k of REQUIRED_DOCS)
    need(docs.includes(k), `Upload your ${DOC_LABEL[k].toLowerCase()}`);
  return p;
}

// Automatic checks shown to the reviewer. They help the human decide; they never verify anyone on
// their own.
export function computeAutoChecks(f: KycFields, ctx: { duplicatePan: boolean }): AutoCheck[] {
  const c: AutoCheck[] = [];
  const add = (key: string, label: string, status: AutoCheck['status'], detail?: string) =>
    c.push({ key, label, status, detail });
  add('pan_format', 'PAN format is valid', PAN_RE.test(f.panNumber) ? 'pass' : 'fail');
  add('pan_individual', 'PAN belongs to an individual', f.panNumber[3] === 'P' ? 'pass' : 'fail');
  add('pan_unique', 'PAN not used by another investor here', ctx.duplicatePan ? 'fail' : 'pass');
  add(
    'age',
    'Investor is 18 or older',
    f.dob && ageOn(f.dob) >= 18 ? 'pass' : 'fail',
    f.dob ? `Age ${ageOn(f.dob)}` : undefined,
  );
  add('ifsc', 'IFSC format is valid', IFSC_RE.test(f.bankIfsc) ? 'pass' : 'fail');
  const sim = nameSimilarity(f.legalName, f.bankHolder);
  add(
    'name_match',
    'Bank holder name matches PAN name',
    sim >= 0.99 ? 'pass' : sim >= 0.5 ? 'warn' : 'fail',
    `${Math.round(sim * 100)}% of name words match`,
  );
  add(
    'pep',
    'Not a politically exposed person',
    f.isPep === 'no' ? 'pass' : 'warn',
    f.isPep === 'yes' ? 'Declared PEP: enhanced due diligence needed' : undefined,
  );
  add(
    'us_person',
    'Not a US person (FATCA)',
    f.isUsPerson === 'no' ? 'pass' : 'warn',
    f.isUsPerson === 'yes' ? 'US person: FATCA reporting applies' : undefined,
  );
  return c;
}
