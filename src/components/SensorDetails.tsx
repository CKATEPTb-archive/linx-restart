import { For } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { SensorRow } from '../app/types';

interface SensorDetailsProps {
  rows: Accessor<SensorRow[]>;
}

export function SensorDetails(props: SensorDetailsProps) {
  return (
    <div class="grid min-h-0 content-start grid-cols-2 gap-2 overflow-hidden" aria-label="Информация о сенсоре">
      <For each={props.rows()}>
        {(row) => (
          <div class="grid min-w-0 gap-1 rounded-xl border border-white/[0.045] bg-app-elevated/70 px-2.5 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.12)]">
            <span class="text-[9px] font-extrabold uppercase leading-none tracking-[0.05em] text-app-muted">
              {row.label}
            </span>
            <strong class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-black leading-[1.12] text-app-ink max-[340px]:text-[11px]">
              {row.value}
            </strong>
          </div>
        )}
      </For>
    </div>
  );
}
