export type AuditRow = {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  at: string;
  actorName: string | null;
  orgName: string | null;
};
export type AuditPage = { entries: AuditRow[]; nextBefore: number | null };
