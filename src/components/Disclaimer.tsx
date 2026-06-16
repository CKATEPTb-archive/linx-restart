import { DISCLAIMER_TEXT } from '../app/constants';

export function Disclaimer() {
  return (
    <section class="overflow-hidden rounded-xl border border-white/[0.045] bg-black/14 px-3 py-2 text-center text-[12px] leading-[1.2] text-app-muted shadow-[0_8px_22px_rgba(0,0,0,0.1)] max-[340px]:text-[11px]" role="note">
      <strong class="block text-app-note/95">Отказ от ответственности.</strong>
      <span class="block whitespace-pre-line">{DISCLAIMER_TEXT}</span>
    </section>
  );
}
