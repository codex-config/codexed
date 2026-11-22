import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { FormChoice, FormRow } from '@/components/form-row'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, api } from '@/lib/api'
import { notify } from '@/lib/notify'

const namePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/

type Props = {
  dir: string
  actions: Element | null
  onCreated: (name: string, dir: string) => void
  onCancel: () => void
}

export function NewSkillForm({ dir, actions, onCreated, onCancel }: Props) {
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  // In a project, a skill can go into the project or into your own skills.
  const [target, setTarget] = useState(dir)

  const create = useMutation({
    // An empty version means the file must not exist yet.
    mutationFn: () => api.saveFile({ dir: target, kind: 'skill', name }, template(name, description.trim()), ''),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['skills'] })
      onCreated(name, target)
    },
    onError: (error) =>
      notify.error(
        'Could not create the skill',
        error instanceof ApiError && error.status === 409 ? 'A skill with this name already exists.' : error.message,
      ),
  })

  const nameError = name !== '' && !namePattern.test(name)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold">New skill</h2>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg">
        <div className="divide-y rounded-3xl bg-card px-5 shadow-panel">
          <FormRow label="Name" hint={nameError ? 'Use lowercase letters, numbers and hyphens.' : `You run it as $${name || 'name'}.`}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="review-pull-request"
              maxLength={64}
              aria-invalid={nameError}
              autoFocus
              className="font-mono"
            />
          </FormRow>
          {dir && (
            <FormRow label="Scope">
              <FormChoice
                value={target === '' ? 'global' : 'project'}
                options={[
                  { value: 'project', label: 'This project: .agents/skills' },
                  { value: 'global', label: 'Your skills: ~/.agents/skills' },
                ]}
                onChange={(value) => setTarget(value === 'global' ? '' : dir)}
              />
            </FormRow>
          )}
          <FormRow label="Description" hint="Codex reads this to decide when to use the skill.">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What the skill does, and when Codex should use it."
            />
          </FormRow>
        </div>
      </div>
      {actions &&
        createPortal(
          <>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" disabled={!name || nameError || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </>,
          actions,
        )}
    </div>
  )
}

function template(name: string, description: string) {
  const title = name.charAt(0).toUpperCase() + name.slice(1).replaceAll('-', ' ')
  return `---
name: ${name}
description: ${yamlString(description)}
---

# ${title}

Write the instructions that Codex follows when it uses this skill.
`
}

// Plain YAML breaks on characters such as ": " and "#", so quote anything unusual.
function yamlString(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9 .,;()'/-]*$/.test(value) ? value : JSON.stringify(value)
}
