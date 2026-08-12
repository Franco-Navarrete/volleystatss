import { Link } from '@tanstack/react-router'
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Target, 
  PieChart, 
  Calendar, 
  Wallet, 
  PiggyBank,
  Settings,
  Repeat
} from 'lucide-react'
import { cn } from "@/lib/utils"

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Ingresos', href: '/finances/income', icon: ArrowUpCircle },
  { name: 'Gastos', href: '/finances/expenses', icon: ArrowDownCircle },
  { name: 'Presupuesto', href: '/finances/budget', icon: PieChart },
  { name: 'Quincenas', href: '/finances/fortnight', icon: Repeat },
  { name: 'Fondos', href: '/finances/funds', icon: PiggyBank },
  { name: 'Objetivos', href: '/finances/goals', icon: Target },
  { name: 'Estadísticas', href: '/finances/stats', icon: PieChart },
  { name: 'Calendario', href: '/finances/calendar', icon: Calendar },
  { name: 'Cuentas', href: '/finances/accounts', icon: Wallet },
  { name: 'Configuración', href: '/settings', icon: Settings },
]

export function Sidebar({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col w-64 border-r bg-card", className)}>
      <div className="p-6">
        <h1 className="text-2xl font-black tracking-tighter text-primary">RALLY FINANZAS</h1>
      </div>
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground group"
            activeProps={{ className: "bg-accent text-accent-foreground" }}
          >
            <item.icon className="mr-3 size-5 text-muted-foreground group-hover:text-accent-foreground" />
            {item.name}
          </Link>
        ))}
      </nav>
    </div>
  )
}
