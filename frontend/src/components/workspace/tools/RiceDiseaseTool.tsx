import { DiseaseScanPanel } from './DiseaseScanPanel.tsx';

interface RiceDiseaseToolProps {
  onViewHistory?: (recordId: number) => void;
}

export function RiceDiseaseTool({ onViewHistory }: RiceDiseaseToolProps) {
  return <DiseaseScanPanel crop="rice" onViewHistory={onViewHistory} />;
}
