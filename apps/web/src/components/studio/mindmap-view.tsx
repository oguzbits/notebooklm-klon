import type { Mindmap } from '@nlm/shared';
import { Maximize2 } from 'lucide-react';

import { CitedBy } from '@/components/studio/cited-by';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface TreeNode {
  label: string;
  chunkIds: string[];
  children?: TreeNode[];
}

/**
 * One node and, to its right, its children. The lines come from the borders of the wrappers: each
 * child has a short line to its left, and the vertical line joins its siblings.
 */
function Branch({
  node,
  notebookId,
  onOpenCitation,
  root = false,
}: {
  node: TreeNode;
  notebookId: string;
  onOpenCitation: (chunkId: string) => void;
  root?: boolean;
}) {
  const children = node.children ?? [];
  return (
    <div className="flex items-center">
      <div
        className={cn(
          'max-w-56 shrink-0 rounded-lg px-4 py-2 text-ui',
          root ? 'bg-node-root' : 'bg-node-branch'
        )}
      >
        {node.label}
        {node.chunkIds.length > 0 && (
          <span className="ml-1">
            <CitedBy notebookId={notebookId} chunkIds={node.chunkIds} onOpen={onOpenCitation} />
          </span>
        )}
      </div>
      {children.length > 0 && (
        <ul className="relative ml-6 flex flex-col before:absolute before:top-1/2 before:-left-6 before:w-6 before:border-t before:border-input">
          {children.map((child) => (
            <li
              key={child.label}
              className="relative py-1.5 pl-6 before:absolute before:top-1/2 before:left-0 before:w-6 before:border-t before:border-input after:absolute after:left-0 after:h-full after:border-l after:border-input first:after:top-1/2 first:after:h-1/2 last:after:h-1/2 only:after:hidden"
            >
              <Branch node={child} notebookId={notebookId} onOpenCitation={onOpenCitation} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Canvas({
  notebookId,
  mindmap,
  onOpenCitation,
  label,
}: {
  notebookId: string;
  mindmap: Mindmap;
  onOpenCitation: (chunkId: string) => void;
  label: string;
}) {
  return (
    <div className="overflow-auto pb-2" tabIndex={0} aria-label={label}>
      <div className="w-max min-w-full py-2">
        <Branch
          root
          node={{ label: mindmap.title, chunkIds: [], children: mindmap.branches }}
          notebookId={notebookId}
          onOpenCitation={onOpenCitation}
        />
      </div>
    </div>
  );
}

/**
 * A mind map from left to right: the topic, its branches, their twigs. It scrolls sideways in the
 * narrow Studio column and opens larger in a dialog.
 */
export function MindmapView({
  notebookId,
  mindmap,
  onOpenCitation,
}: {
  notebookId: string;
  mindmap: Mindmap;
  onOpenCitation: (chunkId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="self-start">
            <Maximize2 />
            Vergrößern
          </Button>
        </DialogTrigger>
        <DialogContent className="h-[85dvh] max-w-[calc(100%-2rem)] grid-rows-[auto_1fr] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{mindmap.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Die Mindmap in voller Größe. Die Nummern führen zu den Textstellen.
            </DialogDescription>
          </DialogHeader>
          <Canvas
            notebookId={notebookId}
            mindmap={mindmap}
            onOpenCitation={onOpenCitation}
            label="Mindmap groß"
          />
        </DialogContent>
      </Dialog>
      <Canvas
        notebookId={notebookId}
        mindmap={mindmap}
        onOpenCitation={onOpenCitation}
        label="Mindmap"
      />
    </div>
  );
}
