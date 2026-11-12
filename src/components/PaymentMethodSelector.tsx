import { Check } from "lucide-react";

type PaymentMethod = "emola" | "mpesa";

export function PaymentMethodSelector({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  const options: { id: PaymentMethod; name: string; operator: string; mark: string; tone: string; markTone: string }[] = [
    { id: "emola", name: "e-Mola", operator: "Movitel", mark: "e", tone: "border-orange-300 bg-orange-50 text-orange-950", markTone: "bg-orange-500 text-white" },
    { id: "mpesa", name: "M-Pesa", operator: "Vodacom", mark: "M", tone: "border-red-300 bg-red-50 text-red-950", markTone: "bg-red-600 text-white" },
  ];

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Escolhe o método de pagamento</legend>
      <div className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={`relative flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 ${active ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/15" : "border-border bg-card hover:border-primary/50 hover:bg-muted/40"}`}
            >
              {active && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span>}
              <span className={`grid h-11 w-11 place-items-center rounded-xl text-2xl font-black shadow-sm ${option.markTone}`} aria-hidden="true">{option.mark}</span>
              <span className="leading-tight">
                <span className="block text-sm font-extrabold">{option.name}</span>
                <span className="mt-0.5 block text-xs opacity-70">{option.operator}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
