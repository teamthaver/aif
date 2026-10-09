export type OrgType = 'AIF manager' | 'Fund administrator' | 'Trustee' | 'Custodian';
export type OrgRow = {
  id: string;
  name: string;
  type: OrgType | null;
  registrationNo: string | null;
  status: 'active' | 'suspended';
  userCount: number;
  createdAt: string;
};
