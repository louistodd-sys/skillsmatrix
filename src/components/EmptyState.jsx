import { Button } from '@/components/ui/button';

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, secondaryLabel, onSecondary }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">{description}</p>
      <div className="flex items-center gap-3 mt-5">
        {actionLabel && (
          <Button onClick={onAction}>{actionLabel}</Button>
        )}
        {secondaryLabel && (
          <Button variant="outline" onClick={onSecondary}>{secondaryLabel}</Button>
        )}
      </div>
    </div>
  );
}