import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Labelled numeric input used across the questionnaire and the evolution panel.
 * Empty resolves to 0; sub-`min` and non-finite entries are clamped. Presentational
 * leaf — it never touches domain logic, only emits a number.
 */
export type NumberFieldProps = {
  /** Input id (also the label's `htmlFor`). */
  id: string;
  /** Visible field label. */
  label: string;
  /** Current value in the field's unit. */
  value: number;
  /** Called with the parsed, clamped value. */
  onChange: (next: number) => void;
  /** Optional unit shown inside the field (e.g. `€`, `%`). */
  suffix?: string;
  /** Optional helper text below the field. */
  hint?: string;
  /** Minimum allowed value (default 0). */
  min?: number;
  /** Step for the spinner (default 1). */
  step?: number;
  /** Placeholder shown when the value is 0 (default `0`). */
  placeholder?: string;
};

const NumberField = ({ id, label, value, onChange, suffix, hint, min = 0, step = 1, placeholder = '0' }: NumberFieldProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw === '') {
      onChange(0);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.max(min, parsed));
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          placeholder={placeholder}
          value={value === 0 ? '' : value}
          onChange={handleChange}
          className={suffix ? 'pr-10' : undefined}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
};

export default NumberField;
