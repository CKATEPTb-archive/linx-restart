import type { Accessor } from 'solid-js';
import type { ConnectionState } from '../app/types';
import { StatusPill } from './StatusPill';

interface AppHeaderProps {
  connection: Accessor<ConnectionState>;
  logOpen: Accessor<boolean>;
  onStatusClick: () => void;
  stepNumber: Accessor<number>;
  totalSteps: number;
}

export function AppHeader(props: AppHeaderProps) {
  return (
    <header class="grid min-h-0 gap-2 rounded-2xl border border-white/[0.055] bg-app-panel/82 px-3 py-2 shadow-[0_12px_34px_rgba(0,0,0,0.18)]" aria-label="Перезапуск CGM от MicroTech Medical">
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div class="grid min-w-0 gap-1">
          <span class="inline-flex min-w-0 items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[9px] font-extrabold uppercase leading-none tracking-[0.13em] text-app-muted">
            <span class="size-1.5 shrink-0 rounded-full bg-app-accent shadow-[0_0_12px_rgba(88,216,196,0.55)]" />
            MicroTech Medical
          </span>
          <strong class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[18px] font-black leading-none tracking-normal text-app-ink max-[340px]:text-[16px]">
            Перезапуск CGM
          </strong>
        </div>
        <div class="grid justify-items-end gap-1">
          <span class="shrink-0 rounded-full bg-app-accent/12 px-2.5 py-1 text-[11px] font-black leading-none text-app-accent ring-1 ring-app-accent/22">
            Шаг {props.stepNumber()}/{props.totalSteps}
          </span>
          <StatusPill
            connection={props.connection}
            logOpen={props.logOpen}
            onClick={props.onStatusClick}
          />
        </div>
      </div>
      <div class="h-1 overflow-hidden rounded-full bg-black/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]">
        <div
          class="h-full rounded-full bg-[linear-gradient(90deg,var(--color-app-accent),var(--color-app-warm))] transition-[width] duration-300 ease-out"
          style={{ width: progressWidth(props.stepNumber(), props.totalSteps) }}
        />
      </div>
    </header>
  );
}

function progressWidth(stepNumber: number, totalSteps: number): string {
  const percent = Math.min(100, Math.max(0, (stepNumber / totalSteps) * 100));
  return `${percent}%`;
}
