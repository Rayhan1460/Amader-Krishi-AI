import { useLanguage } from '../../context/LanguageContext.tsx';
import type { WorkspaceTab } from '../workspace/WorkspaceSidebar.tsx';
// @ts-ignore Existing JavaScript welcome component; Workspace types stay unchanged.
import NewChatWelcome from './NewChatWelcome.jsx';

interface Props {
  onNavigateToTab: (tab: WorkspaceTab, modelIdOrFarmId?: string, extraId?: number) => void;
  onSendMessage: (message: string) => void | Promise<void>;
  isSending?: boolean;
}

export function NewChatHomepageAdapter({ onSendMessage, onNavigateToTab, isSending = false }: Props) {
  const { lang } = useLanguage();

  return (
    <div className="relative flex-1 min-w-0">
      <NewChatWelcome
        lang={lang}
        isSending={isSending}
        onNavigateToTab={onNavigateToTab}
        onSend={(message: string) => {
          if (!isSending && message.trim()) {
            void onSendMessage(message);
          }
        }}
      />
    </div>
  );
}
