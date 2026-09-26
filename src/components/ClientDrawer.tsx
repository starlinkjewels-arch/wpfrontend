import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Plus, Trash2, X } from "lucide-react";
import { del, post, put, type Contact } from "../lib/api";
import { useMeta } from "../lib/hooks";
import { Badge, Button, Drawer, Label, Switch, useConfirm } from "./ui";
import { TagInput } from "./TagInput";
import { COUNTRY_OPTIONS, countryName, date, flag, phone as fmtPhone } from "../lib/format";

type Form = {
  name: string;
  phone: string;
  company: string;
  email: string;
  country: string;
  city: string;
  tags: string[];
  notes: string;
  fields: [string, string][];
  optedOut: boolean;
};

const empty: Form = { name: "", phone: "", company: "", email: "", country: "", city: "", tags: [], notes: "", fields: [], optedOut: false };

/** Add a client (contact = null) or edit one. */
export function ClientDrawer({ open, contact, onClose }: { open: boolean; contact: Contact | null; onClose: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: meta } = useMeta();
  const [f, setF] = useState<Form>(empty);

  useEffect(() => {
    if (!open) return;
    setF(
      contact
        ? {
            name: contact.name,
            phone: "+" + contact.phone,
            company: contact.company,
            email: contact.email,
            country: contact.country,
            city: contact.city,
            tags: contact.tags ?? [],
            notes: contact.notes,
            fields: Object.entries(contact.fields ?? {}),
            optedOut: contact.optedOut,
          }
        : empty,
    );
  }, [open, contact]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["contacts-meta"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  /* "Save & add another" keeps the drawer open for typing in clients one after
     another — say, business cards from a trade show. Country and tags stay,
     since a batch usually shares them; everything else clears. */
  const [added, setAdded] = useState(0);
  useEffect(() => {
    if (open) setAdded(0);
  }, [open]);

  const save = useMutation({
    mutationFn: (_another: boolean) => {
      const body = { ...f, fields: Object.fromEntries(f.fields.filter(([k, v]) => k.trim() && v.trim())) };
      return contact ? put<Contact>(`/contacts/${contact.id}`, body) : post<Contact>("/contacts", body);
    },
    onSuccess: (saved, another) => {
      refresh();
      if (another) {
        toast.success(`Added ${saved.name || "client"} — ready for the next one`);
        setAdded((n) => n + 1);
        setF({ ...empty, country: f.country, tags: f.tags });
        requestAnimationFrame(() => document.getElementById("c-phone")?.focus());
        return;
      }
      toast.success(contact ? "Client updated" : "Client added");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => del(`/contacts/${contact!.id}`),
    onSuccess: () => {
      toast.success("Client deleted");
      refresh();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const countries = [...new Set([f.country, ...COUNTRY_OPTIONS].filter(Boolean))];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={contact ? "Edit client" : "Add client"}
      footer={
        <>
          {contact && (
            <Button
              variant="ghost"
              className="mr-auto text-danger hover:bg-danger-soft hover:text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await confirm({ title: `Delete ${contact.name || "this client"}?`, body: "They will be removed from your client list and from future campaigns.", confirm: "Delete", danger: true })) remove.mutate();
              }}
            >
              Delete
            </Button>
          )}
          {!contact && added > 0 && <span className="mr-auto self-center text-[13px] text-brand-text">{added} added</span>}
          <Button variant="ghost" onClick={onClose}>{added ? "Done" : "Cancel"}</Button>
          {!contact && (
            <Button loading={save.isPending && save.variables === true} onClick={() => save.mutate(true)} disabled={!f.phone.trim()}>
              Save &amp; add another
            </Button>
          )}
          <Button variant="primary" loading={save.isPending && save.variables === false} onClick={() => save.mutate(false)} disabled={!f.phone.trim()}>
            {contact ? "Save changes" : "Add client"}
          </Button>
        </>
      }
    >
      {contact && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[12px] text-ink-2">
          <span>{flag(contact.country)} {fmtPhone(contact.phone)}</span>
          <span className="text-ink-3">·</span>
          <span>Added {date(contact.createdAt)}</span>
          {contact.source === "inbound" && <Badge tone="gold">Wrote to us first</Badge>}
          {contact.waStatus === "invalid" && <Badge tone="danger">Not on WhatsApp</Badge>}
          <Link to={`/inbox/${contact.id}`} className="ml-auto inline-flex items-center gap-1 font-medium text-brand-text hover:underline">
            <MessageCircle className="size-3.5" /> Chat
          </Link>
        </div>
      )}
      <div className="space-y-4">
        <div>
          <Label htmlFor="c-phone" hint="With country code, e.g. +971…">WhatsApp number *</Label>
          <input id="c-phone" className="field" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+971 50 123 4567" inputMode="tel" autoFocus={!contact} />
        </div>
        <div>
          <Label htmlFor="c-name">Name</Label>
          <input id="c-name" className="field" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ahmed Al Mansoori" />
        </div>
        <div>
          <Label htmlFor="c-company">Company</Label>
          <input id="c-company" className="field" value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Al Mansoori Jewellers" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="c-country">Country</Label>
            <select id="c-country" className="field" value={f.country} onChange={(e) => set("country", e.target.value)}>
              <option value="">—</option>
              {countries.map((c) => (
                <option key={c} value={c}>{flag(c)} {countryName(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="c-city">City</Label>
            <input id="c-city" className="field" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Dubai" />
          </div>
        </div>
        <div>
          <Label htmlFor="c-email">Email</Label>
          <input id="c-email" type="email" className="field" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="buyer@company.com" />
        </div>
        <div>
          <Label hint="Groups for campaigns — VIP, Dubai, Retailer…">Tags</Label>
          <TagInput value={f.tags} onChange={(v) => set("tags", v)} suggestions={meta?.tags.map((t) => t.tag) ?? []} />
        </div>
        <div>
          <Label hint="Usable in messages as {{name}}">Extra details</Label>
          <div className="space-y-2">
            {f.fields.map(([k, v], i) => (
              <div key={i} className="flex gap-2">
                <input className="field w-2/5" placeholder="e.g. Budget" value={k} onChange={(e) => set("fields", f.fields.map((p, j) => (j === i ? [e.target.value, p[1]] : p)))} />
                <input className="field flex-1" placeholder="$100k" value={v} onChange={(e) => set("fields", f.fields.map((p, j) => (j === i ? [p[0], e.target.value] : p)))} />
                <button type="button" className="rounded-lg px-2 text-ink-3 hover:bg-surface-2 hover:text-ink" onClick={() => set("fields", f.fields.filter((_, j) => j !== i))} aria-label="Remove detail">
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => set("fields", [...f.fields, ["", ""]])}>
              Add detail
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="c-notes">Notes</Label>
          <textarea id="c-notes" rows={3} className="field resize-y" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Prefers 18K white gold. Visits Surat every March." />
        </div>
        <div className="rounded-xl border border-line p-3.5">
          <Switch checked={f.optedOut} onChange={(v) => set("optedOut", v)} label="Opted out" description="Never include this client in campaigns." />
        </div>
      </div>
    </Drawer>
  );
}
