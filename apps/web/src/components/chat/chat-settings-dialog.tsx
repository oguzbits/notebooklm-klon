import {
  CHAT_LANGUAGE,
  CHAT_LENGTH,
  CHAT_STYLE,
  type ChatConfig,
  DEFAULT_CHAT_CONFIG,
  MAX_CUSTOM_INSTRUCTION_CHARS,
} from '@nlm/shared';
import { type FormEvent, type ReactNode, useState } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { DialogSpinner } from '@/components/skeletons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

interface OptionProps {
  group: string;
  value: string;
  label: string;
  hint?: string;
}

function Option({ group, value, label, hint }: OptionProps) {
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

/** A choice: the value, the words for it and, where needed, a line that explains it. */
type Choice<T extends string> = readonly [value: T, label: string, hint?: string];

interface ChoiceGroupProps<T extends string> {
  /** Names the fieldset and the group for a screen reader, and makes the ids of the options. */
  legend: string;
  group: string;
  value: T;
  choices: readonly Choice<T>[];
  columns?: boolean;
  onChange: (value: T) => void;
  children?: ReactNode;
}

/** One question of the form with its options as radio buttons; the value that comes back is one of the choices. */
function ChoiceGroup<T extends string>({
  legend,
  group,
  value,
  choices,
  columns = false,
  onChange,
  children,
}: ChoiceGroupProps<T>) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <RadioGroup
        aria-label={legend}
        className={columns ? 'grid-cols-3' : undefined}
        value={value}
        onValueChange={(next) => {
          const chosen = choices.find(([candidate]) => candidate === next);
          if (chosen) onChange(chosen[0]);
        }}
      >
        {choices.map(([choice, label, hint]) => (
          <Option key={choice} group={group} value={choice} label={label} hint={hint} />
        ))}
      </RadioGroup>
      {children}
    </fieldset>
  );
}

interface SettingsFormProps {
  notebookId: string;
  initial: ChatConfig;
  onSaved: () => void;
}

function SettingsForm({ notebookId, initial, onSaved }: SettingsFormProps) {
  const [config, setConfig] = useState(initial);
  const save = useSaveChatConfig(notebookId);
  const custom = config.style === CHAT_STYLE.CUSTOM;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const customInstruction = custom ? config.customInstruction.trim() : '';
    save.mutate({ ...config, customInstruction }, { onSuccess: onSaved });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <ChoiceGroup
        legend="Stil der Antworten"
        group="style"
        value={config.style}
        choices={STYLE_OPTIONS}
        onChange={(style) => setConfig({ ...config, style })}
      >
        {custom && (
          <Textarea
            aria-label="Eigene Anweisung"
            placeholder="Zum Beispiel: Antworte knapp und nenne zuerst die Zahl."
            maxLength={MAX_CUSTOM_INSTRUCTION_CHARS}
            value={config.customInstruction}
            onChange={(event) => setConfig({ ...config, customInstruction: event.target.value })}
          />
        )}
      </ChoiceGroup>
      <ChoiceGroup
        legend="Länge der Antworten"
        group="length"
        value={config.length}
        choices={LENGTH_OPTIONS}
        columns
        onChange={(length) => setConfig({ ...config, length })}
      />
      <ChoiceGroup
        legend="Sprache der Antworten"
        group="language"
        value={config.language}
        choices={LANGUAGE_OPTIONS}
        columns
        onChange={(language) => setConfig({ ...config, language })}
      />
      {save.isError && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(save.error)}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button
          type="submit"
          disabled={save.isPending || (custom && config.customInstruction.trim() === '')}
        >
          {save.isPending ? 'Wird gespeichert …' : 'Speichern'}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface ChatSettingsDialogProps {
  notebookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The chat settings of one notebook, opened from the menu of the notebook. */
export function ChatSettingsDialog({ notebookId, open, onOpenChange }: ChatSettingsDialogProps) {
  const config = useChatConfig(notebookId, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chat konfigurieren</DialogTitle>
          <DialogDescription>
            Gilt für dieses Notebook. Jede Aussage bleibt mit einer Quelle belegt, was du auch
            einstellst.
          </DialogDescription>
        </DialogHeader>
        <QueryBoundary query={config} loading={<DialogSpinner />} empty={null}>
          {(loaded) => (
            <SettingsForm
              notebookId={notebookId}
              initial={loaded ?? DEFAULT_CHAT_CONFIG}
              onSaved={() => onOpenChange(false)}
            />
          )}
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}
