import React, { useEffect, useState } from 'react';
import { SLIDER_STEPS } from './constants';

interface TimeoutSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function TimeoutSlider({ value, onChange, disabled = false }: TimeoutSliderProps) {
  const [sliderValue, setSliderValue] = useState(value);

  useEffect(() => {
    setSliderValue(value);
  }, [value]);

  const getValueLabel = (currentValue: number) => {
    const step = SLIDER_STEPS.find((option) => option.value === currentValue);
    return step ? step.label : `${currentValue} min`;
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const index = parseInt(event.target.value, 10);
    const nextValue = SLIDER_STEPS[index].value;
    setSliderValue(nextValue);
    onChange(nextValue);
  };

  const getCurrentIndex = () => {
    const index = SLIDER_STEPS.findIndex((step) => step.value === sliderValue);
    return index >= 0 ? index : 0;
  };

  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-white">{getValueLabel(sliderValue)}</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min="0"
          max={SLIDER_STEPS.length - 1}
          value={getCurrentIndex()}
          onChange={handleChange}
          disabled={disabled}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: '#4b5563',
            accentColor: '#4f46e5',
          }}
        />
        <div className="flex justify-between mt-1 px-[2px]">
          {SLIDER_STEPS.map((step, index) => (
            <div key={index} className="relative flex flex-col items-center">
              <div className={`h-1 w-1 rounded-full -mt-1 ${sliderValue === step.value ? 'bg-blue-400' : 'bg-gray-500'}`} />
              <span className="text-[10px] text-gray-400 mt-1">{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
