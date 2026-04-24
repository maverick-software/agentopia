import { Check } from 'lucide-react';
import { WIZARD_STEPS } from './constants';

interface StepIndicatorProps {
  step: number;
}

export function StepIndicator({ step }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center space-x-4 py-6 px-6 border-b border-border dark:border-border bg-background dark:bg-background">
      {WIZARD_STEPS.map((stepConfig, index) => {
        const StepIcon = stepConfig.icon;
        const isActive = step === stepConfig.id;
        const isCompleted = step > stepConfig.id;
        return (
          <div key={stepConfig.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCompleted || isActive
                    ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/20 border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
              </div>
              <div className="mt-2 text-center">
                <div className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {stepConfig.title}
                </div>
              </div>
            </div>
            {index < WIZARD_STEPS.length - 1 && (
              <div className={`w-12 h-0.5 mx-4 transition-all ${step > stepConfig.id ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
