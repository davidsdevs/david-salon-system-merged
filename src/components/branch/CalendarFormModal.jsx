    /**
 * Calendar Form Modal Component
 * For adding and editing branch calendar entries
 */

import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCalendarEntryTypes } from '../../services/branchCalendarService';
import LoadingSpinner from '../ui/LoadingSpinner';

const CalendarFormModal = ({ 
  isOpen, 
  entry, 
  onClose, 
  onSubmit,
  loading = false,
  defaultDate = ''
}) => {
  const [formData, setFormData] = useState({
    date: '',
    title: '',
    description: '',
    type: 'reminder'
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Calendar UI functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const handleDateSelect = (date) => {
    if (!date) return;
    const dateString = date.toISOString().split('T')[0];
    setFormData({ ...formData, date: dateString });
    setShowCalendar(false);
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const formatDateForInput = (date) => {
    if (!date) return '';
    if (typeof date === 'string') return date;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!isOpen) return;
    
    if (entry) {
      const dateValue = formatDateForInput(entry.date);
      setFormData({
        date: dateValue,
        title: entry.title,
        description: entry.description || '',
        type: entry.type || 'reminder'
      });
      if (entry.date) {
        const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : entry.date;
        setCurrentMonth(entryDate);
      }
    } else {
      const initialDate = defaultDate || '';
      setFormData({
        date: initialDate,
        title: '',
        description: '',
        type: 'reminder'
      });
      setCurrentMonth(initialDate ? new Date(initialDate) : new Date());
    }
  }, [entry, isOpen, defaultDate]);

  if (!isOpen) return null;

  const entryTypes = getCalendarEntryTypes();
  const calendarDays = getDaysInMonth(currentMonth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const selectedDate = formData.date ? new Date(formData.date) : null;
  if (selectedDate) {
    selectedDate.setHours(0, 0, 0, 0);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {entry ? 'Edit Reminder' : 'Add Reminder'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Date */}
            <div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Open Calendar"
                  >
                    <CalendarIcon className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Calendar UI */}
                {showCalendar && (
                  <div className="absolute z-10 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-full max-w-sm">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        type="button"
                        onClick={() => navigateMonth('prev')}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <h3 className="font-semibold text-gray-900">
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h3>
                      <button
                        type="button"
                        onClick={() => navigateMonth('next')}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((date, index) => {
                        if (!date) {
                          return <div key={`empty-${index}`} className="aspect-square" />;
                        }
                        
                        const dateStr = date.toISOString().split('T')[0];
                        const isToday = date.getTime() === today.getTime();
                        const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
                        const isPast = date < today;
                        
                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => !isPast && handleDateSelect(date)}
                            disabled={isPast}
                            className={`
                              aspect-square text-sm rounded transition-colors
                              ${isPast 
                                ? 'text-gray-300 cursor-not-allowed' 
                                : 'hover:bg-primary-100 text-gray-700 cursor-pointer'
                              }
                              ${isToday ? 'font-bold border-2 border-primary-500' : ''}
                              ${isSelected ? 'bg-primary-600 text-white hover:bg-primary-700' : ''}
                            `}
                          >
                            {date.getDate()}
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const todayStr = today.toISOString().split('T')[0];
                          setFormData({ ...formData, date: todayStr });
                          setShowCalendar(false);
                        }}
                        className="flex-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCalendar(false)}
                        className="flex-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Team Meeting, Equipment Maintenance"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Additional details about this entry"
              />
            </div>

          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <LoadingSpinner size="sm" />}
              {loading ? 'Saving...' : (entry ? 'Update Reminder' : 'Add Reminder')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CalendarFormModal;
