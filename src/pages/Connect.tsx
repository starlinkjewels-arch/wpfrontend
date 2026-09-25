import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Smartphone, LogOut, ShieldAlert, Loader2, MoreVertical, Link2, ScanLine, Info } from "lucide-react";
import { toast } from "sonner";
import { post } from "../lib/api";
import { useStatus } from "../lib/hooks";
import { Button, Callout, Card, PageHeader, useConfirm } from "../components/ui";

const STEPS = [
  { icon: Smartphone, text: "Open WhatsApp on the business phone" },
  { icon: MoreVertical, text: <>Tap <b>⋮ Menu</b> (Android) or <b>Settings</b> (iPhone)</> },
  { icon: Link2, text: <>Tap <b>Linked devices</b>, then <b>Link a device</b></> },
  { icon: ScanLine, text: "Point the phone at the QR code on this screen" },
];

export function ConnectPage() {
  const { data, isLoading } = useStatus();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const wa = data?.wa;

  const disconnect = useMutation({
    mutationFn: () => post("/wa/disconnect"),
    onSuccess: () => {
      toast.success("Disconnected. A new QR code will appear in a moment.");
      qc.invalidateQueries({ queryKey: ["status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onDisconnect() {
    const ok = await confirm({
      title: "Disconnect WhatsApp?",
      body: "This logs this app out of your WhatsApp. Running campaigns will pause until you scan the QR code again.",
      confirm: "Disconnect",
      danger: true,
    });
    if (ok) disconnect.mutate();
  }

  return (
    <>
      <PageHeader title="WhatsApp connection" subtitle="Link your business WhatsApp number — the same way WhatsApp Web works." />

      {wa?.halted && (
        <Callout tone="danger" icon={<ShieldAlert />} title="Sending has stopped and needs you" className="mb-6">
          {wa.error} <br />
          When the cause is fixed, press <b>Disconnect</b> below and scan again.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card className="flex flex-col items-center justify-center p-8 text-center">
          {isLoading ? (
            <Loader2 className="size-8 animate-spin text-ink-3" />
          ) : wa?.status === "connected" ? (
            <>
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-brand/20" style={{ animationDuration: "2.4s" }} />
                <div className="relative flex size-20 items-center justify-center rounded-full bg-brand-soft text-brand-text">
                  <CheckCircle2 className="size-10" />
                </div>
              </div>
              <h2 className="mt-6 text-xl font-semibold">Connected</h2>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{wa.phoneDisplay}</p>
              <p className="mt-2 max-w-xs text-sm text-ink-2">Campaigns and replies go through this number. You can keep using WhatsApp on your phone as normal.</p>
              <Button variant="secondary" className="mt-8" icon={<LogOut className="size-4" />} loading={disconnect.isPending} onClick={onDisconnect}>
                Disconnect
              </Button>
            </>
          ) : wa?.qr ? (
            <>
              <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
                <img src={wa.qr} alt="WhatsApp QR code" className="size-64 sm:size-72" />
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm font-medium text-ink">
                <span className="size-2 animate-pulse-dot rounded-full bg-brand" /> Waiting for scan…
              </p>
              <p className="mt-1 text-[13px] text-ink-3">The code refreshes by itself. Keep this page open.</p>
            </>
          ) : (
            <>
              <Loader2 className="size-10 animate-spin text-ink-3" />
              <h2 className="mt-5 text-lg font-semibold">{wa?.halted ? "Stopped" : "Preparing QR code…"}</h2>
              <p className="mt-1 max-w-xs text-sm text-ink-2">{wa?.error ?? "This takes a few seconds. If the server was asleep it can take up to a minute."}</p>
              {wa?.halted && (
                <Button className="mt-6" onClick={onDisconnect} loading={disconnect.isPending}>
                  Reset connection
                </Button>
              )}
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-[15px] font-semibold">How to connect</h3>
            <ol className="mt-4 space-y-4">
              {STEPS.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-3.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-ink-2">{i + 1}</span>
                  <span className="flex items-center gap-2 pt-1 text-sm text-ink-2">
                    <Icon className="size-4 shrink-0 text-ink-3" />
                    <span>{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
          <Callout tone="gold" icon={<Info />} title="Keep your number safe">
            WhatsApp watches for spam. Message people who know your business, keep the Safe or Normal speed, and don't raise the daily limit on a new number. Clients who reply STOP are removed automatically.
          </Callout>
          {data?.demo && (
            <Callout tone="neutral" icon={<Info />}>
              Demo mode: this QR code links nothing — the demo connects by itself after a few seconds.
            </Callout>
          )}
        </div>
      </div>
    </>
  );
}
