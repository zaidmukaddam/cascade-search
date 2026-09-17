import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface GlassOption<Value extends string> {
  value: Value
  label: string
}

interface GlassSelectProps<Value extends string> {
  label: string
  value: Value
  options: readonly GlassOption<Value>[]
  onChange: (value: Value) => void
  variant?: 'outlined' | 'quiet'
  className?: string
}

const TRIGGER = {
  outlined: 'border-ray-line px-2.5',
  quiet: 'border-transparent px-1.5 text-ray-dim',
}

export function GlassSelect<Value extends string>({
  label,
  value,
  options,
  onChange,
  variant = 'outlined',
  className,
}: GlassSelectProps<Value>) {
  return (
    <Select
      items={options.map(option => ({ value: option.value, label: option.label }))}
      value={value}
      onValueChange={next => onChange(next as Value)}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          'h-8 shrink-0 gap-2 rounded-lg bg-transparent text-[13px] text-ray-text shadow-none hover:bg-ray-selected dark:bg-transparent dark:hover:bg-ray-selected',
          TRIGGER[variant],
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        align="end"
        sideOffset={8}
        alignItemWithTrigger={false}
        className="w-auto min-w-44 rounded-xl border border-ray-edge bg-ray-window p-1.5 text-ray-text shadow-ray-window ring-0 backdrop-blur-[40px] backdrop-saturate-150"
      >
        {options.map(option => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="h-9 rounded-lg pl-2.5 text-[13px] text-ray-text focus:bg-ray-selected focus:text-ray-text"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
