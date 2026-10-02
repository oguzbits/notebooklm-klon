import { ClipboardPaste, Link2, Upload } from 'lucide-react';
import { type DragEvent, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ACCEPTED_FILES = '.pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp';

/** The dashed area that files are dropped on (or clicked to choose one). */
function FileDropZone({
  onPick,
  onFile,
}: {
  onPick: () => void;
  onFile: (file: File | undefined) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    onFile(event.dataTransfer.files[0]);
  };

  return (
    <div
      onClick={onPick}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-input px-6 py-10 text-center text-small text-muted-foreground',
        dragging && 'bg-accent'
      )}
    >
      <Upload className="size-6" aria-hidden />
      <p>
        Dateien zum Hochladen per Drag-and-drop hierher ziehen.
        <br />
        PDF, DOCX, PPTX, TXT, MD oder Bild (PNG, JPG, WEBP), bis 10 MB.
      </p>
    </div>
  );
}

interface AddSourceChoiceProps {
  uploading: boolean;
  /** A file was chosen or dropped. */
  onFile: (file: File | undefined) => void;
  onWebPage: () => void;
  onText: () => void;
}

/** The first view: three pills (file, web page, pasted text) and a zone to drop files on. */
export function AddSourceChoice({ uploading, onFile, onWebPage, onText }: AddSourceChoiceProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const pickFile = () => fileInput.current?.click();
  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_FILES}
        className="hidden"
        aria-label="Datei auswählen"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="outline"
          size="lg"
          className="text-[1.0625rem]"
          disabled={uploading}
          onClick={pickFile}
        >
          <Upload />
          {uploading ? 'Wird hochgeladen …' : 'Datei hochladen'}
        </Button>
        <Button variant="outline" size="lg" className="text-[1.0625rem]" onClick={onWebPage}>
          <Link2 />
          Webseite
        </Button>
        <Button variant="outline" size="lg" className="text-[1.0625rem]" onClick={onText}>
          <ClipboardPaste />
          Kopierter Text
        </Button>
      </div>
      <FileDropZone onPick={pickFile} onFile={onFile} />
    </>
  );
}
