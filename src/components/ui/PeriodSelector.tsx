import { cn, PERIOD_PRESETS, PERIOD_PRESET_LABELS, type PeriodPreset } from '@/lib/utils'

interface PeriodSelectorProps {
  value: PeriodPreset
  onChange: (preset: PeriodPreset) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (v: string) => void
  onCustomToChange: (v: string) => void
  label?: string
}

export function PeriodSelector({
  value, onChange, customFrom, customTo, onCustomFromChange, onCustomToChange, label = 'Period:',
}: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {label && <span className="text-xs text-slate-500 mr-1">{label}</span>}
      {PERIOD_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange(preset)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
            value === preset
              ? 'bg-brand-teal text-white'
              : 'text-slate-400 hover:text-slate-200 bg-brand-surface border border-brand-border',
          )}
        >
          {PERIOD_PRESET_LABELS[preset]}
        </button>
      ))}
      {value === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="rounded-lg bg-brand-surface border border-brand-border text-slate-400 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
          <span className="text-xs text-slate-500">→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="rounded-lg bg-brand-surface border border-brand-border text-slate-400 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </div>
      )}
    </div>
  )
}
