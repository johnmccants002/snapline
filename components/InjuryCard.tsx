import { EmptyState } from './EmptyState';
export function InjuryCard() {
  return (
    <EmptyState
      title="Injuries"
      message="Injury provider not configured. Player status and estimated impact are unavailable."
    />
  );
}
