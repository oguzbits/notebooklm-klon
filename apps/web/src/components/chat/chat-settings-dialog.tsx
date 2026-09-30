import {
  CHAT_LANGUAGE,
  CHAT_LENGTH,
  CHAT_STYLE,
  type ChatConfig,
  DEFAULT_CHAT_CONFIG,
  MAX_CUSTOM_INSTRUCTION_CHARS,
} from '@nlm/shared';
import { Settings2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useChatConfig, useSaveChatConfig } from '@/hooks/use-chat-config';
import { describeError } from '@/lib/messages';

const STYLE_OPTIONS = [
  [CHAT_STYLE.DEFAULT, 'Standard', 'Sachliche Antworten, wie sie die Quellen hergeben.'],
  [
    CHAT_STYLE.LEARNING_GUIDE,
    'Lernbegleiter',
    'Erklärt Schritt für Schritt und nennt, was man sich merken sollte.',
  ],
  [CHAT_STYLE.CUSTOM, 'Eigene Anweisung', 'Du beschreibst selbst, wie geantwortet werden soll.'],
] as const;

const LENGTH_OPTIONS = [
  [CHAT_LENGTH.SHORTER, 'Kürzer'],
  [CHAT_LENGTH.DEFAULT, 'Standard'],
  [CHAT_LENGTH.LONGER, 'Länger'],
] as const;

const LANGUAGE_OPTIONS = [
  [CHAT_LANGUAGE.AUTO, 'Wie die Frage'],
  [CHAT_LANGUAGE.DE, 'Deutsch'],
  [CHAT_LANGUAGE.EN, 'Englisch'],
] as const;

function Option({
  group,
  value,
  label,
  hint,
}: {
  group: string;
  value: string;
  label: string;
  hint?: string;
}) {
  const id = `${group}-${value}`;
  return (
    <div className="flex items-start gap-3 rounded-2xl px-2 py-2 hover:bg-secondary">
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <Label htmlFor={id} className="flex flex-col items-start gap-0.5 font-normal">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </Label>
    </div>
  );
}

function SettingsForm({
  notebookId,
  initial,
  onSaved,
}: {
  notebookId: string;
  initial: ChatConfig;
  onSaved: () => void;
}) {
  const [config, setConfig] = useState(initial);
  const save = useSaveChatConfig(notebookId);
  const missingInstruction =
    config.style === CHAT_STYLE.CUSTOM && config.customInstruction.trim() === '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(
      {
        ...config,
        customInstruction:
          config.style === CHAT_STYLE.CUSTOM ? config.customInstruction.trim() : '',
      },
      { onSuccess: onSaved }
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">Stil der Antworten</legend>
        <RadioGroup
          aria-label="Stil der Antworten"
          value={config.style}
          onValueChange={(style) => setConfig({ ...config, style: style as ChatConfig['style'] })}
        >
          {STYLE_OPTIONS.map(([value, label, hint]) => (
            <Option key={value} group="style" value={value} label={label} hint={hint} />
          ))}
        </RadioGroup>
        {config.style === CHAT_STYLE.CUSTOM && (
          <Textarea
            aria-label="Eigene Anweisung"
            placeholder="Zum Beispiel: Antworte knapp und nenne zuerst die Zahl."
            maxLength={MAX_CUSTOM_INSTRUCTION_CHARS}
            value={config.customInstruction}
            onChange={(event) => setConfig({ ...config, customInstruction: event.target.value })}
          />
        )}
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">Länge der Antworten</legend>
        <RadioGroup
          aria-label="Länge der Antworten"
          className="grid-cols-3"
          value={config.length}
          onValueChange={(length) =>
            setConfig({ ...config, length: length as ChatConfig['length'] })
          }
        >
          {LENGTH_OPTIONS.map(([value, label]) => (
            <Option key={value} group="length" value={value} label={label} />
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">Sprache der Antworten</legend>
        <RadioGroup
          aria-label="Sprache der Antworten"
          className="grid-cols-3"
          value={config.language}
          onValueChange={(language) =>
            setConfig({ ...config, language: language as ChatConfig['language'] })
          }
        >
          {LANGUAGE_OPTIONS.map(([value, label]) => (
            <Option key={value} group="language" value={value} label={label} />
          ))}
        </RadioGroup>
      </fieldset>
      {save.isError && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(save.error)}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="submit" disabled={save.isPending || missingInstruction}>
          {save.isPending ? 'Wird gespeichert …' : 'Speichern'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** The chat settings of one notebook, opened from the header. */
export function ChatSettingsDialog({ notebookId }: { notebookId: string }) {
  const [open, setOpen] = useState(false);
  const config = useChatConfig(notebookId, open);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-foreground">
          <Settings2 />
          <span className="max-sm:sr-only">Einstellungen</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Einstellungen für den Chat</DialogTitle>
          <DialogDescription>
            Gilt für dieses Notizbuch. Jede Aussage bleibt mit einer Quelle belegt, was du auch
            einstellst.
          </DialogDescription>
        </DialogHeader>
        <QueryBoundary query={config} empty={null}>
          {(loaded) => (
            <SettingsForm
              notebookId={notebookId}
              initial={loaded ?? DEFAULT_CHAT_CONFIG}
              onSaved={() => setOpen(false)}
            />
          )}
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}
