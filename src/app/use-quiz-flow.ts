import { createMemo, createSignal } from 'solid-js';
import { QUIZ_PROGRESS_TOTAL, quizStepNumber } from './quiz';
import type { PreparationStepId, QuizStepId } from './quiz';

export function useQuizFlow() {
  const [step, setStep] = createSignal<QuizStepId>('disconnect-active');
  const canGoBack = createMemo(() => step() === 'forget-device');
  const stepNumber = createMemo(() => quizStepNumber(step()));

  function completePreparationStep(id: PreparationStepId): void {
    setStep(id === 'disconnect-active' ? 'forget-device' : 'select-sensor');
  }

  function openSensorInfo(): void {
    setStep('sensor-info');
  }

  function goBack(): void {
    if (step() === 'forget-device') {
      setStep('disconnect-active');
    }
  }

  function openResetComplete(): void {
    setStep('reset-complete');
  }

  return {
    canGoBack,
    completePreparationStep,
    goBack,
    openResetComplete,
    openSensorInfo,
    step,
    stepNumber,
    totalSteps: QUIZ_PROGRESS_TOTAL,
  };
}
