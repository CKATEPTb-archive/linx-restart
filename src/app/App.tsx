import { Match, Switch } from 'solid-js';
import { PREPARATION_STEPS, RESET_COMPLETE_STEP } from './quiz';
import { useQuizFlow } from './use-quiz-flow';
import { useLinxResetApp } from './use-linx-reset-app';
import { AppHeader } from '../components/AppHeader';
import { Disclaimer } from '../components/Disclaimer';
import { LogPanel } from '../components/LogPanel';
import { PreparationStep } from '../components/PreparationStep';
import { ResetCompleteStep } from '../components/ResetCompleteStep';
import { SensorInfoStep } from '../components/SensorInfoStep';
import { SensorSelectStep } from '../components/SensorSelectStep';

export function App() {
  const viewModel = useLinxResetApp();
  const quiz = useQuizFlow();

  return (
    <main class="relative mx-auto grid h-dvh w-full max-w-[520px] grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden bg-[linear-gradient(180deg,rgba(21,27,25,0.98),rgba(11,15,14,1)_46%,rgba(10,13,12,1))] px-3 pt-[max(10px,env(safe-area-inset-top))] pb-[max(9px,env(safe-area-inset-bottom))] text-app-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]">
      <AppHeader
        connection={viewModel.connection}
        logOpen={viewModel.logOpen}
        onStatusClick={viewModel.toggleLog}
        stepNumber={quiz.stepNumber}
        totalSteps={quiz.totalSteps}
      />

      <Switch>
        <Match when={quiz.step() === 'disconnect-active'}>
          <PreparationStep
            canGoBack={quiz.canGoBack()}
            content={PREPARATION_STEPS['disconnect-active']}
            onDone={quiz.completePreparationStep}
            onBack={quiz.goBack}
          />
        </Match>
        <Match when={quiz.step() === 'forget-device'}>
          <PreparationStep
            canGoBack={quiz.canGoBack()}
            content={PREPARATION_STEPS['forget-device']}
            onDone={quiz.completePreparationStep}
            onBack={quiz.goBack}
          />
        </Match>
        <Match when={quiz.step() === 'select-sensor'}>
          <SensorSelectStep
            authenticated={viewModel.authenticated}
            chooseAndConnect={viewModel.chooseAndConnect}
            chooseDisabled={viewModel.chooseDisabled}
            onConnected={quiz.openSensorInfo}
            platform={viewModel.platform}
            support={viewModel.support}
            supportIssue={viewModel.supportIssue}
          />
        </Match>
        <Match when={quiz.step() === 'sensor-info'}>
          <SensorInfoStep
            confirmAndReset={viewModel.confirmAndReset}
            onResetComplete={quiz.openResetComplete}
            resetDisabled={viewModel.resetDisabled}
            resetSent={viewModel.resetSent}
            selectedLabel={viewModel.selectedLabel}
            sensorRows={viewModel.sensorRows}
          />
        </Match>
        <Match when={quiz.step() === 'reset-complete'}>
          <ResetCompleteStep content={RESET_COMPLETE_STEP} />
        </Match>
      </Switch>

      <div class="pointer-events-none absolute inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30">
        <LogPanel
          logSummary={viewModel.logSummary}
          logText={viewModel.logText}
          onClose={viewModel.closeLog}
          open={viewModel.logOpen}
        />
      </div>

      <Disclaimer />
    </main>
  );
}
