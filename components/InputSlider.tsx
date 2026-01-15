import React, { useState, useEffect } from 'react';

interface InputSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (val: number) => void;
  description?: string;
}

const InputSlider: React.FC<InputSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  description
}) => {
  const [localVal, setLocalVal] = useState<string>(value.toString());

  // Sync with prop value changes (e.g. from slider or parent reset)
  useEffect(() => {
    const currentLocal = parseFloat(localVal);
    // Update local state only if the prop value is significantly different 
    // to avoid interrupting typing (e.g. "3." vs 3)
    if (isNaN(currentLocal) || Math.abs(currentLocal - value) > 0.000001) {
      setLocalVal(value.toString());
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalVal(newVal);
    
    const parsed = parseFloat(newVal);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
      let parsed = parseFloat(localVal);
      if (isNaN(parsed)) {
          parsed = min;
      } else {
          // Clamp values on blur to ensure they stay within reasonable bounds
          if (parsed < min) parsed = min;
          if (parsed > max) parsed = max;
      }
      setLocalVal(parsed.toString());
      onChange(parsed);
  };

  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        <div className="flex items-center">
            <input
                type="number"
                value={localVal}
                onChange={handleInputChange}
                onBlur={handleBlur}
                step={step}
                className="w-20 text-right text-sm font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none"
            />
            <span className="text-xs text-emerald-600 font-medium ml-1 w-10 text-right">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 hover:accent-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
      />
      {description && (
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      )}
    </div>
  );
};

export default InputSlider;