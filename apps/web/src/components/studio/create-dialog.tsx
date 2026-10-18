import {
  type CreateStudioBody,
  MAX_STUDIO_FOCUS_CHARS,
  REPORT_FORMAT,
  type ReportFormat,
  type SourceSummary,
  STUDIO_DIFFICULTY,
  STUDIO_KIND,
  STUDIO_SIZE,
  type StudioDifficulty,
  type StudioKind,
  type StudioSize,
} from '@nlm/shared';
import { Check } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';

import {
  FIELD_LABEL,
  FocusField,
  SegmentedField,
  SourcesField,
} from '@/components/studio/studio-fields';
import { CUSTOM_IDEAS, IDEAS } from '@/components/studio/studio-ideas';
import {
  FORMAT_DESCRIPTION,
  FORMAT_LABEL,
  REPORT_TEMPLATES,
} from '@/components/studio/studio-labels';
import { KIND_COLOR, KIND_ICON } from '@/components/studio/studio-tiles';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { buildCreateBody } from '@/lib/studio-request';
import { cn } from '@/lib/utils';

/** What the dialog of each format is called; the one for cards says "Lernkarten" ("Flashcards") like the original. */
const DIALOG_TITLE: Record<StudioKind, string> = {
  [STUDIO_KIND.REPORT]: tr('Bericht erstellen', 'Create report'),
  [STUDIO_KIND.FLASHCARDS]: tr('Lernkarten', 'Flashcards'),
  [STUDIO_KIND.QUIZ]: tr('Quiz', 'Quiz'),
  [STUDIO_KIND.MINDMAP]: tr('Mindmap', 'Mind Map'),
  [STUDIO_KIND.DATA_TABLE]: tr('Datentabelle', 'Data table'),
};

const COUNT_LABEL = {
  [STUDIO_KIND.FLASHCARDS]: tr('Anzahl der Karten', 'Number of cards'),
  [STUDIO_KIND.QUIZ]: tr('Anzahl der Fragen', 'Number of questions'),
} as const;

/** The words of the middle choice differ between cards and questions in the original. */
const USUAL_SIZE = {
  [STUDIO_KIND.FLASHCARDS]: tr('Standardeinstellung', 'Default'),
  [STUDIO_KIND.QUIZ]: tr('Standard (Standardeinstellung)', 'Default (default setting)'),
} as const;

const DIFFICULTIES: readonly { value: StudioDifficulty; label: string }[] = [
  { value: STUDIO_DIFFICULTY.EASY, label: tr('Einfach', 'Easy') },
  {
    value: STUDIO_DIFFICULTY.MEDIUM,
    label: tr('Mittel (Standardeinstellung)', 'Medium (default setting)'),
  },
  { value: STUDIO_DIFFICULTY.HARD, label: tr('Schwierig', 'Hard') },
];

interface TemplateCardsProps {
  value: ReportFormat | null;
  onChange: (format: ReportFormat) => void;
}

/** The cards of the templates of a report, three lines each. */
function TemplateCards({ value, onChange }: TemplateCardsProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className={FIELD_LABEL} id="report-template">
        {tr('Vorlage', 'Template')}
      </p>
      <div
        role="radiogroup"
        aria-labelledby="report-template"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {REPORT_TEMPLATES.map((format) => {
          const selected = format === value;
          return (
            <button
              key={format}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(format)}
              className={cn(
                'flex min-h-36 flex-col gap-2 rounded-3xl border p-4 text-left',
                selected
                  ? 'border-transparent bg-selected text-selected-foreground'
                  : 'veil border-border'
              )}
            >
              <span className="flex items-start justify-between gap-2 text-[1.0625rem] leading-6 wrap-anywhere hyphens-auto">
                {FORMAT_LABEL[format]}
                {selected && (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-card">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                )}
              </span>
              <span className="line-clamp-4 text-small wrap-anywhere hyphens-auto text-muted-foreground">
                {FORMAT_DESCRIPTION[format]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The two kinds that ask how many and how hard. */
type Countable = typeof STUDIO_KIND.FLASHCARDS | typeof STUDIO_KIND.QUIZ;
const isCountable = (kind: StudioKind): kind is Countable =>
  kind === STUDIO_KIND.FLASHCARDS || kind === STUDIO_KIND.QUIZ;

interface SizeFieldsProps {
  kind: Countable;
  size: StudioSize;
  difficulty: StudioDifficulty;
  onSize: (size: StudioSize) => void;
  onDifficulty: (difficulty: StudioDifficulty) => void;
}

/** How many cards or questions, and how hard. */
function SizeFields({ kind, size, difficulty, onSize, onDifficulty }: SizeFieldsProps) {
  const sizeOptions = [
    { value: STUDIO_SIZE.FEWER, label: tr('Weniger', 'Fewer') },
    { value: STUDIO_SIZE.DEFAULT, label: USUAL_SIZE[kind] },
    { value: STUDIO_SIZE.MORE, label: tr('Mehr', 'More') },
  ];
  return (
    <div className="grid grid-cols-1 gap-6 @min-[52rem]:grid-cols-2">
      <SegmentedField
        label={COUNT_LABEL[kind]}
        options={sizeOptions}
        value={size}
        onChange={onSize}
      />
      <SegmentedField
        label={tr('Schwierigkeitsgrad', 'Difficulty')}
        options={DIFFICULTIES}
        value={difficulty}
        onChange={onDifficulty}
      />
    </div>
  );
}

interface CreateFormProps {
  kind: StudioKind;
  sources: readonly SourceSummary[];
  onSubmit: (body: CreateStudioBody) => void;
}

/** The fields of one dialog and the request they make. A new one for every opening. */
function CreateForm({ kind, sources, onSubmit }: CreateFormProps) {
  const [size, setSize] = useState<StudioSize>(STUDIO_SIZE.DEFAULT);
  const [difficulty, setDifficulty] = useState<StudioDifficulty>(STUDIO_DIFFICULTY.MEDIUM);
  const [format, setFormat] = useState<ReportFormat | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(sources.map((source) => source.id))
  );
  const [focus, setFocus] = useState('');
  const body = buildCreateBody({ kind, format, size, difficulty, chosen, focus }, sources);
  const custom = format === REPORT_FORMAT.CUSTOM;

  return (
    <>
      <div className="@container flex flex-col gap-7 px-5 pt-6 pb-8 sm:px-7">
        {kind === STUDIO_KIND.REPORT && <TemplateCards value={format} onChange={setFormat} />}
        {isCountable(kind) && (
          <SizeFields
            kind={kind}
            size={size}
            difficulty={difficulty}
            onSize={setSize}
            onDifficulty={setDifficulty}
          />
        )}
        <SourcesField sources={sources} chosen={chosen} onChange={setChosen} />
        <FocusField
          label={
            custom
              ? tr('Wie soll der Bericht aussehen?', 'What should the report look like?')
              : tr('Was soll das Thema sein?', 'What should the topic be?')
          }
          hint={
            custom
              ? tr('Anweisung für den Bericht', 'Instruction for the report')
              : tr('Thema', 'Topic')
          }
          ideas={custom ? CUSTOM_IDEAS : IDEAS[kind]}
          value={focus}
          maxLength={MAX_STUDIO_FOCUS_CHARS}
          onChange={setFocus}
        />
      </div>
      <div className="flex justify-end border-t border-border px-5 py-5">
        <Button
          variant="secondary"
          size="xl"
          disabled={body === null}
          onClick={() => body && onSubmit(body)}
        >
          {tr('Generieren', 'Generate')}
        </Button>
      </div>
    </>
  );
}

interface CreateDialogProps {
  kind: StudioKind;
  /** The sources the output can be made from: selected and ready. */
  sources: readonly SourceSummary[];
  onCreate: (body: CreateStudioBody) => void;
  children: ReactNode;
}

/**
 * The dialog behind a tile of the Studio, like NotebookLM asks before it makes anything: how many,
 * how hard, from which sources, about what. The trigger is the tile that is passed in.
 */
export function CreateDialog({ kind, sources, onCreate, children }: CreateDialogProps) {
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const Icon = KIND_ICON[kind];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        ref={content}
        card
        className="gap-0 p-0 sm:max-w-[894px]"
        closeClassName="top-7 right-7 size-12 bg-accent text-foreground"
        // The dialog itself takes the focus, so no choice shows a ring before anything was done.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.focus();
        }}
      >
        <DialogHeader className="flex-row items-center gap-3 px-5 pt-7 pb-1 sm:px-7">
          <Icon className={cn('size-6', KIND_COLOR[kind])} aria-hidden />
          <DialogTitle className="text-[1.25rem] leading-6 font-title">
            {DIALOG_TITLE[kind]}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {tr(
              'Lege fest, woraus und wie die Ausgabe entsteht. Sie stützt sich nur auf deine Quellen.',
              'Choose what the output is made from and how. It relies only on your sources.'
            )}
          </DialogDescription>
        </DialogHeader>
        <CreateForm
          kind={kind}
          sources={sources}
          onSubmit={(body) => {
            setOpen(false);
            onCreate(body);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
