"use client";

import { CalendarCheck, CircleCheck, Mail, Send } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  BUDGET_OPTIONS,
  SERVICE_OPTIONS,
  STUDIO,
  TEAM_SIZE_OPTIONS,
  TIMELINE_OPTIONS,
} from "@/config/site";
import { initialActionState, type ActionState } from "@/lib/validation/action-state";
import { submitDemoRequestAction, submitServiceInquiryAction } from "../actions";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Off-screen honeypot field; bots fill it, people never see it. */
function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

function Success({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div role="status" className="py-6 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <CircleCheck aria-hidden className="size-7" />
      </span>
      <p className="mt-4 text-base font-semibold text-foreground">Request sent</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{message}</p>
      <Button variant="secondary" className="mt-6" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

function useInquiryForm(action: FormAction) {
  return useActionState(action, initialActionState);
}

function ServiceInquiryForm({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useInquiryForm(submitServiceInquiryAction);
  if (state.ok && state.message) return <Success message={state.message} onClose={onClose} />;
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <form action={formAction} className="relative space-y-4" noValidate>
      <FormMessage ok={false} message={state.message} />
      <Honeypot />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="inq-name" label="Your name" errors={e.name}>
          <Input name="name" autoComplete="name" defaultValue={v.name} required />
        </FormField>
        <FormField id="inq-email" label="Email" errors={e.email}>
          <Input name="email" type="email" autoComplete="email" defaultValue={v.email} required />
        </FormField>
        <FormField id="inq-company" label="Company (optional)" errors={e.company}>
          <Input name="company" autoComplete="organization" defaultValue={v.company} />
        </FormField>
        <FormField id="inq-phone" label="Phone / WhatsApp (optional)" errors={e.phone}>
          <Input name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} />
        </FormField>
      </div>
      <FormField id="inq-service" label="What do you need?" errors={e.service}>
        <Select name="service" defaultValue={v.service ?? ""} required>
          <option value="" disabled>
            Select a service
          </option>
          {SERVICE_OPTIONS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="inq-budget" label="Budget (optional)" errors={e.budget}>
          <Select name="budget" defaultValue={v.budget ?? ""}>
            <option value="">Select budget</option>
            {BUDGET_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </FormField>
        <FormField id="inq-timeline" label="Timeline (optional)" errors={e.timeline}>
          <Select name="timeline" defaultValue={v.timeline ?? ""}>
            <option value="">Select timeline</option>
            {TIMELINE_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField
        id="inq-message"
        label="Project details"
        hint="Goals, features, references, deadlines…"
        errors={e.message}
      >
        <Textarea name="message" rows={5} defaultValue={v.message} required maxLength={5000} />
      </FormField>
      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <a
          href={`mailto:${STUDIO.email}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
        >
          <Mail aria-hidden className="size-3.5" /> or email {STUDIO.email}
        </a>
        <Button type="submit" disabled={pending}>
          <Send aria-hidden className="size-4" />
          {pending ? "Sending…" : "Send request"}
        </Button>
      </div>
    </form>
  );
}

function DemoRequestForm({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useInquiryForm(submitDemoRequestAction);
  if (state.ok && state.message) return <Success message={state.message} onClose={onClose} />;
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <form action={formAction} className="relative space-y-4" noValidate>
      <FormMessage ok={false} message={state.message} />
      <Honeypot />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="demo-name" label="Your name" errors={e.name}>
          <Input name="name" autoComplete="name" defaultValue={v.name} required />
        </FormField>
        <FormField id="demo-email" label="Work email" errors={e.email}>
          <Input name="email" type="email" autoComplete="email" defaultValue={v.email} required />
        </FormField>
        <FormField id="demo-company" label="Company" errors={e.company}>
          <Input name="company" autoComplete="organization" defaultValue={v.company} required />
        </FormField>
        <FormField id="demo-team" label="Team size (optional)" errors={e.teamSize}>
          <Select name="teamSize" defaultValue={v.teamSize ?? ""}>
            <option value="">Select size</option>
            {TEAM_SIZE_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField id="demo-phone" label="Phone (optional)" errors={e.phone}>
        <Input name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} />
      </FormField>
      <FormField
        id="demo-message"
        label="What would you like to see? (optional)"
        errors={e.message}
      >
        <Textarea name="message" rows={3} defaultValue={v.message} maxLength={2000} />
      </FormField>
      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={pending}>
          <CalendarCheck aria-hidden className="size-4" />
          {pending ? "Sending…" : "Request demo"}
        </Button>
      </div>
    </form>
  );
}

interface TriggerProps {
  className?: string;
  children: ReactNode;
}

export function ServiceInquiryTrigger({ className, children }: TriggerProps) {
  const [open, setOpen] = useState(false);
  // Remount the form each time the dialog opens so a previous submission is cleared.
  const [session, setSession] = useState(0);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setSession((s) => s + 1);
          setOpen(true);
        }}
      >
        {children}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Work with ${STUDIO.name}`}
        description={`${STUDIO.descriptor} · development & design. Tell us about your project and we'll get back to you.`}
      >
        <ServiceInquiryForm key={session} onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function BookDemoTrigger({ className, children }: TriggerProps) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setSession((s) => s + 1);
          setOpen(true);
        }}
      >
        {children}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Book an AgentOS demo"
        description="See your AI workforce in one control center. We'll reach out to schedule a 30-minute walkthrough."
      >
        <DemoRequestForm key={session} onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}
