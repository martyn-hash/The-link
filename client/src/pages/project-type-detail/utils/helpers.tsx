interface CharacterCounterProps {
  current: number;
  max: number;
  className?: string;
}

export function CharacterCounter({ current, max, className = "" }: CharacterCounterProps) {
  const isOverLimit = current > max;
  const percentage = (current / max) * 100;
  
  let colorClass = "text-muted-foreground";
  if (isOverLimit) {
    colorClass = "text-red-600 font-semibold";
  } else if (percentage > 80) {
    colorClass = "text-yellow-600 font-semibold";
  } else if (percentage > 50) {
    colorClass = "text-blue-600";
  }
  
  return (
    <span className={`text-xs ${colorClass} ${className}`} data-testid="character-counter">
      {current}/{max}
    </span>
  );
}
