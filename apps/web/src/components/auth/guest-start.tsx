import { Button } from '@/components/ui/button';

/** The way in without an account: a guest with a copy of the example notebook. */
export function GuestStart({
  pending,
  starting,
  onStart,
}: {
  /** Something is under way, the guest or a sign-in. */
  pending: boolean;
  /** The guest itself is being made. */
  starting: boolean;
  onStart: () => void;
}) {
  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-4">
      <Button type="button" variant="outline" disabled={pending} onClick={onStart}>
        {starting ? 'Beispiel wird vorbereitet …' : 'Beispiel ausprobieren'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Ohne Anmeldung, mit einem fertigen Beispiel-Notebook zum Ausprobieren.
      </p>
    </div>
  );
}
