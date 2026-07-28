import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useWorkspaceStore } from "@/lib/video/workspace-store";
import { ReactNode } from "react";
import { GripVertical } from "lucide-react";

export function WorkspaceLayout({
  video,
  timeline,
  left,
  right,
}: {
  video: ReactNode;
  timeline: ReactNode;
  left: ReactNode;
  right: ReactNode;
}) {
  const store = useWorkspaceStore();

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full w-full bg-background">
      {store.leftPanelOpen && (
        <>
          <ResizablePanel 
            defaultSize={store.leftPanelSize} 
            onResize={(size: any) => store.setLeftPanelSize(size)} 
            minSize={15}
            className="bg-card/30 backdrop-blur-sm"
          >
            {left}
          </ResizablePanel>
          <ResizableHandle className="w-1.5 hover:bg-primary/20 flex items-center justify-center transition-colors cursor-col-resize">
            <GripVertical className="size-4 text-border" />
          </ResizableHandle>
        </>
      )}
      
      <ResizablePanel className="flex flex-col h-full min-w-[400px]">
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize={70} className="p-2 overflow-hidden bg-black/40">
            <div className="h-full w-full relative">
              {video}
            </div>
          </ResizablePanel>
          <ResizableHandle className="h-1.5 hover:bg-primary/20 flex items-center justify-center transition-colors cursor-row-resize">
            <GripVertical className="size-4 text-border rotate-90" />
          </ResizableHandle>
          <ResizablePanel defaultSize={30} className="p-2 overflow-hidden bg-card/20 backdrop-blur-sm">
            {timeline}
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      {store.rightPanelOpen && (
        <>
          <ResizableHandle className="w-1.5 hover:bg-primary/20 flex items-center justify-center transition-colors cursor-col-resize">
            <GripVertical className="size-4 text-border" />
          </ResizableHandle>
          <ResizablePanel 
            defaultSize={store.rightPanelSize} 
            onResize={(size: any) => store.setRightPanelSize(size)} 
            minSize={15}
            className="bg-card/30 backdrop-blur-sm"
          >
            {right}
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
