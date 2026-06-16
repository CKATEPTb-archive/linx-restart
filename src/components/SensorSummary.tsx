import type { Accessor } from 'solid-js';

interface SensorSummaryProps {
  selectedLabel: Accessor<string>;
}

export function SensorSummary(props: SensorSummaryProps) {
  return (
    <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-white/[0.055] bg-app-panel/82 px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.16)]">
      <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-app-accent/12 text-app-accent ring-1 ring-app-accent/18">
        <span class="size-3 rounded-full bg-app-accent shadow-[0_0_14px_rgba(88,216,196,0.55)]" />
      </span>
      <div class="grid min-w-0 gap-1">
        <span class="text-[9px] font-extrabold uppercase leading-none tracking-[0.12em] text-app-muted">
          Сенсор
        </span>
        <strong class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[17px] leading-none text-app-ink">
          {props.selectedLabel()}
        </strong>
      </div>
    </div>
  );
}
