import type { KycStatus } from './auth';

export type KycDocKind = 'pan_card' | 'address_proof' | 'bank_proof' | 'photo';
export type KycDocMeta = {
  id: string;
  kind: KycDocKind;
  fileName: string;
  mime: string;
  sizeBytes: number;
  uploadedAt: string;
};

// What the investor fills in. Everything is a string so a half-finished form can be saved as a
// draft.
export type KycFields = {
  legalName: string;
  dob: string;
  mobile: string;
  panNumber: string;
  aadhaarLast4: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  occupation: string;
  incomeRange: string;
  sourceOfFunds: string;
  isPep: '' | 'yes' | 'no';
  isUsPerson: '' | 'yes' | 'no';
  taxResidency: string;
  bankHolder: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
};
export type AutoCheck = {
  key: string;
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'skipped';
  detail?: string;
};
export type KycReview = {
  id: string;
  reviewerName: string;
  decision: 'verified' | 'rejected';
  reason: string | null;
  createdAt: string;
};

export type KycDetail = {
  investorId: string;
  name: string;
  email: string;
  userStatus: string;
  status: KycStatus;
  fields: KycFields;
  fullDetailsVisible: boolean;
  declarationAt: string | null;
  submittedAt: string | null;
  submissionCount: number;
  rejectionReason: string | null;
  documents: KycDocMeta[];
  checks: AutoCheck[];
  reviews: KycReview[];
};
export type InvestorRow = {
  id: string;
  name: string;
  email: string;
  userStatus: string;
  kycStatus: KycStatus;
  submittedAt: string | null;
  fundCount: number;
  committed: number;
  createdAt: string;
};
export type ReviewChecklist = {
  identityMatches: boolean;
  addressValid: boolean;
  bankValid: boolean;
  photoClear: boolean;
  sanctionsScreened: boolean;
};
