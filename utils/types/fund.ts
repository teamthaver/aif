export type FundCategory = 'Category I' | 'Category II' | 'Category III';
export type FundStatus = 'draft' | 'open' | 'closed' | 'wound_up';

export type FundRow = {
  id: string;
  code: string;
  name: string;
  category: FundCategory;
  strategy: string | null;
  description: string | null;
  currency: string;
  targetSize: number;
  minCommitment: number;
  tenureYears: number;
  status: FundStatus;
  committed: number;
  investorCount: number;
  createdAt: string;
};
export type AssignmentRow = {
  id: string;
  investorId: string;
  investorName: string;
  investorEmail: string;
  commitmentAmount: number;
  status: 'active' | 'removed';
  notes: string | null;
  acceptedAt: string | null;
  createdAt: string;
};
export type InvestorOption = { id: string; name: string; email: string };
export type MyFundRow = {
  assignmentId: string;
  fundId: string;
  code: string;
  name: string;
  category: FundCategory;
  strategy: string | null;
  description: string | null;
  currency: string;
  tenureYears: number;
  status: FundStatus;
  commitmentAmount: number;
  acceptedAt: string | null;
};
