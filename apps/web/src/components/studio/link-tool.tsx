import type { Editor } from '@tiptap/react';
import { Link } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** A web address without a scheme ("tiptap.dev") is meant as https, not as a path on this site. */
const withScheme = (address: string) => (URL_SCHEME.test(address) ? address : `https://${address}`);

interface LinkFormProps {
  address: string;
  /** The text under the cursor already is a link: it can be taken away. */
  active: boolean;
  onChange: (address: string) => void;
  onSubmit: (event: FormEvent) => void;
  onRemove: () => void;
}

/** The address of the link, "Übernehmen", and where there is a link, "Link entfernen". */
function LinkForm({ address, active, onChange, onSubmit, onRemove }: LinkFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Input
        aria-label="Adresse des Links"
        placeholder="https://"
        inputMode="url"
        value={address}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="flex justify-end gap-2">
        {active && (
          <Button type="button" variant="ghost" onClick={onRemove}>
            Link entfernen
          </Button>
        )}
        <Button type="submit">Übernehmen</Button>
      </div>
    </form>
  );
}

interface LinkToolProps {
  editor: Editor;
  active: boolean;
  enabled: boolean;
}

/** "Verknüpfen": gives the selected text an address, changes it, or takes it away. */
export function LinkTool({ editor, active, enabled }: LinkToolProps) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');

  const close = () => {
    setOpen(false);
    editor.commands.focus();
  };
  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    close();
  };
  const apply = (event: FormEvent) => {
    event.preventDefault();
    const typed = address.trim();
    if (typed === '') return remove();
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: withScheme(typed) })
      .run();
    close();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setAddress(editor.getAttributes('link').href ?? '');
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Verknüpfen"
          tooltip="Verknüpfen"
          aria-pressed={active}
          disabled={!enabled}
          onMouseDown={(event) => event.preventDefault()}
          className={cn(active && 'bg-accent')}
        >
          <Link />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" onCloseAutoFocus={(event) => event.preventDefault()}>
        <LinkForm
          address={address}
          active={active}
          onChange={setAddress}
          onSubmit={apply}
          onRemove={remove}
        />
      </PopoverContent>
    </Popover>
  );
}
