import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface FinancialKpiCardProps {
  title: string
  value: string
  icon: LucideIcon
  description?: string
  trend?: {
    value: string
    positive: boolean
  }
  className?: string
  iconClassName?: string
}

export function FinancialKpiCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  iconClassName
}: FinancialKpiCardProps) {
  return (
    <Card className={cn("overflow-hidden border-none shadow-elevated", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className={cn("p-2 rounded-xl bg-primary/10", iconClassName)}>
          <Icon className="size-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-black tracking-tighter">{value}</div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>
        )}
        {trend && (
          <div className={cn(
            "mt-2 text-xs font-bold inline-flex items-center px-2 py-0.5 rounded-full",
            trend.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {trend.positive ? "+" : ""}{trend.value} respecto al mes pasado
          </div>
        )}
      </CardContent>
    </Card>
  )
}
