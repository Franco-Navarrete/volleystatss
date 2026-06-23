import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Eye, EyeOff, Facebook, Instagram, Link as LinkIcon, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import {
  getOwnPublicMatch,
  upsertPublicMatch,
  setPublicMatchVisibility,
} from "@/lib/public-match.functions";
import { buildPublicMatchSnapshot } from "@/lib/public-match-snapshot";
import { useVolley, type Match } from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const SITE_URL =
  typeof window !== "undefined" ? window.location.origin : "https://volleystatss.lovable.app";

export function ShareMatchCard({ match }: { match: Match }) {
  const teams = useVolley((s) => s.teams);
  const leagues = useVolley((s) => s.leagues);
  const qc = useQueryClient();

  const getOwn = useServerFn(getOwnPublicMatch);
  const upsert = useServerFn(upsertPublicMatch);
  const setVisibility = useServerFn(setPublicMatchVisibility);

  const { data: own, isLoading } = useQuery({
    queryKey: ["own-public-match", match.id],
    queryFn: () => getOwn({ data: { matchId: match.id } }),
  });

  const snapshot = useMemo(
    () => buildPublicMatchSnapshot(match, teams, leagues),
    [match, teams, leagues],
  );

  const publishMut = useMutation({
    mutationFn: async (isPublic: boolean) => {
      if (!snapshot) throw new Error("snapshot");
      return upsert({ data: { matchId: match.id, snapshot, isPublic } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["own-public-match", match.id] }),
  });

  const visMut = useMutation({
    mutationFn: async (isPublic: boolean) =>
      setVisibility({ data: { matchId: match.id, isPublic } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["own-public-match", match.id] }),
  });

  // Auto-publish when the match finishes and no share exists yet.
  useEffect(() => {
    if (isLoading) return;
    if (own) return;
    if (match.status !== "finished") return;
    if (!snapshot) return;
    publishMut.mutate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, own, match.status]);

  const slug = own?.id;
  const isPublic = !!own?.is_public;
  const shareUrl = slug ? `${SITE_URL}/m/${slug}` : "";

  const refreshSnapshot = () => {
    if (!snapshot) return;
    publishMut.mutate(isPublic);
    toast.success("Snapshot actualizado");
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const nativeShare = async () => {
    if (!shareUrl) return;
    const text = "Mirá las estadísticas del partido en RALLY";
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Partido · RALLY", text, url: shareUrl });
      } catch {
        // user cancelled, ignore
      }
    } else {
      await copyLink();
    }
  };

  if (!snapshot) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 mb-6">
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Share2 className="size-4 text-primary" />
          <h2 className="font-bold text-sm uppercase tracking-wider">Compartir partido</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isPublic ? <Eye className="size-4 text-success" /> : <EyeOff className="size-4" />}
          <span>{isPublic ? "Público" : "Privado"}</span>
          <Switch
            checked={isPublic}
            disabled={!slug || visMut.isPending}
            onCheckedChange={(v) => {
              if (slug) visMut.mutate(v);
              else if (snapshot) publishMut.mutate(v);
            }}
          />
        </div>
      </header>

      {!slug && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Aún no generaste un enlace público para este partido.
          </p>
          <Button
            size="sm"
            onClick={() => publishMut.mutate(true)}
            disabled={publishMut.isPending}
          >
            <LinkIcon className="size-4" />
            {publishMut.isPending ? "Generando…" : "Generar enlace público"}
          </Button>
        </div>
      )}

      {slug && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
            <LinkIcon className="size-4 text-muted-foreground shrink-0" />
            <input
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent text-xs outline-none truncate"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={copyLink}
              className="text-xs font-bold text-primary hover:underline shrink-0"
            >
              <Copy className="size-4" />
            </button>
          </div>

          {!isPublic && (
            <p className="text-[11px] text-muted-foreground">
              El enlace está desactivado. Activá "Público" para que los visitantes puedan verlo.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <ShareButton onClick={nativeShare}>
              <Share2 className="size-4" /> Compartir
            </ShareButton>
            <ShareButton
              href={`https://wa.me/?text=${encodeURIComponent(
                `Estadísticas del partido en RALLY: ${shareUrl}`,
              )}`}
            >
              <MessageCircle className="size-4" /> WhatsApp
            </ShareButton>
            <ShareButton
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
            >
              <Facebook className="size-4" /> Facebook
            </ShareButton>
            <ShareButton
              onClick={async () => {
                await copyLink();
                toast.info("Pegalo en tu historia de Instagram", { duration: 5000 });
              }}
            >
              <Instagram className="size-4" /> Instagram
            </ShareButton>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={refreshSnapshot}
              disabled={publishMut.isPending}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Actualizar snapshot
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ShareButton({
  children,
  href,
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-semibold hover:bg-secondary/50 transition-colors";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
