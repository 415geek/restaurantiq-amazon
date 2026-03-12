'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { SettingsState } from '@/lib/types';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

const schema = z.object({
  name: z.string().min(2),
  cuisine: z.string().min(1),
  address: z.string().min(4),
  city: z.string().min(2),
  zip: z.string().min(3),
  capacity: z.number().min(1).max(1000),
  priceBand: z.enum(['$', '$$', '$$$']),
  hours: z.string().min(2),
});

type FormValues = z.infer<typeof schema>;

export function RestaurantProfileForm({ value, onSave }: { value: SettingsState['restaurantProfile']; onSave: (next: SettingsState['restaurantProfile']) => void; }) {
  const { copy, lang } = useDashboardLanguage();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: value });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{copy.settings.restaurantProfile}</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit((data) => onSave(data))}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={copy.settings.fields.restaurantName} error={form.formState.errors.name?.message}><Input {...form.register('name')} /></Field>
            <Field label={copy.settings.fields.cuisine} error={form.formState.errors.cuisine?.message}><Input {...form.register('cuisine')} placeholder={lang === 'zh' ? '粤菜 / 火锅 / 茶餐厅' : 'Cantonese / Hotpot / Cafe'} /></Field>
            <Field label={copy.settings.fields.address} error={form.formState.errors.address?.message}><Input {...form.register('address')} /></Field>
            <Field label={copy.settings.fields.city} error={form.formState.errors.city?.message}><Input {...form.register('city')} /></Field>
            <Field label={copy.settings.fields.zip} error={form.formState.errors.zip?.message}><Input {...form.register('zip')} /></Field>
            <Field label={copy.settings.fields.capacity} error={form.formState.errors.capacity?.message}><Input type="number" {...form.register('capacity', { valueAsNumber: true })} /></Field>
            <Field label={copy.settings.fields.priceBand} error={form.formState.errors.priceBand?.message}>
              <Select {...form.register('priceBand')}>
                <option value="$">$</option>
                <option value="$$">$$</option>
                <option value="$$$">$$$</option>
              </Select>
            </Field>
            <Field label={copy.settings.fields.hours} className="md:col-span-2" error={form.formState.errors.hours?.message}><Input {...form.register('hours')} /></Field>
          </div>
          <div className="flex justify-end"><Button type="submit">{copy.settings.saveProfile}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, error, className }: { label: string; children: React.ReactNode; error?: string; className?: string; }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm text-zinc-300">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-400">{error}</span> : null}
    </label>
  );
}
