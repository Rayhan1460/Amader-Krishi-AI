import { DiseaseScanPanel } from './DiseaseScanPanel.tsx';

interface TomatoDiseaseToolProps {
  onViewHistory?: (recordId: number) => void;
}

export function TomatoDiseaseTool({ onViewHistory }: TomatoDiseaseToolProps) {
  return <DiseaseScanPanel crop="tomato" onViewHistory={onViewHistory} />;
}
