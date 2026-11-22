import { toast } from '@/components/ui/toast'

export const notify = {
  error: (title: string, description?: string) =>
    toast.add({ title, description, type: 'error', timeout: 8000 }),
}
