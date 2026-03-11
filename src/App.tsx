/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  differenceInWeeks,
  startOfDay,
  setHours,
  setMinutes,
  isAfter,
  isBefore,
  addDays,
  subDays,
  parseISO,
  addMinutes,
  subMinutes
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Heart, Plus, X, Info, Bell, BellOff, AlertCircle } from 'lucide-react';

// Reference: User got kids Sunday, March 8, 2026 at 6:00 PM
const REFERENCE_DATE = new Date(2026, 2, 8, 18, 0, 0); // March is index 2

interface CalendarEvent {
  id: string;
  date: string; // ISO string (date part)
  time: string; // HH:mm
  title: string;
  type: 'appointment' | 'holiday' | 'other';
  reminderMinutes: number | null; // minutes before event
  notified?: boolean; // to prevent double notifications
}

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'reminder' | 'info';
}

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState<CalendarEvent['type']>('appointment');
  const [newEventTime, setNewEventTime] = useState('09:00');
  const [newEventReminder, setNewEventReminder] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Load events from localStorage
  useEffect(() => {
    const savedEvents = localStorage.getItem('parenting_events');
    if (savedEvents) {
      try {
        setEvents(JSON.parse(savedEvents));
      } catch (e) {
        console.error('Failed to parse events', e);
      }
    }
  }, []);

  // Save events to localStorage
  useEffect(() => {
    localStorage.setItem('parenting_events', JSON.stringify(events));
  }, [events]);

  // Update current date every minute and check for reminders
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentDate(now);
      checkReminders(now);
    }, 60000);
    return () => clearInterval(timer);
  }, [events]);

  const checkReminders = (now: Date) => {
    const updatedEvents = [...events];
    let changed = false;

    events.forEach((event, index) => {
      if (event.reminderMinutes === null || event.notified) return;

      const [hours, minutes] = event.time.split(':').map(Number);
      const eventDateTime = setMinutes(setHours(parseISO(event.date), hours), minutes);
      const reminderTime = subMinutes(eventDateTime, event.reminderMinutes);

      // If current time is past or at reminder time, but before event time
      if (isAfter(now, reminderTime) && isBefore(now, eventDateTime)) {
        addToast({
          id: crypto.randomUUID(),
          title: 'Reminder',
          message: `${event.title} is starting in ${event.reminderMinutes} minutes.`,
          type: 'reminder'
        });
        updatedEvents[index] = { ...event, notified: true };
        changed = true;
      }
    });

    if (changed) {
      setEvents(updatedEvents);
    }
  };

  const addToast = (toast: Toast) => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      removeToast(toast.id);
    }, 10000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !newEventTitle.trim()) return;

    const newEvent: CalendarEvent = {
      id: crypto.randomUUID(),
      date: startOfDay(selectedDate).toISOString(),
      time: newEventTime,
      title: newEventTitle.trim(),
      type: newEventType,
      reminderMinutes: newEventReminder,
      notified: false,
    };

    setEvents([...events, newEvent]);
    setNewEventTitle('');
    setNewEventTime('09:00');
    setNewEventReminder(null);
    setIsModalOpen(false);
  };

  const deleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const getEventsForDay = (date: Date) => {
    return events.filter(e => isSameDay(parseISO(e.date), date));
  };

  const getCustodyStatus = (date: Date) => {
    // To determine custody at a specific time:
    // 1. Find the most recent Sunday at 6 PM before or at this date
    let lastExchange = startOfWeek(date, { weekStartsOn: 0 });
    lastExchange = setHours(lastExchange, 18);
    lastExchange = setMinutes(lastExchange, 0);

    // If the date is before 6 PM on its own Sunday, the exchange hasn't happened yet
    if (isBefore(date, lastExchange)) {
      lastExchange = subDays(lastExchange, 7);
    }

    const weeksSinceRef = Math.floor(differenceInWeeks(lastExchange, REFERENCE_DATE));
    
    // Even weeks = User (since March 8 was week 0)
    // Odd weeks = Mom
    return weeksSinceRef % 2 === 0 ? 'user' : 'mom';
  };

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setViewDate(addMonths(viewDate, 1));
  const prevMonth = () => setViewDate(subMonths(viewDate, 1));
  const goToToday = () => {
    setViewDate(new Date());
    setCurrentDate(new Date());
  };

  const currentStatus = getCustodyStatus(currentDate);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans p-3 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Parenting Schedule</h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">Weekly alternating custody • Sundays @ 6PM</p>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button 
              onClick={prevMonth}
              className="p-1.5 md:p-2 hover:bg-slate-50 rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <span className="px-2 md:px-4 font-semibold text-sm md:text-base min-w-[110px] md:min-w-[140px] text-center">
              {format(viewDate, 'MMMM yyyy')}
            </span>
            <button 
              onClick={nextMonth}
              className="p-1.5 md:p-2 hover:bg-slate-50 rounded-lg transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </header>

        {/* Current Status Card */}
        <div className={`mb-6 md:mb-8 p-4 md:p-6 rounded-2xl border transition-all duration-500 ${
          currentStatus === 'user' 
            ? 'bg-blue-50 border-blue-200 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 md:gap-4">
              <div className={`p-2.5 md:p-3 rounded-full ${currentStatus === 'user' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <User className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-[10px] md:text-sm font-medium text-slate-500 uppercase tracking-wider">Current Custody</p>
                <h2 className="text-lg md:text-2xl font-bold text-slate-900 leading-tight">
                  {currentStatus === 'user' ? "It's Your Week!" : "Kids are at Mom's"}
                </h2>
              </div>
            </div>
            <button 
              onClick={goToToday}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Today</span>
            </button>
          </div>
          <div className="mt-3 md:mt-4 flex items-center gap-2 text-slate-600 text-[11px] md:text-sm">
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span>Next: {format(addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), isAfter(currentDate, setHours(startOfWeek(currentDate, { weekStartsOn: 0 }), 18)) ? 7 : 0), 'EEE, MMM do')} @ 6PM</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Weekday Labels */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="py-2 md:py-3 text-center text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayStatus = getCustodyStatus(setHours(day, 12));
              const isToday = isSameDay(day, currentDate);
              const isCurrentMonth = isSameMonth(day, monthStart);

              return (
                <div 
                  key={day.toString()} 
                  onClick={() => {
                    setSelectedDate(day);
                    setIsModalOpen(true);
                  }}
                  className={`relative min-h-[70px] sm:min-h-[90px] md:min-h-[120px] p-1 md:p-2 border-r border-b border-slate-100 last:border-r-0 transition-all duration-300 cursor-pointer group ${
                    !isCurrentMonth ? 'bg-slate-50/10' : ''
                  } ${
                    dayStatus === 'user' ? 'bg-blue-50/60' : 'bg-white'
                  } ${
                    isToday ? 'ring-2 ring-blue-500 ring-inset z-10 shadow-lg shadow-blue-100' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-xs md:text-sm font-semibold w-5 h-5 md:w-7 md:h-7 flex items-center justify-center rounded-full ${
                      isToday 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      {isToday && (
                        <span className="flex h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-1 md:mt-2 space-y-0.5 md:space-y-1">
                    {dayStatus === 'user' ? (
                      <div className="flex items-center gap-0.5 md:gap-1 text-[8px] md:text-xs font-medium text-blue-600 bg-blue-100/50 px-1 md:px-1.5 py-0.5 rounded-md w-fit">
                        <Heart className="w-2 h-2 md:w-3 md:h-3 fill-current" />
                        <span className="hidden xs:inline">With You</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[8px] md:text-xs font-medium text-slate-400 px-1 md:px-1.5 py-0.5 w-fit">
                        <span className="hidden xs:inline">Mom's</span>
                      </div>
                    )}

                    {/* Render Custom Events */}
                    {getEventsForDay(day).map(event => (
                      <div 
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEvent(event.id);
                        }}
                        className={`flex flex-col gap-0 px-1 md:px-1.5 py-0.5 md:py-1 rounded text-[7px] md:text-[10px] font-medium border group/event transition-colors ${
                          event.type === 'appointment' ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' :
                          event.type === 'holiday' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' :
                          'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-0.5">
                          <span className="truncate max-w-[40px] sm:max-w-none">{event.title}</span>
                          <X className="w-2 h-2 opacity-0 group-hover/event:opacity-100 transition-opacity flex-shrink-0 hidden sm:block" />
                        </div>
                        <div className="hidden sm:flex items-center justify-between text-[7px] md:text-[8px] opacity-70">
                          <span>{event.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Special indicator for Sunday exchange */}
                  {format(day, 'i') === '0' && (
                    <div className="absolute bottom-0.5 left-0 right-0 px-1">
                      <div className="h-0.5 md:h-1 w-full bg-slate-200 rounded-full overflow-hidden flex">
                        <div className="h-full w-3/4 bg-blue-400/30" />
                        <div className="h-full w-1/4 bg-slate-300/30" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:gap-6 text-[10px] md:text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-blue-50 border border-blue-200" />
            <span>Your Week</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-white border border-slate-200" />
            <span>Mom's Week</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-amber-50 border border-amber-200" />
            <span>Appt</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-emerald-50 border border-emerald-200" />
            <span>Holiday</span>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className="pointer-events-auto bg-white border-l-4 border-blue-500 shadow-2xl rounded-lg p-3 md:p-4 flex items-start gap-3 w-full md:min-w-[300px] animate-in slide-in-from-bottom md:slide-in-from-right duration-300"
          >
            <div className="p-1.5 md:p-2 bg-blue-50 rounded-full text-blue-500">
              <AlertCircle className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs md:text-sm font-bold text-slate-900">{toast.title}</h4>
              <p className="text-[10px] md:text-xs text-slate-600 mt-0.5">{toast.message}</p>
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-200">
            <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-base md:text-lg font-bold text-slate-900">
                Add Event for {selectedDate && format(selectedDate, 'MMM do')}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleAddEvent} className="p-5 md:p-6 space-y-4">
              <div>
                <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1">Event Title</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="e.g. Dentist, School Play..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Time
                  </label>
                  <input 
                    type="time" 
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Bell className="w-3 h-3" />
                    Reminder
                  </label>
                  <select 
                    value={newEventReminder === null ? '' : newEventReminder}
                    onChange={(e) => setNewEventReminder(e.target.value === '' ? null : Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  >
                    <option value="">None</option>
                    <option value="5">5m before</option>
                    <option value="15">15m before</option>
                    <option value="30">30m before</option>
                    <option value="60">1h before</option>
                    <option value="1440">1d before</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-2">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'appointment', label: 'Appt', color: 'amber' },
                    { id: 'holiday', label: 'Holiday', color: 'emerald' },
                    { id: 'other', label: 'Other', color: 'purple' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setNewEventType(type.id as CalendarEvent['type'])}
                      className={`py-2 px-2 rounded-xl text-[10px] md:text-xs font-bold border transition-all ${
                        newEventType === type.id 
                          ? `bg-${type.color}-500 border-${type.color}-600 text-white shadow-md transform scale-105` 
                          : `bg-white border-slate-200 text-slate-600 hover:bg-slate-50`
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3 pb-4 sm:pb-0">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
