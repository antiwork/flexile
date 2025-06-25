import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as React from "react";
import { cn } from "@/utils";

function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("bg-primary/20 relative h-2 w-full overflow-hidden rounded-full", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="bg-primary h-full w-full flex-1 transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export interface CircleProgressProps extends React.HtmlHTMLAttributes<HTMLDivElement> {
  value: number;
  maxValue: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}

const CircleProgress = ({
  value,
  maxValue,
  size = 40,
  strokeWidth = 3,
  color,
  className,
  ...props
}: CircleProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillPercentage = Math.min(value / maxValue, 1);
  const strokeDashoffset = circumference * (1 - fillPercentage);

  const currentColor = color ?? "stroke-emerald-500";

  return (
    <div
      className={cn(className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={maxValue}
      {...props}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("duration-300")}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-transparent stroke-gray-200 dark:stroke-gray-700"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={cn("fill-transparent transition-colors", currentColor)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export { Progress, CircleProgress };
