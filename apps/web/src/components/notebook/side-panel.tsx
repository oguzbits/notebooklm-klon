import { NotesPanel } from '@/components/notes/notes-panel';
import { SourcesPanel } from '@/components/sources/sources-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TAB = { SOURCES: 'SOURCES', NOTES: 'NOTES' } as const;

/** The left side: the sources of the notebook, and the notes saved from answers. */
export function SidePanel({
  notebookId,
  onOpenSource,
  onOpenCitation,
}: {
  notebookId: string;
  onOpenSource: (sourceId: string) => void;
  onOpenCitation: (chunkId: string) => void;
}) {
  return (
    <Tabs defaultValue={TAB.SOURCES} className="h-full gap-0">
      <TabsList className="m-3 mb-0 self-start">
        <TabsTrigger value={TAB.SOURCES}>Quellen</TabsTrigger>
        <TabsTrigger value={TAB.NOTES}>Notizen</TabsTrigger>
      </TabsList>
      <TabsContent value={TAB.SOURCES} className="min-h-0">
        <SourcesPanel notebookId={notebookId} onOpenSource={onOpenSource} />
      </TabsContent>
      <TabsContent value={TAB.NOTES} className="min-h-0">
        <NotesPanel notebookId={notebookId} onOpenCitation={onOpenCitation} />
      </TabsContent>
    </Tabs>
  );
}
