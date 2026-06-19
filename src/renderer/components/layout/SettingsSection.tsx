import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SettingsSectionProps {
  icon: ReactNode
  title: string
  description: ReactNode
  children: ReactNode
  className?: string
}

export function SettingsSection({
  icon,
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <Card className={cn('overflow-visible', className)}>
      <CardHeader className="border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription className="pl-[2.625rem]">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-5">{children}</CardContent>
    </Card>
  )
}
