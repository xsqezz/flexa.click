import type { ReactNode } from 'react'

type Option<T extends string> = { value: T; title: string; description?: string }

export function ChoiceList<T extends string>({ name, value, options, onChange, labelledBy }:
  { name: string; value: T | null; options: Option<T>[]; onChange: (value: T) => void; labelledBy: string }) {
  return <div className="choice-list" role="radiogroup" aria-labelledby={labelledBy}>
    {options.map((option) => <label className="choice" key={option.value}>
      <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span className="choice-text"><strong>{option.title}</strong>{option.description && <small>{option.description}</small>}</span>
    </label>)}
  </div>
}

export function CheckList<T extends string>({ values, options, onChange, labelledBy }:
  { values: T[]; options: Option<T>[]; onChange: (values: T[]) => void; labelledBy: string }) {
  return <fieldset className="choice-list" aria-labelledby={labelledBy}>
    {options.map((option) => <label className="choice" key={option.value}>
      <input type="checkbox" checked={values.includes(option.value)}
        onChange={(event) => onChange(event.target.checked ? [...values, option.value] : values.filter((item) => item !== option.value))} />
      <span className="choice-text"><strong>{option.title}</strong>{option.description && <small>{option.description}</small>}</span>
    </label>)}
  </fieldset>
}

export function ChipChoice<T extends string | number>({ name, value, options, onChange, labelledBy }:
  { name: string; value: T | null; options: { value: T; label: string }[]; onChange: (value: T) => void; labelledBy: string }) {
  return <div className="chip-choice" role="radiogroup" aria-labelledby={labelledBy}>
    {options.map((option) => <label className="chip" key={String(option.value)}>
      <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span>{option.label}</span>
    </label>)}
  </div>
}

export function WizardQuestion({ id, title, hint, children }: { id: string; title: string; hint?: ReactNode; children: ReactNode }) {
  return <section className="wizard-question">
    <h2 id={id}>{title}</h2>
    {hint && <p className="wizard-hint">{hint}</p>}
    {children}
  </section>
}
