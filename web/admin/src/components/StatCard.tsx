import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color?: 'green' | 'blue' | 'yellow' | 'red' | 'purple'
}

const colors = {
  green:  'bg-green-50 text-green-600',
  blue:   'bg-blue-50 text-blue-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  red:    'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
}

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'green' }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={clsx('p-3 rounded-xl', colors[color])}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}
