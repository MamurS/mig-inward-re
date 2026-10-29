import * as React from 'react'
import { Tooltip as P } from 'radix-ui'
import { cn } from '@/lib/utils'

const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <P.Provider delayDuration={300} skipDelayDuration={100}>{children}</P.Provider>
)

/** A short hint on hover and keyboard focus. */
function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactElement; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <P.Root>
      <P.Trigger asChild>{children}</P.Trigger>
      <P.Portal>
        <P.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 max-w-80 rounded-md bg-slate-900 px-2 py-1 text-caption text-white shadow-pop',
            'duration-(--duration-fast-02) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0',
          )}
        >
          {content}
        </P.Content>
      </P.Portal>
    </P.Root>
  )
}

export { Tooltip, TooltipProvider }
