import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  X,
  Clock,
  AlertTriangle,
  CloudRain,
  RotateCw,
} from 'lucide-react';
import type { ReminderItem, ReminderCounts } from '../../types/index.ts';
import { reminderApi } from '../../services/api.ts';

interface NotificationBellProps {
  refreshKey?: string;
  onSelectTask?: (taskId: number) => void;
  onOpenReschedule?: (taskId: number) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  refreshKey,
  onSelectTask,
  onOpenReschedule,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [counts, setCounts] = useState<ReminderCounts>({
    total_active: 0,
    unread_count: 0,
    due_today_count: 0,
    overdue_count: 0,
    weather_advisory_count: 0,
  });
  const [activeFilter, setActiveFilter] = useState<'all' | 'due_today' | 'overdue' | 'weather'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const requestNumber = useRef(0);
  const fetchReminders = useCallback(async () => {
    const request = ++requestNumber.current;
    setIsLoading(true);
    try {
      const data = await reminderApi.list(undefined, true);
      if (request !== requestNumber.current) return;
      setReminders(data.reminders);
      setCounts(data.counts);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    } finally {
      if (request === requestNumber.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReminders();
    return () => { requestNumber.current += 1; };
  }, [fetchReminders, refreshKey]);

  useEffect(() => {
    // Auto-close on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await reminderApi.markRead(id);
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_read: true } : r))
      );
      setCounts((prev) => ({
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1),
      }));
    } catch (err) {
      console.error('Error marking reminder read:', err);
    }
  };

  const handleDismiss = async (id: number) => {
    try {
      await reminderApi.dismiss(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
      setCounts((prev) => ({
        ...prev,
        total_active: Math.max(0, prev.total_active - 1),
        unread_count: Math.max(0, prev.unread_count - 1),
      }));
    } catch (err) {
      console.error('Error dismissing reminder:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await reminderApi.markAllRead();
      setReminders((prev) => prev.map((r) => ({ ...r, is_read: true })));
      setCounts((prev) => ({ ...prev, unread_count: 0 }));
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  const filteredReminders = reminders.filter((r) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'due_today') return r.reminder_type === 'due_today';
    if (activeFilter === 'overdue') return r.reminder_type === 'overdue_task';
    if (activeFilter === 'weather') return r.reminder_type === 'weather_advisory';
    return true;
  });

  const getReminderIcon = (type: string, severity: string) => {
    if (type === 'weather_advisory') {
      return <CloudRain className="w-4 h-4 text-blue-400 shrink-0" />;
    }
    if (severity === 'urgent' || type === 'overdue_task') {
      return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />;
    }
    return <Clock className="w-4 h-4 text-amber-400 shrink-0" />;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-emerald-700/40 text-cream-100 transition-all active:scale-95 shadow-md flex items-center justify-center"
        title="স্মার্ট রিমাইন্ডার ও বিজ্ঞপ্তি"
        aria-label="স্মার্ট রিমাইন্ডার ও বিজ্ঞপ্তি"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5 text-amber-300" />
        {counts.unread_count > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[20px] text-[10px] font-bold bg-amber-500 text-slate-950 rounded-full border border-slate-900 shadow-md animate-pulse">
            {counts.unread_count}
          </span>
        )}
      </button>

      {/* Dropdown Menu / Drawer */}
      {isOpen && (
        <div className="acc-reminder-panel absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900/95 border border-emerald-700/50 rounded-2xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden flex flex-col max-h-[540px]">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-cream-50">স্মার্ট কৃষি রিমাইন্ডার</h3>
              {counts.unread_count > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {counts.unread_count} নতুন
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchReminders()}
                disabled={isLoading}
                className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                title="সিঙ্ক করুন"
              >
                <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {counts.unread_count > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                  title="সবগুলো পঠিত চিহ্নিত করুন"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>পঠিত</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950/40 border-b border-slate-800/80 text-[11px] overflow-x-auto">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeFilter === 'all'
                  ? 'bg-emerald-600/40 text-cream-50 font-semibold border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              সব ({counts.total_active})
            </button>
            <button
              onClick={() => setActiveFilter('due_today')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeFilter === 'due_today'
                  ? 'bg-amber-600/40 text-amber-200 font-semibold border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              আজকের ({counts.due_today_count})
            </button>
            <button
              onClick={() => setActiveFilter('overdue')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeFilter === 'overdue'
                  ? 'bg-red-600/40 text-red-200 font-semibold border border-red-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              বকেয়া ({counts.overdue_count})
            </button>
            <button
              onClick={() => setActiveFilter('weather')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeFilter === 'weather'
                  ? 'bg-blue-600/40 text-blue-200 font-semibold border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              আবহাওয়া ({counts.weather_advisory_count})
            </button>
          </div>

          {/* List of Reminders */}
          <div className="overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
            {filteredReminders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                কোনো সক্রিয় রিমাইন্ডার নেই। আপনার খামার ও ক্যালেন্ডার পুরোপুরি হালনাগাদ রয়েছে।
              </div>
            ) : (
              filteredReminders.map((rem) => (
                <div
                  key={rem.id}
                  className={`p-3 rounded-xl transition-all ${
                    rem.is_read
                      ? 'bg-slate-900/40 opacity-75'
                      : 'bg-slate-800/70 border-l-2 border-amber-400 shadow-sm'
                  } hover:bg-slate-800/90`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{getReminderIcon(rem.reminder_type, rem.severity)}</div>
                      <div>
                        <h4 className="text-xs font-bold text-cream-100">{rem.title_bn}</h4>
                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                          {rem.message_bn}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDismiss(rem.id)}
                      className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                      title="বাতিল করুন"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                    <span className="text-[10px] text-slate-500">
                      {rem.farm_name || 'খামার'}
                    </span>

                    <div className="flex items-center gap-2">
                      {!rem.is_read && (
                        <button
                          onClick={() => handleMarkRead(rem.id)}
                          className="text-slate-400 hover:text-emerald-400 text-[10px] transition-colors"
                        >
                          পঠিত
                        </button>
                      )}

                      {rem.task_id && onOpenReschedule && (
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            onOpenReschedule(rem.task_id!);
                          }}
                          className="px-2 py-0.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 text-[10px] font-medium rounded border border-amber-500/40 transition-all"
                        >
                          পুনর্নির্ধারণ
                        </button>
                      )}

                      {rem.task_id && onSelectTask && (
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            onSelectTask(rem.task_id!);
                          }}
                          className="px-2 py-0.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-[10px] font-medium rounded border border-emerald-500/40 transition-all"
                        >
                          বিস্তারিত
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
