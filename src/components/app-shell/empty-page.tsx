import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Reusable Phase-0 placeholder for protected pages whose real
 * implementation ships in a later phase.
 */
export function EmptyPage({
  title,
  ships,
  children,
}: {
  title: string;
  ships: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="font-serif text-3xl font-bold text-primary">{title}</h1>
      <Card className="mt-6 max-w-2xl">
        <CardHeader>
          <CardTitle>Coming in {ships}</CardTitle>
          <CardDescription>
            This is a placeholder so the navigation feels real. The functional surface lands later
            in the roadmap (see BACKLOG.md).
          </CardDescription>
        </CardHeader>
        {children ? <CardContent className="text-sm">{children}</CardContent> : null}
      </Card>
    </div>
  );
}
