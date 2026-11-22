import { toast } from '@/components/ui/toast'

export const notify = {
  error: (title: string, description?: string) =>
    toast.add({ title, description, type: 'error', timeout: 8000 }),

  // onUndo adds an Undo button, which also closes the toast.
  done: (title: string, description?: string, onUndo?: () => void) => {
    const id: string = toast.add({
      title,
      description,
      type: 'success',
      timeout: 6000,
      actionProps: onUndo && {
        children: 'Undo',
        onClick: () => {
          toast.close(id)
          onUndo()
        },
      },
    })
    return id
  },
}
