import { Show } from 'solid-js';
import type { LinxResetViewModel } from '../app/types';
import { BluetoothAura } from './BluetoothAura';
import { QuizStepShell } from './QuizStepShell';
import { SupportMessage } from './SupportMessage';

type SensorSelectStepProps = Pick<
  LinxResetViewModel,
  | 'authenticated'
  | 'chooseAndConnect'
  | 'chooseDisabled'
  | 'platform'
  | 'supportIssue'
  | 'support'
> & {
  onConnected: () => void;
};

export function SensorSelectStep(props: SensorSelectStepProps) {
  async function chooseSensor(): Promise<void> {
    await props.chooseAndConnect();
    if (props.authenticated()) {
      props.onConnected();
    }
  }

  return (
    <QuizStepShell title="Выберите сенсор">
      <div class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2.5">
        <BluetoothAura
          disabled={props.chooseDisabled()}
          label={props.supportIssue() ? 'Bluetooth недоступен' : (props.chooseDisabled() ? 'Подключение...' : 'Нажмите чтобы выбрать')}
          onClick={chooseSensor}
        />
        <Show when={props.supportIssue()}>
          <div class="rounded-2xl border border-app-danger/35 bg-app-danger/10 px-3 py-2 text-center shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
            <SupportMessage support={props.support} />
          </div>
        </Show>
      </div>
    </QuizStepShell>
  );
}
