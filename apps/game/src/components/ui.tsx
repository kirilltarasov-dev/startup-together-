import { motion, type HTMLMotionProps } from 'framer-motion'
import type { Choice } from '../state/types'

const KIND: Record<NonNullable<Choice['kind']>, string> = {
  normal: 'border-line hover:border-white/50 bg-panel',
  devin: 'border-devin bg-devin/15 hover:bg-devin/30 shadow-[0_0_40px_-10px_var(--color-devin)]',
  danger: 'border-blood/50 hover:border-blood bg-blood/5',
  money: 'border-gold/50 hover:border-gold bg-gold/5',
}

export function ChoiceButton({ choice, index, onClick, disabled }: { choice: Choice; index: number; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.07 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      disabled={disabled}
      onClick={onClick}
      className={`text-left rounded-lg border px-4 py-3 transition-colors disabled:opacity-40 ${KIND[choice.kind ?? 'normal']}`}
    >
      <div className="flex items-center gap-3">
        <span className="mono text-xs opacity-40">{index + 1}</span>
        <span className={`font-bold ${choice.kind === 'devin' ? 'text-devin' : ''}`}>{choice.label}</span>
      </div>
      {choice.hint && <div className="text-xs opacity-60 mt-0.5 ml-6">{choice.hint}</div>}
    </motion.button>
  )
}

export function BigButton({ children, className = '', ...rest }: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      className={`px-10 py-4 rounded-full bg-white text-ink font-bold tracking-widest text-lg ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-2xl border border-line bg-panel/90 backdrop-blur p-6 ${className}`}
    >
      {children}
    </motion.div>
  )
}
