import { Progress } from "@/components/ui/progress";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export function StepIndicator({ currentStep, totalSteps, stepLabels }: StepIndicatorProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="mb-4">
      <p className="text-muted-foreground mb-2 text-sm">
        Step {currentStep} of {totalSteps}
        {stepLabels?.[currentStep - 1] ? `: ${stepLabels[currentStep - 1]}` : null}
      </p>
      <Progress value={progress} />
    </div>
  );
}
