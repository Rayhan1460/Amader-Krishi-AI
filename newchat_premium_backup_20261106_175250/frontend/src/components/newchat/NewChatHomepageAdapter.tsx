import { useLanguage } from '../../context/LanguageContext.tsx';
import type { WorkspaceTab } from '../workspace/WorkspaceSidebar.tsx';

// @ts-ignore - Supplied JSX component is intentionally not typechecked.
import NewChatWelcome from './NewChatWelcome.jsx';

interface Props {
  onNavigateToTab: (
    tab: WorkspaceTab,
    modelIdOrFarmId?: string,
    extraId?: number
  ) => void;
  onSendMessage: (message: string) => void | Promise<void>;
  isSending?: boolean;
}

export function NewChatHomepageAdapter({
  onSendMessage,
  isSending = false,
}: Props) {
  const { lang } = useLanguage();

  return (
    <div className="relative flex-1">
      <NewChatWelcome
        lang={lang}
        onSend={(message: string, image?: File) => {
          if (isSending) return;

          if (image) {
            window.alert(
              'ছবি বিশ্লেষণের জন্য ফসল স্বাস্থ্য পেজের স্ক্যান ব্যবহার করুন।'
            );
            return;
          }

          if (message.trim()) {
            void onSendMessage(message);
          }
        }}
      />
      {isSending && (
        <div
          role="status"
          className="absolute top-3 right-3 rounded-full bg-[#174d35] px-4 py-2 text-sm text-white"
        >
          পাঠানো হচ্ছে…
        </div>
      )}
    </div>
  );
}