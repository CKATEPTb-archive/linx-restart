import { Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { SupportDetails } from '../platform-support';

interface SupportMessageProps {
  support: Accessor<SupportDetails>;
}

export function SupportMessage(props: SupportMessageProps) {
  return (
    <span id="bluetoothSupport" class="max-h-[2.8em] overflow-hidden text-[12px] font-semibold leading-tight text-app-soft">
      <Show when={props.support().recommendation} fallback={props.support().text}>
        {(recommendation) => (
          <>
            {props.support().text}. Установите{' '}
            <a class="font-black text-app-accent underline decoration-app-accent/35 underline-offset-2" href={recommendation().url} target="_blank" rel="noreferrer">
              {recommendation().name}
            </a>
          </>
        )}
      </Show>
    </span>
  );
}
