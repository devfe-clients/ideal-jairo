import { useCallback, useState, type ReactNode } from "react";
import type { z } from "zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type Erros = Record<string, string>;

/** Formulário validado com Zod — mesma validação usada no servidor. */
export function useFormularioZod<S extends z.ZodTypeAny>(schema: S, inicial: Record<string, unknown>) {
  const [valores, setValores] = useState<Record<string, unknown>>(inicial);
  const [erros, setErros] = useState<Erros>({});

  const set = useCallback((campo: string, valor: unknown) => {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErros((e) => {
      if (!e[campo]) return e;
      const { [campo]: _ignorado, ...resto } = e;
      return resto;
    });
  }, []);

  const reset = useCallback((novo: Record<string, unknown>) => {
    setValores(novo);
    setErros({});
  }, []);

  const validar = useCallback((): z.infer<S> | null => {
    const r = schema.safeParse(valores);
    if (r.success) {
      setErros({});
      return r.data;
    }
    const novos: Erros = {};
    for (const issue of r.error.issues) {
      const chave = String(issue.path[0] ?? "form");
      if (!novos[chave]) novos[chave] = issue.message;
    }
    setErros(novos);
    return null;
  }, [schema, valores]);

  return { valores, erros, set, reset, validar, setErros };
}

export function Campo({
  label,
  erro,
  children,
  className,
  dica,
}: {
  label: string;
  erro?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  dica?: string | undefined;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {dica && !erro ? <p className="text-[11px] text-muted-foreground">{dica}</p> : null}
      {erro ? <p className="text-[11px] font-medium text-destructive">{erro}</p> : null}
    </div>
  );
}

export function CampoTexto({
  label,
  valor,
  onChange,
  erro,
  placeholder,
  type = "text",
  className,
  dica,
  disabled,
}: {
  label: string;
  valor: string | number;
  onChange: (v: string) => void;
  erro?: string | undefined;
  placeholder?: string | undefined;
  type?: string;
  className?: string | undefined;
  dica?: string | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <Campo label={label} erro={erro} className={className} dica={dica}>
      <Input
        type={type}
        value={valor as string}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(erro)}
      />
    </Campo>
  );
}

export function CampoArea({
  label,
  valor,
  onChange,
  erro,
  placeholder,
  rows = 3,
  className,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  erro?: string | undefined;
  placeholder?: string | undefined;
  rows?: number;
  className?: string | undefined;
}) {
  return (
    <Campo label={label} erro={erro} className={className}>
      <Textarea
        rows={rows}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(erro)}
        className="resize-none"
      />
    </Campo>
  );
}

export function Vazio({ mensagem }: { mensagem: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {mensagem}
    </div>
  );
}
