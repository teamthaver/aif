import type { AutoCheck, KycFields } from '@/utils/types';

// Plug a real identity provider in here (NSDL/Protean PAN verification, CKYC registry lookup,
// penny-drop bank verification, Aadhaar offline e-KYC, liveness). Until one is configured, these
// checks are reported as "skipped" and a human reviewer does the verification, which is the control
// that matters.
export interface KycProvider {
  verify(fields: KycFields): Promise<AutoCheck[]>;
}

export const manualOnlyProvider: KycProvider = {
  async verify() {
    return [
      {
        key: 'provider_pan',
        label: 'PAN verified with the issuing authority',
        status: 'skipped',
        detail: 'No KYC provider configured: verify manually',
      },
      {
        key: 'provider_ckyc',
        label: 'CKYC registry lookup',
        status: 'skipped',
        detail: 'No KYC provider configured',
      },
      {
        key: 'provider_bank',
        label: 'Bank account verified (penny drop)',
        status: 'skipped',
        detail: 'No KYC provider configured: check the bank proof',
      },
    ];
  },
};
export const kycProvider: KycProvider = manualOnlyProvider;
