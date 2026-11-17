// Legacy import compatibility: the visible Soil Health page now has one shared implementation.
import type { WorkspaceTab } from '../WorkspaceSidebar';
import { SoilHealthDashboard } from '../SoilHealthDashboard';

interface SoilIntelligenceRedesignProps {
  initialFarmId?: number | null;
  onNavigateToTab?: (tab: WorkspaceTab, modelIdOrFarmId?: string, extraId?: number) => void;
  onNavigateToModel?: (modelId: string) => void;
}

export function SoilIntelligenceRedesign(props: SoilIntelligenceRedesignProps) {
  return <SoilHealthDashboard {...props} />;
}
