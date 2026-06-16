import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

interface QuizStepShellProps {
  children: JSX.Element;
  lead?: string;
  title: string;
}

export function QuizStepShell(props: QuizStepShellProps) {
  return (
    <section class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5 overflow-hidden">
      <header class="grid min-w-0 gap-1 px-0.5">
        <h2 class="min-w-0 text-[20px] font-black leading-none tracking-normal text-app-ink max-[340px]:text-lg">
          {props.title}
        </h2>
        <Show when={props.lead}>
          <p class="max-h-[2.6em] overflow-hidden text-[12px] font-semibold leading-tight text-app-muted">
            {props.lead}
          </p>
        </Show>
      </header>
      <div class="min-h-0 overflow-hidden">
        {props.children}
      </div>
    </section>
  );
}
