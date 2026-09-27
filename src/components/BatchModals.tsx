import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { Check, Layers, Plus } from "lucide-react";
import { api, post, put, type Batch, type BatchColor } from "../lib/api";
import { BATCH_COLORS, batchColor } from "../lib/batchColors";
import { num } from "../lib/format";
import { Button, Label, Modal, Segmented } from "./ui";

/** Which clients: picked by id, or "everyone matching the current filters". */
export type Selection = { ids?: string[]; filter?: Record<string, string> };

function ColorPicker({ value, onChange }: { value: BatchColor; onChange: (c: BatchColor) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(BATCH_COLORS) as BatchColor[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={BATCH_COLORS[c].label}
          title={BATCH_COLORS[c].label}
          className={clsx("flex size-8 items-center justify-center rounded-full bg-gradient-to-br text-white ring-offset-2 ring-offset-surface transition", BATCH_COLORS[c].tile, value === c && "ring-2 ring-brand")}
        >
          {value === c && <Check className="size-4" />}
        </button>
      ))}
    </div>
  );
}

function refreshAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["batches"] });
  qc.invalidateQueries({ queryKey: ["batch"] });
  qc.invalidateQueries({ queryKey: ["contacts-meta"] });
  qc.invalidateQueries({ queryKey: ["contacts"] });
}

/**
 * From the Clients page: put the selected clients into a new batch, or into
 * one that already exists.
 */
export function AddToBatchModal({ open, onClose, selection, count, onDone }: { open: boolean; onClose: () => void; selection: Selection; count: number; onDone?: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["batches", ""], queryFn: () => api<{ items: Batch[] }>("/batches"), enabled: open });
  const existing = data?.items ?? [];
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<BatchColor>("violet");
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setColor("violet");
    setTarget(null);
  }, [open]);
  useEffect(() => {
    if (open) setMode(existing.length ? mode : "new");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing.length]);

  const create = useMutation({
    mutationFn: () => post<Batch>("/batches", { name, description, color, ...selection }),
    onSuccess: (b) => {
      refreshAll(qc);
      toast.success(`Batch “${b.name}” created with ${num(b.members)} clients`, { action: { label: "Open", onClick: () => navigate(`/batches/${b.id}`) } });
      onDone?.();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const add = useMutation({
    mutationFn: () => post<{ added: number; members: number }>(`/batches/${target}/members`, selection),
    onSuccess: (r) => {
      refreshAll(qc);
      const b = existing.find((x) => x.id === target);
      toast.success(`${num(r.added)} added to “${b?.name}” · ${num(r.members)} members now`, { action: { label: "Open", onClick: () => navigate(`/batches/${target}`) } });
      onDone?.();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<span className="flex items-center gap-2"><Layers className="size-4 text-brand" /> Add {num(count)} client{count === 1 ? "" : "s"} to a batch</span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {mode === "new" ? (
            <Button variant="primary" icon={<Plus className="size-4" />} loading={create.isPending} disabled={!name.trim()} onClick={() => create.mutate()}>Create batch</Button>
          ) : (
            <Button variant="primary" loading={add.isPending} disabled={!target} onClick={() => add.mutate()}>Add to batch</Button>
          )}
        </>
      }
    >
      {existing.length > 0 && (
        <Segmented className="mb-5" value={mode} onChange={setMode} options={[{ value: "new", label: "New batch" }, { value: "existing", label: `Existing batch (${existing.length})` }]} />
      )}
      {mode === "new" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="b-name">Batch name</Label>
            <input id="b-name" autoFocus className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dubai VIP buyers — Oct 2026" maxLength={80} onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate()} />
          </div>
          <div>
            <Label htmlFor="b-desc" hint="Optional">Description</Label>
            <textarea id="b-desc" rows={2} className="field resize-y" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who is in it and why — e.g. buyers met at the Dubai show, interested in solitaires" />
          </div>
          <div>
            <Label>Colour</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
      ) : (
        <ul className="scroll-thin max-h-80 space-y-2 overflow-y-auto">
          {existing.map((b) => {
            const col = batchColor(b.color);
            return (
              <li key={b.id}>
                <button type="button" onClick={() => setTarget(b.id)} className={clsx("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition", target === b.id ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-line hover:border-line-strong")}>
                  <span className={clsx("flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white", col.tile)}><Layers className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{b.name}</span>
                    <span className="block text-[12px] text-ink-3">{num(b.members)} members · {num(b.totals.broadcasts)} broadcasts</span>
                  </span>
                  {target === b.id && <Check className="size-4 text-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** Create an empty batch (then add clients), or rename / recolour one. */
export function BatchFormModal({ open, onClose, batch }: { open: boolean; onClose: () => void; batch?: Pick<Batch, "id" | "name" | "description" | "color"> | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<BatchColor>("violet");
  useEffect(() => {
    if (!open) return;
    setName(batch?.name ?? "");
    setDescription(batch?.description ?? "");
    setColor(batch?.color ?? "violet");
  }, [open, batch]);

  const save = useMutation({
    mutationFn: () => (batch ? put<Batch>(`/batches/${batch.id}`, { name, description, color }) : post<Batch>("/batches", { name, description, color, ids: [] })),
    onSuccess: (b) => {
      refreshAll(qc);
      toast.success(batch ? "Batch saved" : `Batch “${b.name}” created — now add clients`);
      onClose();
      if (!batch) navigate(`/batches/${b.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={batch ? "Edit batch" : "New batch"}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate()}>{batch ? "Save" : "Create batch"}</Button></>}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="bf-name">Batch name</Label>
          <input id="bf-name" autoFocus className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Hong Kong show leads" />
        </div>
        <div>
          <Label htmlFor="bf-desc" hint="Optional">Description</Label>
          <textarea id="bf-desc" rows={3} className="field resize-y" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label>Colour</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>
    </Modal>
  );
}
