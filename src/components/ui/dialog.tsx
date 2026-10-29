import * as React from 'react'
import { Dialog as P } from 'radix-ui'
import { XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const Dialog = P.Root
const DialogTrigger = P.Trigger
const DialogClose = P.Close

/**
 * Task dialogs open as a side panel from the right (DESIGN.md «Side panels
 * instead of modals»): the page stays visible for reference, and the panel
 * has room for a sticky footer. `variant="center"` keeps a small centred
 * dialog for short confirmations.
 */
function DialogContent({
  className,
  children,
  variant = 'panel',
  ...props
}: React.ComponentProps<typeof P.Content> & { variant?: 'panel' | 'center' }) {
  const { t } = useTranslation()
  return (
    <P.Portal>
      <P.Overlay className="fixed inset-0 z-50 bg-scrim/40 duration-(--duration-moderate-02) data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <P.Content
        data-slot="dialog-content"
        className={cn(
          variant === 'panel'
            ? 'fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col gap-4 overflow-y-auto border-l [&>form]:flex [&>form]:flex-1 [&>form]:flex-col [&>form]:gap-4 bg-background p-6 shadow-pop duration-(--duration-moderate-02) ease-(--ease-expressive-entrance) data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
            : 'fixed top-[50%] left-[50%] z-50 grid max-h-[90vh] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-pop duration-(--duration-moderate-01) data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          className,
        )}
        {...props}
      >
        {children}
        <P.Close className="absolute top-5 right-5 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <XIcon className="size-4" />
          <span className="sr-only">{t('common.close')}</span>
        </P.Close>
      </P.Content>
    </P.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 pr-8', className)} {...props} />
}
/** In a side panel the footer sticks to the bottom edge, so the outcome button is always in reach. */
function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'sticky bottom-0 -mx-6 -mb-6 mt-auto flex flex-col-reverse gap-2 border-t bg-background px-6 py-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof P.Title>) {
  return <P.Title className={cn('text-title font-semibold', className)} {...props} />
}
function DialogDescription({ className, ...props }: React.ComponentProps<typeof P.Description>) {
  return <P.Description className={cn('text-body text-muted-foreground', className)} {...props} />
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
