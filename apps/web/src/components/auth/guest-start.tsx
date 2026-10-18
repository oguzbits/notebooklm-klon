import { Button } from '@/components/ui/button';
import { tr } from '@/lib/i18n';

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
        {starting
          ? tr('Demo wird vorbereitet …', 'Preparing the demo …')
          : tr('Demo ausprobieren', 'Try the demo')}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {tr(
          'Ohne Anmeldung, mit einem fertigen Demo-Notebook zum Ausprobieren.',
          'No sign-up needed, with a ready-made demo notebook to try out.'
        )}
      </p>
    </div>
  );
}
