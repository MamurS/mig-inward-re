import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/** tailwind-merge that knows the design system's type scale (DESIGN.md «Type»):
 * without it `text-headline` reads as a colour and is dropped next to `text-foreground`. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'small', 'table', 'body', 'lead', 'title', 'headline', 'display'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
