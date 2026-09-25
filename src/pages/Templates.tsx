import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, MoreHorizontal, Paperclip, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { api, del, post, put, type Media, type Template } from "../lib/api";
import { Button, Card, Empty, Label, Loading, Menu, MenuItem, Modal, PageHeader, useConfirm } from "../components/ui";
import { MessageComposer } from "../components/MessageComposer";
import { WaText } from "../components/PhonePreview";
import { ago } from "../lib/format";
import { local } from "../lib/storage";

export function TemplatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["templates"], queryFn: () => api<{ items: Template[] }>("/templates") });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/templates/${id}`),
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });

  function startCampaign(t: Template) {
    // Handed to the editor through its draft slot, as if it had been typed there.
    local.set("sl.campaign-draft", { name: t.name, message: t.message, media: t.media });
    navigate("/campaigns/new");
  }

  return (
    <>
      <PageHeader
        title="Templates"
        subtitle="Messages you send often, ready to reuse."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>New template</Button>}
      />
      {isLoading ? (
        <Loading />
      ) : !data?.items.length ? (
        <Card>
          <Empty icon={<FileText className="size-6" />} title="No templates yet" action={<Button variant="primary" onClick={() => setEditing("new")}>Create a template</Button>}>
            Save your new-arrivals note, price-list message or festive greeting once and reuse it in any campaign.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold">{t.name}</h3>
                <Menu trigger={() => <button className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Template actions"><MoreHorizontal className="size-4" /></button>}>
                  {(close) => (
                    <>
                      <MenuItem icon={<Pencil />} onClick={() => { close(); setEditing(t); }}>Edit</MenuItem>
                      <MenuItem icon={<Trash2 />} danger onClick={async () => { close(); if (await confirm({ title: `Delete "${t.name}"?`, confirm: "Delete", danger: true })) remove.mutate(t.id); }}>Delete</MenuItem>
                    </>
                  )}
                </Menu>
              </div>
              <div className="mt-3 line-clamp-6 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">
                <WaText text={t.message} />
              </div>
              {t.media && <div className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-3"><Paperclip className="size-3.5" />{t.media.name}</div>}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="text-[12px] text-ink-3">Edited {ago(t.updatedAt)}</span>
                <Button size="sm" variant="soft" icon={<Send className="size-3.5" />} onClick={() => startCampaign(t)}>Use</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <TemplateEditor value={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function TemplateEditor({ value, onClose }: { value: Template | "new" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const t = value && value !== "new" ? value : null;
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [media, setMedia] = useState<Media | null>(null);
  const [openFor, setOpenFor] = useState<unknown>(null);
  if (value !== openFor) {
    setOpenFor(value);
    setName(t?.name ?? "");
    setMessage(t?.message ?? "");
    setMedia(t?.media ?? null);
  }
  const save = useMutation({
    mutationFn: () => (t ? put(`/templates/${t.id}`, { name, message, mediaId: media?.id ?? null }) : post("/templates", { name, message, mediaId: media?.id ?? null })),
    onSuccess: () => {
      toast.success("Template saved");
      qc.invalidateQueries({ queryKey: ["templates"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      open={Boolean(value)}
      onClose={onClose}
      title={t ? "Edit template" : "New template"}
      size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!name.trim() || (!message.trim() && !media)} onClick={() => save.mutate()}>Save template</Button></>}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="t-name">Name</Label>
          <input id="t-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New arrivals" />
        </div>
        <MessageComposer message={message} onMessage={setMessage} media={media} onMedia={setMedia} />
      </div>
    </Modal>
  );
}
