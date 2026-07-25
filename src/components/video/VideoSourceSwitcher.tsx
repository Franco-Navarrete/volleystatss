/**
 * Compat shim — el selector unificado vive ahora en `VideoSourcePicker`.
 * Este wrapper mantiene la API previa (hasLinked / current / onChange) para
 * la ruta de Scouting sobre video pregrabado, adaptándola al nuevo hook.
 */
import { useCallback } from "react";
import { VideoSourcePicker, VideoSourceChip } from "@/components/video/VideoSourcePicker";
import { useVideoSource } from "@/hooks/use-video-source";
import type { VideoSourceKind } from "@/lib/video/providers";

export type { VideoSourceKind } from "@/lib/video/providers";

interface Props {
  hasLinked: boolean;
  current: VideoSourceKind;
  onChange: (kind: VideoSourceKind, payload: { src?: string | null; stream?: MediaStream | null }) => void;
}

export function VideoSourceSwitcher({ hasLinked, onChange }: Props) {
  const { source, status, open } = useVideoSource();

  const pick = useCallback(async (kind: VideoSourceKind, opts: { file?: File; cameraDeviceId?: string }) => {
    const next = await open(kind, opts);
    if (next) onChange(kind, { src: next.src ?? null, stream: next.stream ?? null });
  }, [onChange, open]);

  return (
    <div className="flex flex-wrap items-center gap-2 bg-card/40 border border-border rounded-lg p-2">
      <VideoSourcePicker current={source} hasLinked={hasLinked} onPick={(k, o) => void pick(k, o)} />
      <div className="ml-auto">
        <VideoSourceChip source={source} interrupted={status === "interrupted"} />
      </div>
    </div>
  );
}
