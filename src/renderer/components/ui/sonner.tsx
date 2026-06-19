import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      richColors
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'font-sans',
        },
      }}
    />
  )
}
