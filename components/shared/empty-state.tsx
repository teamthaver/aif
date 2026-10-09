import { Card } from '@/components/ui/card';

export const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <Card className="p-8 text-center text-sm text-muted-foreground">{children}</Card>
);
