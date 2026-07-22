import { useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export type PersonalDataInitial = {
  first_name?: string | null;
  second_name?: string | null;
  last_name?: string | null;
  second_last_name?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  document_type?: string | null;
  document_number?: string | null;
  document_issue_date?: string | null;
  terms_accepted_at?: string | null;
};

const schema = z.object({
  first_name: z.string().trim().min(1, "Requerido").max(60),
  second_name: z.string().trim().max(60).optional().or(z.literal("")),
  last_name: z.string().trim().min(1, "Requerido").max(60),
  second_last_name: z.string().trim().max(60).optional().or(z.literal("")),
  gender: z.enum(["masculino", "femenino", "otro"], {
    errorMap: () => ({ message: "Selecciona tu género" }),
  }),
  birth_date: z.string().min(1, "Requerido"),
  phone: z
    .string()
    .trim()
    .min(7, "Teléfono inválido")
    .max(20)
    .regex(/^[0-9+\-\s]+$/, "Solo números"),
  document_type: z.enum(["CC", "CE", "PA"], {
    errorMap: () => ({ message: "Selecciona el tipo" }),
  }),
  document_number: z
    .string()
    .trim()
    .min(4, "Inválido")
    .max(20)
    .regex(/^[a-zA-Z0-9]+$/, "Sin espacios ni símbolos"),
  document_issue_date: z.string().min(1, "Requerido"),
  terms: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar los términos" }),
  }),
});

function ageFromBirth(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function PersonalDataForm({
  userId,
  initial,
  onSaved,
  submitLabel = "Guardar",
}: {
  userId: string;
  initial?: PersonalDataInitial;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const [firstName, setFirstName] = useState(initial?.first_name ?? "");
  const [secondName, setSecondName] = useState(initial?.second_name ?? "");
  const [lastName, setLastName] = useState(initial?.last_name ?? "");
  const [secondLastName, setSecondLastName] = useState(initial?.second_last_name ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [docType, setDocType] = useState(initial?.document_type ?? "CC");
  const [docNumber, setDocNumber] = useState(initial?.document_number ?? "");
  const [docIssueDate, setDocIssueDate] = useState(initial?.document_issue_date ?? "");
  const [terms, setTerms] = useState(!!initial?.terms_accepted_at);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({
      first_name: firstName,
      second_name: secondName,
      last_name: lastName,
      second_last_name: secondLastName,
      gender,
      birth_date: birthDate,
      phone,
      document_type: docType,
      document_number: docNumber,
      document_issue_date: docIssueDate,
      terms,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (ageFromBirth(birthDate) < 18) {
      setError("Debes ser mayor de 18 años para registrarte.");
      return;
    }
    if (new Date(docIssueDate) > new Date()) {
      setError("La fecha de expedición no puede ser futura.");
      return;
    }

    setLoading(true);
    const acceptedAt = initial?.terms_accepted_at ?? new Date().toISOString();
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        second_name: secondName.trim() || null,
        last_name: lastName.trim(),
        second_last_name: secondLastName.trim() || null,
        gender: gender as "masculino" | "femenino" | "otro",
        birth_date: birthDate,
        phone: phone.trim(),
        document_type: docType,
        document_number: docNumber.trim(),
        document_issue_date: docIssueDate,
        terms_accepted_at: acceptedAt,
        profile_completed: true,
      })
      .eq("id", userId);
    setLoading(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    onSaved?.();
  }

  return (
    <form onSubmit={onSubmit} className="personal-data-form space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Primer nombre *">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </Field>
        <Field label="Segundo nombre">
          <Input value={secondName} onChange={(e) => setSecondName(e.target.value)} />
        </Field>
        <Field label="Primer apellido *">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </Field>
        <Field label="Segundo apellido">
          <Input value={secondLastName} onChange={(e) => setSecondLastName(e.target.value)} />
        </Field>
      </div>

      <Field label="Género *">
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger className="personal-data-select-trigger">
            <SelectValue placeholder="Selecciona" />
          </SelectTrigger>
          <SelectContent className="personal-data-select-content z-[200]">
            <SelectItem value="masculino">Masculino</SelectItem>
            <SelectItem value="femenino">Femenino</SelectItem>
            <SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Fecha de nacimiento *">
        <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
      </Field>

      <Field label="Número de teléfono *">
        <Input
          type="tel"
          placeholder="+57 300 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <p className="mt-1 text-[10px] text-purple-200/60">
          Se agregará sin verificar.
        </p>
      </Field>

      <div className="grid grid-cols-[110px_1fr] gap-2">
        <Field label="Tipo doc. *">
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="personal-data-select-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="personal-data-select-content z-[200]">
              <SelectItem value="CC">Cédula</SelectItem>
              <SelectItem value="CE">C. Extranjería</SelectItem>
              <SelectItem value="PA">Pasaporte</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Número documento *">
          <Input
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
            inputMode="numeric"
            required
          />
        </Field>
      </div>

      <Field label="Fecha de expedición *">
        <Input
          type="date"
          value={docIssueDate}
          onChange={(e) => setDocIssueDate(e.target.value)}
          required
        />
      </Field>

      <label className="flex items-start gap-2 pt-0.5 text-xs text-purple-100">
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-purple-500"
        />
        <span>
          Acepto los{" "}
          <a
            href="/terminos"
            target="_blank"
            rel="noreferrer"
            className="text-fuchsia-300 underline hover:text-fuchsia-200"
          >
            términos y condiciones
          </a>{" "}
          y el tratamiento de datos personales.
        </span>
      </label>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <Button
        type="submit"
        disabled={loading}
        className="personal-data-submit w-full bg-purple-600 hover:bg-purple-500"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-purple-200/80">{label}</Label>
      {children}
    </div>
  );
}