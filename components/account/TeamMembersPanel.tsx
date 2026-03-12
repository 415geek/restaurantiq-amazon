'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import type { TeamMember } from '@/lib/types';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

const schema = z.object({ name: z.string().min(2), email: z.string().email(), role: z.enum(['Owner', 'Manager', 'Staff']) });

type InviteForm = z.infer<typeof schema>;

export function TeamMembersPanel({ members, onInvite }: { members: TeamMember[]; onInvite: (payload: InviteForm) => void }) {
  const { copy } = useDashboardLanguage();
  const [open, setOpen] = useState(false);
  const form = useForm<InviteForm>({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', role: 'Staff' } });
  const roleLabels = copy.account.roleLabels;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{copy.account.teamMembers}</CardTitle>
            <p className="mt-1 text-sm text-zinc-400">{copy.account.teamDesc}</p>
          </div>
          <Button variant="secondary" onClick={() => setOpen(true)}>{copy.account.inviteMember}</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-100">{member.name}</p>
                <p className="text-xs text-zinc-400">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{roleLabels[member.role]}</Badge>
                <Badge className={member.status === 'active' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'}>{copy.account.memberStatus[member.status]}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Modal open={open} onOpenChange={setOpen} title={copy.account.inviteTitle}>
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => { onInvite(values); setOpen(false); form.reset({ name: '', email: '', role: 'Staff' }); })}>
          <Field label={copy.forms.inviteName} error={form.formState.errors.name?.message}><Input {...form.register('name')} /></Field>
          <Field label={copy.forms.inviteEmail} error={form.formState.errors.email?.message}><Input type="email" {...form.register('email')} /></Field>
          <Field label={copy.forms.inviteRole} error={form.formState.errors.role?.message}>
            <select {...form.register('role')} className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100">
              <option value="Owner">{roleLabels.Owner}</option>
              <option value="Manager">{roleLabels.Manager}</option>
              <option value="Staff">{roleLabels.Staff}</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{copy.common.cancel}</Button>
            <Button type="submit">{copy.account.sendInvite}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return <label className="block"><span className="mb-1.5 block text-sm text-zinc-300">{label}</span>{children}{error ? <span className="mt-1 block text-xs text-red-400">{error}</span> : null}</label>;
}
