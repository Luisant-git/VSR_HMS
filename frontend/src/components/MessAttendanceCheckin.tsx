import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Coffee, CheckCircle2, UtensilsCrossed, Pizza, Soup, Clock, Check, AlertCircle } from 'lucide-react';
import { MessAttendanceAPI } from '../api/mess-attendance.api';

interface MessAttendanceCheckinProps {
  studentId: string;
}

export const MessAttendanceCheckin: React.FC<MessAttendanceCheckinProps> = ({ studentId }) => {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  // Meal configurations with refined modern palettes
  const meals = [
    {
      name: 'Breakfast',
      start: 9.0, end: 11.5,
      displayTime: '09:00 AM - 11:30 AM',
      icon: Coffee,
      accentColor: '#f97316',
      gradient: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
      lightBg: 'rgba(249, 115, 22, 0.08)',
      shadow: 'rgba(234, 88, 12, 0.25)'
    },
    {
      name: 'Lunch',
      start: 13.5, end: 15.0,
      displayTime: '01:30 PM - 03:00 PM',
      icon: UtensilsCrossed,
      accentColor: '#ec4899',
      gradient: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
      lightBg: 'rgba(236, 72, 153, 0.08)',
      shadow: 'rgba(219, 39, 119, 0.25)'
    },
    {
      name: 'Evening Snacks',
      start: 17.0, end: 19.0,
      displayTime: '05:00 PM - 07:00 PM',
      icon: Pizza,
      accentColor: '#eab308',
      gradient: 'linear-gradient(135deg, #facc15 0%, #ca8a04 100%)',
      lightBg: 'rgba(234, 179, 8, 0.08)',
      shadow: 'rgba(202, 138, 4, 0.25)'
    },
    {
      name: 'Dinner',
      start: 20.5, end: 22.0,
      displayTime: '08:30 PM - 10:00 PM',
      icon: Soup,
      accentColor: '#0ea5e9',
      gradient: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
      lightBg: 'rgba(14, 165, 233, 0.08)',
      shadow: 'rgba(2, 132, 199, 0.25)'
    }
  ];

  const fetchAttendance = async () => {
    try {
      const data = await MessAttendanceAPI.getTodayAttendance(studentId);
      setAttendances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [studentId]);

  const handleMark = async (mealType: string) => {
    setMarking(mealType);
    try {
      await MessAttendanceAPI.markAttendance(studentId, mealType);
      Swal.fire({
        title: 'Meal Verified!',
        html: `<b>${mealType}</b> check-in successful.<br/>Have a great meal!`,
        icon: 'success',
        confirmButtonColor: '#059669',
        confirmButtonText: 'Done',
        background: '#ffffff',
        customClass: { popup: 'premium-swal-popup' }
      });
      fetchAttendance();
    } catch (err: any) {
      Swal.fire({
        title: 'Oops!',
        text: err.response?.data?.message || `Failed to mark ${mealType}`,
        icon: 'error',
        confirmButtonColor: '#e11d48',
        customClass: { popup: 'premium-swal-popup' }
      });
    } finally {
      setMarking(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '30px 20px', textAlign: 'center', color: '#64748b', fontSize: '14px', fontWeight: 500 }}>
        Loading meal schedule...
      </div>
    );
  }

  const now = new Date();
  const timeValue = now.getHours() + (now.getMinutes() / 60);

  return (
    <div className="mess-attendance-wrapper" style={{ paddingBottom: '16px' }}>
      <style>{`
        .meals-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .neat-meal-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 16px;
          border-radius: 16px;
          background: #ffffff;
          border: 1px solid #f1f5f9;
          box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .neat-meal-card:hover {
          box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.08);
        }

        .neat-meal-card.card-active {
          background: #ffffff;
          border: 1.5px solid #fdba74;
          box-shadow: 0 4px 20px -3px rgba(249, 115, 22, 0.15);
        }

        .neat-meal-card.card-completed {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .neat-meal-card.card-muted {
          background: #ffffff;
          border: 1px solid #f1f5f9;
          opacity: 0.78;
        }

        .neat-meal-left {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
        }

        .neat-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }

        .neat-meal-title {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.2px;
          line-height: 1.25;
        }

        .neat-meal-time {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
          margin-top: 3px;
        }

        .neat-meal-right {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          margin-left: 8px;
        }

        /* Check In Button */
        .neat-checkin-btn {
          border: none;
          color: #ffffff;
          padding: 8px 16px;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.2px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .neat-checkin-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }

        .neat-checkin-btn:active {
          transform: scale(0.97);
        }

        .neat-checkin-btn:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        /* Status Pills */
        .neat-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-weight: 700;
          font-size: 11.5px;
          letter-spacing: 0.3px;
          padding: 6px 12px;
          border-radius: 9999px;
          white-space: nowrap;
        }

        .neat-pill-completed {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .neat-pill-upcoming {
          background: #f1f5f9;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .neat-pill-closed {
          background: #ffe4e6;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        /* Mobile specific clean polish */
        @media (max-width: 480px) {
          .meals-container {
            gap: 8px;
          }

          .neat-meal-card {
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 10px 12px;
            border-radius: 14px;
          }

          .neat-meal-left {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
            flex: 1;
          }

          .neat-icon-box {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            flex-shrink: 0;
          }

          .neat-meal-title {
            font-size: 14px;
          }

          .neat-meal-time {
            font-size: 11px;
            gap: 4px;
          }

          .neat-meal-right {
            display: flex;
            align-items: center;
            flex-shrink: 0;
            margin-left: 8px;
          }

          .neat-checkin-btn {
            padding: 7px 13px;
            font-size: 12px;
            gap: 5px;
          }

          .neat-pill {
            padding: 5px 10px;
            font-size: 10.5px;
            gap: 4px;
          }
        }
      `}</style>

      <div className="meals-container">
        {meals.map(meal => {
          const markedRecord = attendances.find(a => a.mealType === meal.name);
          const isMarked = !!markedRecord;
          const isBeforeTime = timeValue < meal.start;
          const isTimeOver = timeValue > meal.end;
          const isAvailableNow = !isBeforeTime && !isTimeOver;
          const MealIcon = meal.icon;

          let cardClass = 'neat-meal-card';
          if (isMarked) cardClass += ' card-completed';
          else if (isAvailableNow) cardClass += ' card-active';
          else cardClass += ' card-muted';

          return (
            <div key={meal.name} className={cardClass}>
              {/* Left Section: Icon & Info */}
              <div className="neat-meal-left">
                <div
                  className="neat-icon-box"
                  style={{
                    background: meal.gradient,
                    boxShadow: `0 4px 12px -2px ${meal.shadow}`
                  }}
                >
                  <MealIcon size={20} strokeWidth={2.4} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="neat-meal-title">{meal.name}</div>
                  <div className="neat-meal-time">
                    <Clock size={12} strokeWidth={2.4} style={{ flexShrink: 0, opacity: 0.75 }} />
                    <span>{meal.displayTime}</span>
                  </div>
                </div>
              </div>

              {/* Right Section: In the exact same row */}
              <div className="neat-meal-right">
                {isMarked ? (
                  <div className="neat-pill neat-pill-completed">
                    <Check size={13} strokeWidth={3} />
                    <span>COMPLETED</span>
                  </div>
                ) : isBeforeTime ? (
                  <div className="neat-pill neat-pill-upcoming">
                    <Clock size={12} strokeWidth={2.4} />
                    <span>UPCOMING</span>
                  </div>
                ) : isTimeOver ? (
                  <div className="neat-pill neat-pill-closed">
                    <AlertCircle size={12} strokeWidth={2.4} />
                    <span>CLOSED</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleMark(meal.name)}
                    disabled={marking === meal.name}
                    className="neat-checkin-btn"
                    style={{
                      background: meal.gradient,
                      boxShadow: `0 4px 14px -3px ${meal.shadow}`
                    }}
                  >
                    <CheckCircle2 size={15} strokeWidth={2.6} />
                    <span>{marking === meal.name ? 'Checking In...' : 'Check In Now'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

