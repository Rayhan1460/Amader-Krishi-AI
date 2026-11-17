import { useEffect, useRef, type ReactNode } from 'react';

export function CalendarModal({ labelId, onClose, pending = false, children }: {
  labelId: string;
  onClose: () => void;
  pending?: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog ref={dialog} className="acc-legacy" aria-labelledby={labelId}
      onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
      {children}
    </dialog>
  );
}
