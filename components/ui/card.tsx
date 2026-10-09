import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot="card"
    className={cn('rounded-xl border bg-card text-card-foreground shadow-xs', className)}
    {...props}
  />
);
const CardHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot="card-header" className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />
);
const CardTitle = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot="card-title"
    className={cn('font-semibold leading-none tracking-tight', className)}
    {...props}
  />
);
const CardDescription = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot="card-description"
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
);
const CardContent = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot="card-content" className={cn('p-5 pt-0', className)} {...props} />
);
export { Card, CardHeader, CardTitle, CardDescription, CardContent };
