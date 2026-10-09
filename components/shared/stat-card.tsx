import { Card } from '@/components/ui/card';

export const StatCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) => (
  <Card className="p-5">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="mt-1 text-2xl font-semibold">{value}</div>
    {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
  </Card>
);
