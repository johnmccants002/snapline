import { EmptyState } from './EmptyState';
export function WeatherCard() {
  return (
    <EmptyState
      title="Weather"
      message="Weather provider not configured. No forecast is included in the analysis."
    />
  );
}
