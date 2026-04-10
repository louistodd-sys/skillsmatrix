import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function RAGBar({ green = 0, amber = 0, red = 0, grey = 0, showLabels = false }) {
  const total = green + amber + red + grey;
  if (total === 0) return <div className="h-3 rounded-full bg-gray-100 w-full" />;

  const segments = [
    { value: green, color: 'bg-green-500', label: `Current: ${green}` },
    { value: amber, color: 'bg-amber-500', label: `Expiring: ${amber}` },
    { value: red, color: 'bg-red-500', label: `Expired/Missing: ${red}` },
    { value: grey, color: 'bg-gray-400', label: `Not Assessed: ${grey}` },
  ].filter(s => s.value > 0);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 w-full">
        <div className="flex h-3 rounded-full overflow-hidden w-full bg-gray-100">
          {segments.map((seg, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className={`${seg.color} transition-all`}
                  style={{ width: `${(seg.value / total) * 100}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{seg.label} ({Math.round((seg.value / total) * 100)}%)</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        {showLabels && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {Math.round((green / total) * 100)}%
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}