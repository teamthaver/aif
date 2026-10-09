// The type options an organization can choose for itself. Safe for the browser and the server.
export const ORG_TYPES = ['AIF manager', 'Fund administrator', 'Trustee', 'Custodian'] as const;
export type OrgTypeOption = (typeof ORG_TYPES)[number];
