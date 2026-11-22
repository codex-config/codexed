import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, queries } from '@/lib/api'
import { navigate } from '@/lib/location'

export function AddFolderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const client = useQueryClient()
  const health = useQuery(queries.health())
  const [path, setPath] = useState('')

  const add = useMutation({
    mutationFn: api.addProject,
    onSuccess: (project) => {
      client.invalidateQueries({ queryKey: queries.projects().queryKey })
      onOpenChange(false)
      setPath('')
      navigate({ dir: project.path })
    },
  })

  const pick = useMutation({
    mutationFn: api.pickFolder,
    onSuccess: ({ path: picked }) => {
      if (!picked) return
      setPath(picked)
      add.reset()
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    add.mutate(path.trim())
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        add.reset()
        pick.reset()
      }}
    >
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add project</DialogTitle>
            <DialogDescription>
              Add a folder to manage its Codex settings, even if you have not used Codex in it
              yet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="folder-path">Absolute path</Label>
            <Input
              id="folder-path"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder={`${health.data?.home ?? ''}/code/my-app`}
              aria-invalid={add.isError}
              autoFocus
            />
            {add.isError && <p className="text-sm text-destructive">{add.error.message}</p>}
            {pick.isError && <p className="text-sm text-destructive">{pick.error.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pick.isPending} onClick={() => pick.mutate()}>
              {pick.isPending ? 'Choosing…' : 'Select folder'}
            </Button>
            <Button type="submit" disabled={!path.trim() || add.isPending}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
