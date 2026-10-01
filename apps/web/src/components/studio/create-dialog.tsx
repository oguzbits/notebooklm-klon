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
import { buildCreateBody } from '@/lib/studio-request';
import { cn } from '@/lib/utils';

/** What the dialog of each format is called; the one for cards says "Lernkarten" like the original. */
const DIALOG_TITLE: Record<StudioKind, string> = {
  [STUDIO_KIND.REPORT]: 'Bericht erstellen',
  [STUDIO_KIND.FLASHCARDS]: 'Lernkarten',
  [STUDIO_KIND.QUIZ]: 'Quiz',
  [STUDIO_KIND.MINDMAP]: 'Mindmap',
};

const COUNT_LABEL = {
  [STUDIO_KIND.FLASHCARDS]: 'Anzahl der Karten',
  [STUDIO_KIND.QUIZ]: 'Anzahl der Fragen',
} as const;

/** The words of the middle choice differ between cards and questions in the original. */
const USUAL_SIZE = {
  [STUDIO_KIND.FLASHCARDS]: 'Standardeinstellung',
  [STUDIO_KIND.QUIZ]: 'Standard (Standardeinstellung)',
} as const;

const DIFFICULTIES: readonly { value: StudioDifficulty; label: string }[] = [
  { value: STUDIO_DIFFICULTY.EASY, label: 'Einfach' },
  { value: STUDIO_DIFFICULTY.MEDIUM, label: 'Mittel (Standardeinstellung)' },
  { value: STUDIO_DIFFICULTY.HARD, label: 'Schwierig' },
];

/** Ideas shown in the empty topic field, like the original; they are only examples. */
const IDEAS: Record<StudioKind, readonly string[]> = {
  [STUDIO_KIND.REPORT]: [
    'Der Bericht richtet sich an Leser ohne Vorwissen (z. B. „für eine Besprechung am Montag“)',
    'Der Bericht stellt die Ergebnisse in einer Tabelle dar',
    'Der Bericht hat einen sachlichen Ton und höchstens eine Seite',
  ],
  [STUDIO_KIND.FLASHCARDS]: [
    'Die Lernkarten müssen auf eine bestimmte Quelle beschränkt sein (z. B. „der Artikel über Italien“)',
    'Die Lernkarten müssen sich auf ein konkretes Thema beziehen (z. B. „Newtons zweites Gesetz“)',
    'Der Text auf der Vorderseite der Karten muss kurz sein (1 bis 5 Wörter), damit er sich leicht merken lässt',
  ],
  [STUDIO_KIND.QUIZ]: [
    'Erstelle mir ein Quiz, mit dem ich für meinen Geschichtstest über das Alte Ägypten lernen kann',
    'Das Quiz muss auf eine bestimmte Quelle beschränkt sein (z. B. „der Artikel über Italien“)',
    'Das Quiz muss sich ausschließlich auf die wichtigsten Konzepte der Physik konzentrieren',
  ],
  [STUDIO_KIND.MINDMAP]: [
    'Die Mindmap muss auf eine bestimmte Quelle beschränkt sein, z. B. „der Artikel über Italien“',
    'Die Mindmap muss sich ausschließlich auf die wichtigsten Konzepte der Quantenphysik konzentrieren',
    'Eine Mindmap, die mir dabei hilft, mir die Ursachen des Ersten Weltkriegs zu merken',
  ],
};

const CUSTOM_IDEAS = [
  'Ein Brief an die Projektleitung, der die Ergebnisse in drei Absätzen zusammenfasst',
  'Eine Checkliste mit allen Fristen und Zuständigkeiten aus den Quellen',
  'Ein Vergleich der Quellen in einer Tabelle, danach eine kurze Empfehlung',
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
        Vorlage
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
              <span className="flex items-start justify-between gap-2 text-[1.0625rem] leading-6">
                {FORMAT_LABEL[format]}
                {selected && (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-card">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                )}
              </span>
              <span className="line-clamp-4 text-small text-muted-foreground">
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
    { value: STUDIO_SIZE.FEWER, label: 'Weniger' },
    { value: STUDIO_SIZE.DEFAULT, label: USUAL_SIZE[kind] },
    { value: STUDIO_SIZE.MORE, label: 'Mehr' },
  ];
  return (
    <div className="grid gap-7 sm:grid-cols-2">
      <SegmentedField
        label={COUNT_LABEL[kind]}
        options={sizeOptions}
        value={size}
        onChange={onSize}
      />
      <SegmentedField
        label="Schwierigkeitsgrad"
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
      <div className="flex flex-col gap-7 px-7 pt-6 pb-8">
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
          label={custom ? 'Wie soll der Bericht aussehen?' : 'Was soll das Thema sein?'}
          hint={custom ? 'Anweisung für den Bericht' : 'Thema'}
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
          Generieren
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
        className="gap-0 p-0 sm:max-w-[894px]"
        closeClassName="top-7 right-7 size-12 bg-accent text-foreground"
        // The dialog itself takes the focus, so no choice shows a ring before anything was done.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.focus();
        }}
      >
        <DialogHeader className="flex-row items-center gap-3 px-7 pt-7 pb-1">
          <Icon className={cn('size-6', KIND_COLOR[kind])} aria-hidden />
          <DialogTitle className="text-[1.25rem] leading-6 font-title">
            {DIALOG_TITLE[kind]}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Lege fest, woraus und wie die Ausgabe entsteht. Sie stützt sich nur auf deine Quellen.
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
