import type { LinxResetViewModel } from '../app/types';
import { ActionButton } from './ActionButton';
import { LogPanel } from './LogPanel';
import { QuizStepShell } from './QuizStepShell';
import { SensorDetails } from './SensorDetails';
import { SensorSummary } from './SensorSummary';

type SensorInfoStepProps = Pick<
  LinxResetViewModel,
  | 'confirmAndReset'
  | 'logSummary'
  | 'logText'
  | 'resetDisabled'
  | 'resetSent'
  | 'selectedLabel'
  | 'sensorRows'
> & {
  onResetComplete: () => void;
};

export function SensorInfoStep(props: SensorInfoStepProps) {
  async function resetSensor(): Promise<void> {
    const completed = await props.confirmAndReset();
    if (completed) {
      props.onResetComplete();
    }
  }

  return (
    <QuizStepShell title="Информация о сенсоре">
      <div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-2.5">
        <SensorSummary
          selectedLabel={props.selectedLabel}
        />
        <SensorDetails rows={props.sensorRows} />
        <ActionButton
          disabled={props.resetDisabled()}
          intent="reset"
          onClick={resetSensor}
          wide
        >
          {props.resetSent() ? 'ПЕРЕЗАПУСК ОТПРАВЛЕН' : 'ПЕРЕЗАПУСК'}
        </ActionButton>
        <LogPanel logSummary={props.logSummary} logText={props.logText} />
      </div>
    </QuizStepShell>
  );
}
