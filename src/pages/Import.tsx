import { useMemo, useRef, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Download, FileSpreadsheet, Info, Megaphone, RefreshCw, UploadCloud, Users, CopyX, Ban } from "lucide-react";
import { post } from "../lib/api";
import { useMeta, useSettings } from "../lib/hooks";
import { Badge, Button, Callout, Card, Label, PageHeader, Segmented } from "../components/ui";
import { TagInput } from "../components/TagInput";
import { readWorkbook, guessMapping, downloadSample, TARGETS, type Target, type Workbook } from "../lib/excel";
import { COUNTRY_OPTIONS, countryName, flag, num, phone } from "../lib/format";

type Row = { row: number; name: string; company: string; phone?: string; raw?: string; country?: string; status: "new" | "update" | "skip" | "duplicate" | "invalid"; message?: string };
type Preview = { summary: { total: number; new: number; update: number; skip: number; duplicate: number; invalid: number; empty: number; warnings: number }; rows: Row[] };

const STEPS = ["Upload", "Match columns", "Review", "Done"];

export function ImportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: meta } = useMeta();
  const [step, setStep] = useState(0);
  const [book, setBook] = useState<Workbook | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<Record<string, Target>>({});
  const [defaultCountry, setDefaultCountry] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [onDuplicate, setOnDuplicate] = useState<"update" | "skip">("update");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ saved: number; summary: Preview["summary"] } | null>(null);

  const sheet = book?.sheets[sheetIdx];
  const country = defaultCountry || settings?.defaultCountry || "IN";
  const options = () => ({ defaultCountry: country, tags, onDuplicate, headerRowOffset: sheet?.firstDataRow ?? 2 });
  const payload = () => ({ rows: sheet!.rows, mapping, options: options() });

  const check = useMutation({
    mutationFn: () => post<Preview>("/contacts/import/preview", payload()),
    onSuccess: (p) => {
      setPreview(p);
      setStep(2);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const commit = useMutation({
    mutationFn: () => post<{ saved: number; summary: Preview["summary"] }>("/contacts/import/commit", payload()),
    onSuccess: (r) => {
      setResult(r);
      setStep(3);
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contacts-meta"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File) {
    if (!/\.(xlsx|xlsm|xls|csv|ods|txt)$/i.test(file.name)) return toast.error("Choose an Excel (.xlsx, .xls) or CSV file");
    if (file.size > 25 * 1024 * 1024) return toast.error("That file is larger than 25 MB — split it into smaller files");
    try {
      const wb = await readWorkbook(file);
      const best = wb.sheets.reduce((b, s, i) => (s.rows.length > wb.sheets[b].rows.length ? i : b), 0);
      setBook(wb);
      setSheetIdx(best);
      setMapping(guessMapping(wb.sheets[best].headers, wb.sheets[best].rows));
      setStep(1);
    } catch (err) {
      toast.error((err as Error).message || "Could not read that file");
    }
  }

  function pickSheet(i: number) {
    setSheetIdx(i);
    setMapping(guessMapping(book!.sheets[i].headers, book!.sheets[i].rows));
  }

  const hasPhone = Object.values(mapping).includes("phone");
  const hasCountryInfo = Object.values(mapping).some((t) => t === "country" || t === "countryCode");

  return (
    <>
      <Link to="/clients" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> Clients
      </Link>
      <PageHeader title="Import clients" subtitle="From Excel or CSV — any layout, numbers from any country." />
      <Stepper step={step} />

      {step === 0 && <UploadStep onFile={onFile} />}

      {step === 1 && sheet && (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[15px] font-semibold"><FileSpreadsheet className="size-4 text-brand" /> <span className="truncate">{book!.fileName}</span></div>
                <div className="mt-0.5 text-[13px] text-ink-3">{num(sheet.rows.length)} rows · {sheet.headers.length} columns</div>
              </div>
              {book!.sheets.length > 1 && (
                <select className="field w-auto" value={sheetIdx} onChange={(e) => pickSheet(Number(e.target.value))} aria-label="Sheet">
                  {book!.sheets.map((s, i) => <option key={s.name} value={i}>Sheet: {s.name} ({s.rows.length})</option>)}
                </select>
              )}
            </div>
            <div className="divide-y divide-line">
              {sheet.headers.map((h) => {
                const samples = sheet.rows.map((r) => r[h]).filter((v) => v != null && String(v).trim() !== "").slice(0, 3);
                const t = mapping[h];
                return (
                  <div key={h} className={clsx("grid items-center gap-3 px-5 py-3 sm:grid-cols-[1fr_1.1fr]", t === "ignore" && "opacity-60")}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {h}
                        {t === "phone" && <Badge tone="brand">Number</Badge>}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-ink-3">{samples.length ? samples.map(String).join("  ·  ") : "empty"}</div>
                    </div>
                    <select className="field" value={t} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as Target })} aria-label={`What is "${h}"?`}>
                      {TARGETS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="space-y-5 p-5">
              <div>
                <Label hint={hasCountryInfo ? "Used only when a row has none" : undefined}>Numbers without a country code are from</Label>
                <select className="field" value={country} onChange={(e) => setDefaultCountry(e.target.value)}>
                  {[...new Set([country, ...COUNTRY_OPTIONS])].map((c) => <option key={c} value={c}>{flag(c)} {countryName(c)}</option>)}
                </select>
                <p className="mt-1.5 text-[12px] text-ink-3">Numbers written with + or 00 are read as they are.</p>
              </div>
              <div>
                <Label hint="Optional">Tag everyone in this file</Label>
                <TagInput value={tags} onChange={setTags} suggestions={meta?.tags.map((t) => t.tag) ?? []} placeholder="e.g. Dubai Expo 2026" />
                <p className="mt-1.5 text-[12px] text-ink-3">Makes it easy to send a campaign to just this list.</p>
              </div>
              <div>
                <Label>If a number is already saved</Label>
                <Segmented
                  value={onDuplicate}
                  onChange={setOnDuplicate}
                  options={[{ value: "update", label: "Update details" }, { value: "skip", label: "Leave as is" }]}
                />
              </div>
            </Card>
            {!hasPhone && (
              <Callout tone="danger" icon={<AlertTriangle />} title="Which column has the phone number?">
                Set one column to "Phone / WhatsApp number" to continue.
              </Callout>
            )}
            <Callout tone="neutral" icon={<Info />}>
              Columns you keep as extra details can be used in messages — e.g. a "Budget" column becomes <code className="rounded bg-surface-3 px-1">{"{{Budget}}"}</code>.
            </Callout>
            <div className="flex gap-2">
              <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => { setBook(null); setStep(0); }}>Other file</Button>
              <Button variant="primary" className="flex-1" disabled={!hasPhone} loading={check.isPending} onClick={() => check.mutate()}>
                Check my list <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <ReviewStep
          preview={preview}
          busy={commit.isPending}
          onBack={() => setStep(1)}
          onImport={() => commit.mutate()}
        />
      )}

      {step === 3 && result && (
        <Card className="mx-auto max-w-xl p-8 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand-text">
            <CheckCircle2 className="size-8" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-medium">Import complete</h2>
          <p className="mt-2 text-sm text-ink-2">
            {num(result.summary.new)} new client{result.summary.new === 1 ? "" : "s"} added
            {result.summary.update > 0 && `, ${num(result.summary.update)} updated`}
            {result.summary.invalid + result.summary.duplicate > 0 && `, ${num(result.summary.invalid + result.summary.duplicate)} rows skipped`}.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Button icon={<Users className="size-4" />} onClick={() => navigate(tags.length ? `/clients?tag=${encodeURIComponent(tags[0])}` : "/clients")}>View clients</Button>
            <Button
              variant="primary"
              icon={<Megaphone className="size-4" />}
              onClick={() => navigate("/campaigns/new", { state: tags.length ? { tags } : undefined })}
            >
              {tags.length ? `Send a campaign to "${tags[0]}"` : "Create a campaign"}
            </Button>
          </div>
          <button className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink" onClick={() => { setBook(null); setPreview(null); setResult(null); setTags([]); setStep(0); }}>
            <RefreshCw className="size-3.5" /> Import another file
          </button>
        </Card>
      )}
    </>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2 overflow-x-auto text-[13px]">
      {STEPS.map((label, i) => (
        <li key={label} className="flex shrink-0 items-center gap-2">
          <span className={clsx("flex size-6 items-center justify-center rounded-full text-[12px] font-semibold", i < step ? "bg-brand text-white" : i === step ? "bg-ink text-bg" : "bg-surface-3 text-ink-3")}>
            {i < step ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={clsx("font-medium", i === step ? "text-ink" : "text-ink-3")}>{label}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-line-strong sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}

function UploadStep({ onFile }: { onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={clsx(
          "flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          over ? "border-brand bg-brand-soft" : "border-line-strong bg-surface hover:border-brand/60 hover:bg-surface-2/50",
        )}
      >
        <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
          <UploadCloud className="size-8" />
        </span>
        <span className="mt-5 text-lg font-semibold text-ink">Drop your Excel file here</span>
        <span className="mt-1 text-sm text-ink-2">or <span className="font-medium text-brand-text underline underline-offset-2">choose a file</span> · .xlsx, .xls or .csv</span>
        <input ref={input} type="file" hidden accept=".xlsx,.xlsm,.xls,.csv,.ods,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </button>
      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="text-[15px] font-semibold">Any layout works</h3>
          <ul className="mt-3 space-y-2.5 text-[13px] text-ink-2">
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" /> One row per client, first row as headings</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" /> Numbers like +971 50…, 00971…, 0501… with a Country column — all fine</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" /> Duplicates and wrong numbers are shown before anything is saved</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" /> Extra columns (Budget, Metal…) can be used in messages</li>
          </ul>
          <Button className="mt-5 w-full" icon={<Download className="size-4" />} onClick={downloadSample}>Download sample file</Button>
        </Card>
        <Callout tone="warn" icon={<AlertTriangle />} title="Numbers showing as 9.71E+11?">
          Excel has shortened them. Select the column → Format Cells → Text, retype or re-export, then upload.
        </Callout>
      </div>
    </div>
  );
}

type Tab = "all" | "new" | "update" | "problems";

function ReviewStep({ preview, busy, onBack, onImport }: { preview: Preview; busy: boolean; onBack: () => void; onImport: () => void }) {
  const s = preview.summary;
  const problems = s.invalid + s.duplicate;
  const [tab, setTab] = useState<Tab>(problems ? "problems" : "all");
  const rows = useMemo(
    () =>
      preview.rows.filter((r) =>
        tab === "all" ? true : tab === "problems" ? r.status === "invalid" || r.status === "duplicate" : tab === "update" ? r.status === "update" || r.status === "skip" : r.status === tab,
      ),
    [preview.rows, tab],
  );
  const willSave = s.new + s.update;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile icon={<Users />} label="New clients" value={s.new} tone="brand" />
        <SummaryTile icon={<RefreshCw />} label={s.skip ? "Already saved (left as is)" : "Already saved (updated)"} value={s.update + s.skip} tone="info" />
        <SummaryTile icon={<CopyX />} label="Repeated in file" value={s.duplicate} tone="neutral" />
        <SummaryTile icon={<Ban />} label="Can't use" value={s.invalid} tone={s.invalid ? "danger" : "neutral"} />
      </div>
      {s.warnings > 0 && (
        <Callout tone="warn" icon={<Info />}>{num(s.warnings)} numbers look unusual; they will be imported and checked on WhatsApp before any message is sent.</Callout>
      )}
      <Card className="overflow-hidden">
        <div className="scroll-thin overflow-x-auto border-b border-line px-4 py-3">
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "all", label: "All rows", count: preview.rows.length },
              { value: "new", label: "New", count: s.new },
              { value: "update", label: "Already saved", count: s.update + s.skip },
              { value: "problems", label: "Problems", count: problems },
            ]}
          />
        </div>
        <div className="scroll-thin max-h-[420px] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-3">Nothing here.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-surface text-[12px] text-ink-3">
                <tr className="border-b border-line">
                  <th className="py-2.5 pl-5 font-medium">Row</th>
                  <th className="py-2.5 pr-3 font-medium">Name</th>
                  <th className="py-2.5 pr-3 font-medium">Number</th>
                  <th className="py-2.5 pr-5 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((r) => (
                  <tr key={r.row} className="border-b border-line/60 last:border-0">
                    <td className="py-2 pl-5 text-ink-3">{r.row}</td>
                    <td className="max-w-[220px] truncate py-2 pr-3">
                      {r.name || <span className="text-ink-3">—</span>}
                      {r.company && <span className="text-ink-3"> · {r.company}</span>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-ink-2">{r.phone ? <>{flag(r.country)} {phone(r.phone)}</> : <span className="text-danger">{r.raw || "(empty)"}</span>}</td>
                    <td className="py-2 pr-5">
                      <RowResult r={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows.length > 300 && <p className="border-t border-line px-5 py-3 text-center text-[12px] text-ink-3">…and {num(rows.length - 300)} more rows</p>}
        </div>
      </Card>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={onBack}>Back to columns</Button>
        <div className="flex items-center gap-3">
          {problems > 0 && <span className="hidden text-[13px] text-ink-3 sm:inline">{num(problems)} rows with problems will be skipped</span>}
          <Button variant="primary" size="lg" disabled={!willSave} loading={busy} onClick={onImport}>
            {willSave ? `Import ${num(willSave)} client${willSave === 1 ? "" : "s"}` : "Nothing to import"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RowResult({ r }: { r: Row }) {
  const map = {
    new: <Badge tone="brand">New</Badge>,
    update: <Badge tone="info">Update</Badge>,
    skip: <Badge tone="neutral">Skip</Badge>,
    duplicate: <Badge tone="neutral">Repeated</Badge>,
    invalid: <Badge tone="danger">Can't use</Badge>,
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {map[r.status]}
      {r.message && <span className={clsx("text-[12px]", r.status === "invalid" ? "text-danger" : "text-ink-3")}>{r.message}</span>}
    </div>
  );
}

function SummaryTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "brand" | "info" | "neutral" | "danger" }) {
  return (
    <Card className="p-4">
      <span className={clsx("flex size-8 items-center justify-center rounded-lg [&>svg]:size-4", tone === "brand" && "bg-brand-soft text-brand-text", tone === "info" && "bg-info-soft text-info", tone === "neutral" && "bg-surface-2 text-ink-3", tone === "danger" && "bg-danger-soft text-danger")}>{icon}</span>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{num(value)}</div>
      <div className="mt-0.5 text-[12px] text-ink-3">{label}</div>
    </Card>
  );
}
