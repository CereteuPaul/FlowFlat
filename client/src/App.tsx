import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, setToken, clearToken, getToken } from './api/client';
import {
  Home,
  LogOut,
  KeyRound,
  Users,
  PlusCircle,
  CheckCircle2,
  Clock,
  UserPlus,
  Check,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  Sparkles,
  Receipt,
  Calendar,
  Copy,
  Wifi,
  CreditCard,
  PhoneCall,
  ShieldCheck,
  Pin,
  ShoppingCart,
  FileText,
  ListTodo,
  Bell,
  RefreshCw,
  PieChart as PieIcon,
  CheckCheck,
  ChevronDown,
  Eye,
  EyeOff,
  Menu,
} from 'lucide-react';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Household {
  id: string;
  name: string;
  inviteCode: string;
  users?: Member[];
}

interface HouseholdMembership {
  id: string;
  role: string;
  household: {
    id: string;
    name: string;
    inviteCode: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
  status: string;
  householdId?: string | null;
  activeHouseholdId?: string | null;
  activeHousehold?: {
    id: string;
    name: string;
    inviteCode: string;
  } | null;
  household?: {
    id: string;
    name: string;
    inviteCode: string;
    users: any[];
  } | null;
  memberships?: HouseholdMembership[]; // <-- Add this
}

interface JoinRequest {
  id: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatCurrency(amount: number, currencyCode: string = 'EUR'): string {
  const symbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    RON: 'RON ',
  };
  const symbol = symbols[currencyCode.toUpperCase()] || `${currencyCode} `;
  return `${symbol}${amount.toFixed(2)}`;
}

function toDateTimeLocalValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function getScheduleOccurrences(
  entry: any,
  rangeStart: Date,
  rangeEnd: Date
): any[] {
  const occurrences: any[] = [];
  const firstStart = new Date(entry.startTime);
  const firstEnd = new Date(entry.endTime);
  const duration = firstEnd.getTime() - firstStart.getTime();
  const recurrenceEnd = entry.recurrenceEnd
    ? new Date(entry.recurrenceEnd)
    : rangeEnd;
  const cursor = new Date(firstStart);
  let guard = 0;

  while (cursor <= rangeEnd && cursor <= recurrenceEnd && guard < 400) {
    const occurrenceEnd = new Date(cursor.getTime() + duration);
    if (occurrenceEnd >= rangeStart) {
      occurrences.push({ ...entry, occurrenceStart: new Date(cursor), occurrenceEnd });
    }

    if (entry.recurrence === 'ONCE') break;
    if (entry.recurrence === 'WEEKLY') cursor.setDate(cursor.getDate() + 7);
    else if (entry.recurrence === 'BIWEEKLY') cursor.setDate(cursor.getDate() + 14);
    else if (entry.recurrence === 'MONTHLY') cursor.setMonth(cursor.getMonth() + 1);
    else break;
    guard += 1;
  }

  return occurrences;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Leave Household Modal States
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [successorId, setSuccessorId] = useState('');

  const [showHouseholdMenu, setShowHouseholdMenu] = useState(false);
  const householdDropdownRef = useRef<HTMLDivElement>(null);
  const mobileHouseholdDropdownRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Top header tab controller
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'chores'
    | 'waste'
    | 'notes'
    | 'home-info'
    | 'bills'
    | 'members'
    | 'schedule'
  >('overview');

  const [notes, setNotes] = useState<any[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<any[]>([]);
  const [scheduleReminders, setScheduleReminders] = useState<any[]>([]);
  const [scheduleView, setScheduleView] = useState<'month' | 'week'>('month');
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleType, setScheduleType] = useState<'AVAILABILITY' | 'CHORE'>(
    'AVAILABILITY'
  );
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleLocation, setScheduleLocation] = useState('');
  const [scheduleAvailability, setScheduleAvailability] = useState('AVAILABLE');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduleRecurrence, setScheduleRecurrence] = useState('ONCE');
  const [scheduleRecurrenceEnd, setScheduleRecurrenceEnd] = useState('');
  const [scheduleMemberId, setScheduleMemberId] = useState('');
  const [selectedNoteCategory, setSelectedNoteCategory] = useState<
    'ALL' | 'SHOPPING' | 'HOUSE_SUPPLIES' | 'GENERAL'
  >('ALL');

  // Modal States for Notes
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState('SHOPPING');
  const [noteContent, setNoteContent] = useState('');
  const [checklistItems, setChecklistItems] = useState<
    { id: string; text: string; isChecked: boolean }[]
  >([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [noteIsPinned, setNoteIsPinned] = useState(false);

  const [homeInfos, setHomeInfos] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Home Info Modal States
  const [infoTitle, setInfoTitle] = useState('');
  const [infoCategory, setInfoCategory] = useState('WIFI');
  const [infoContent, setInfoContent] = useState('');
  const [infoSecretValue, setInfoSecretValue] = useState('');
  const [isHomeInfoModalOpen, setIsHomeInfoModalOpen] = useState(false);

  // Live Household Data
  const [chores, setChores] = useState<any[]>([]);
  const [wasteSchedules, setWasteSchedules] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalChores: 0,
    completedChores: 0,
    choreRate: 100,
    pendingTasksCount: 0,
    nextWaste: null as any,
  });

  const [billCurrency, setBillCurrency] = useState('EUR');
  const [billIsRecurring, setBillIsRecurring] = useState(false);
  const [billRecurrence, setBillRecurrence] = useState('MONTHLY');
  const [billDateInput, setBillDateInput] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [billDueDateInput, setBillDueDateInput] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [billSelectedMembers, setBillSelectedMembers] = useState<string[]>([]);
  const [remindFeedback, setRemindFeedback] = useState<string | null>(null);

  // Calendar month state for Waste tab
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // Modal State for + New Activity
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activityType, setActivityType] = useState<'chore' | 'waste' | 'bill'>(
    'chore'
  );
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newPriority, setNewPriority] = useState('AUTO');
  const [newChoreDueDate, setNewChoreDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().split('T')[0];
  });
  const [newAssignee, setNewAssignee] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newWasteDay, setNewWasteDay] = useState(1);
  const [newWasteColor, setNewWasteColor] = useState('#EAB308');

  const [isJoinOrCreateModalOpen, setIsJoinOrCreateModalOpen] = useState(false);
  const [newHouseholdMode, setNewHouseholdMode] = useState<'create' | 'join'>(
    'create'
  );
  const [extraHouseholdName, setExtraHouseholdName] = useState('');
  const [extraInviteCode, setExtraInviteCode] = useState('');

  // Auth & Onboarding States
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(
    null
  );
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] =
    useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] =
    useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewConfirmPassword, setShowNewConfirmPassword] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [householdError, setHouseholdError] = useState('');
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('resetToken');
    if (resetToken) {
      setPasswordResetToken(resetToken);
      setLoading(false);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    if (params.get('verified') === 'true') {
      setAuthSuccess('Email verified successfully! You can now log in.');
      setIsRegister(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    loadProfile();
  }, []);

  function WorkloadPieChart({
    chores,
    members,
  }: {
    chores: any[];
    members: Member[];
  }) {
    const total = chores.length;
    if (total === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-slate-500 text-xs">
          No active tasks to display in chart
        </div>
      );
    }

    // Count chores per member
    const memberCounts: Record<
      string,
      { name: string; count: number; color: string }
    > = {};
    const palette = [
      '#06B6D4',
      '#10B981',
      '#F59E0B',
      '#8B5CF6',
      '#EC4899',
      '#3B82F6',
    ];

    members.forEach((m, idx) => {
      memberCounts[m.id] = {
        name: m.name.split(' ')[0],
        count: 0,
        color: palette[idx % palette.length],
      };
    });

    chores.forEach((c) => {
      if (c.assignedToId && memberCounts[c.assignedToId]) {
        memberCounts[c.assignedToId].count += 1;
      }
    });

    const radius = 38;
    const circumference = 2 * Math.PI * radius; // ~238.76
    let accumulatedPercent = 0;

    const segments = Object.values(memberCounts).map((item) => {
      const percent = total > 0 ? item.count / total : 0;
      const strokeDasharray = `${percent * circumference} ${circumference}`;
      const strokeDashoffset = -(accumulatedPercent * circumference);
      accumulatedPercent += percent;
      return {
        ...item,
        percent: Math.round(percent * 100),
        strokeDasharray,
        strokeDashoffset,
      };
    });

    return (
      <div className="flex items-center gap-6">
        {/* SVG Donut Ring */}
        <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
          <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#161F30"
              strokeWidth="12"
            />
            {/* Dynamic segments */}
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            ))}
          </svg>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-bold text-slate-400">Total</span>
            <span className="text-base font-black text-white">{total}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-1.5 flex-1 min-w-[120px]">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-slate-300 font-medium">{seg.name}</span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">
                {seg.count} ({seg.percent}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  async function handleDeleteChore(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm('Delete this chore?')) return;
    try {
      await apiFetch(`/dashboard/chores/${id}`, { method: 'DELETE' });
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function loadProfile() {
    try {
      const data = await apiFetch('/auth/me');
      setCurrentUser(data.user);

      if (!data.user.householdId) {
        // Still no household assigned — check if a join request is waiting
        const reqData = await apiFetch('/households/my-request');
        if (reqData.pendingRequest) {
          setPendingApproval(reqData.pendingRequest.household.name);
        } else {
          setPendingApproval(null);
        }
      } else {
        // User has been approved and belongs to a household!
        setPendingApproval(null); // <-- Resets the pending screen

        if (data.user.role === 'HOUSEHOLD_ADMIN') {
          await loadPendingRequests();
        }
        await loadDashboardSummary();
        await loadSchedule();
      }
    } catch {
      clearToken();
      setCurrentUser(null);
      setPendingApproval(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboardSummary() {
    try {
      const data = await apiFetch('/dashboard/summary');
      setChores(data.chores);
      setWasteSchedules(data.wasteSchedules);
      setBills(data.bills);
      setHomeInfos(data.homeInfos || []);
      setNotes(data.notes || []);
      setStats(data.stats);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadSchedule() {
      try {
        const data = await apiFetch('/schedule');
        setScheduleEntries(data.entries || []);
        setScheduleReminders(data.reminders || []);
      } catch (err) {
        console.error(err);
      }
    }

  function openScheduleModal(type: 'AVAILABILITY' | 'CHORE' = 'AVAILABILITY') {
      const start = new Date();
      start.setMinutes(0, 0, 0);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      setScheduleType(type);
      setScheduleTitle('');
      setScheduleNotes('');
      setScheduleLocation('');
      setScheduleAvailability('AVAILABLE');
      setScheduleStart(toDateTimeLocalValue(start));
      setScheduleEnd(toDateTimeLocalValue(end));
      setScheduleRecurrence('ONCE');
      setScheduleRecurrenceEnd('');
      setScheduleMemberId(currentUser?.id || '');
      setIsScheduleModalOpen(true);
    }

  async function handleCreateScheduleEntry(e: React.FormEvent) {
      e.preventDefault();
      try {
        await apiFetch('/schedule', {
          method: 'POST',
          body: JSON.stringify({
            memberId: scheduleMemberId || currentUser?.id,
            type: scheduleType,
            title: scheduleTitle,
            notes: scheduleNotes,
            location: scheduleLocation,
            availability: scheduleAvailability,
            startTime: new Date(scheduleStart).toISOString(),
            endTime: new Date(scheduleEnd).toISOString(),
            recurrence: scheduleRecurrence,
            recurrenceEnd: scheduleRecurrenceEnd
              ? new Date(`${scheduleRecurrenceEnd}T23:59:59`).toISOString()
              : null,
          }),
        });
        setIsScheduleModalOpen(false);
        await loadSchedule();
      } catch (err: any) {
        alert(err.message);
      }
    }

  async function handleAddChoreToSchedule(choreId: string) {
      try {
        await apiFetch(`/schedule/from-chore/${choreId}`, { method: 'POST' });
        await loadSchedule();
      } catch (err: any) {
        alert(err.message);
      }
    }

  async function handleScheduleStatus(id: string, status: string) {
      try {
        await apiFetch(`/schedule/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        await loadSchedule();
      } catch (err: any) {
        alert(err.message);
      }
    }

  async function handleScheduleReminder(id: string) {
      try {
        const data = await apiFetch(`/schedule/${id}/remind`, { method: 'POST' });
        alert(
          data.emailSent
            ? 'Reminder sent in-app and by email.'
            : 'In-app reminder sent. Email delivery is not configured.'
        );
        await loadSchedule();
      } catch (err: any) {
        alert(err.message);
      }
    }
  async function handleToggleSplit(splitId: string) {
    try {
      await apiFetch(`/dashboard/bills/splits/${splitId}/toggle`, {
        method: 'PATCH',
      });
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSendBillReminder(billId: string) {
    try {
      const res = await apiFetch(`/dashboard/bills/${billId}/remind`, {
        method: 'POST',
      });
      setRemindFeedback(res.message);
      setTimeout(() => setRemindFeedback(null), 3500);
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeleteBill(billId: string) {
    if (!window.confirm('Delete this bill and its associated splits?')) return;
    try {
      await apiFetch(`/dashboard/bills/${billId}`, { method: 'DELETE' });
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function handleAddChecklistItem() {
    if (!newChecklistText.trim()) return;
    setChecklistItems([
      ...checklistItems,
      {
        id: Date.now().toString(),
        text: newChecklistText.trim(),
        isChecked: false,
      },
    ]);
    setNewChecklistText('');
  }

  function handleRemoveChecklistItem(id: string) {
    setChecklistItems(checklistItems.filter((item) => item.id !== id));
  }

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/dashboard/notes', {
        method: 'POST',
        body: JSON.stringify({
          title: noteTitle,
          category: noteCategory,
          content: noteContent,
          items: checklistItems,
          isPinned: noteIsPinned,
        }),
      });

      setIsNoteModalOpen(false);
      setNoteTitle('');
      setNoteContent('');
      setChecklistItems([]);
      setNewChecklistText('');
      setNoteIsPinned(false);
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleRemoveMember(targetUserId: string, targetName: string) {
    if (
      !window.confirm(
        `Are you sure you want to remove ${targetName} from the flat?`
      )
    )
      return;
    try {
      const res = await apiFetch(`/households/members/${targetUserId}`, {
        method: 'DELETE',
      });
      alert(res.message);
      await loadProfile();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleJoinOrCreateExtraHousehold(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (newHouseholdMode === 'create') {
        await apiFetch('/households/create', {
          method: 'POST',
          body: JSON.stringify({ name: extraHouseholdName }),
        });
      } else {
        await apiFetch('/households/join', {
          method: 'POST',
          body: JSON.stringify({ inviteCode: extraInviteCode }),
        });
      }
      setIsJoinOrCreateModalOpen(false);
      setExtraHouseholdName('');
      setExtraInviteCode('');
      await loadProfile();
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    }
  }

  async function handleLeaveHousehold() {
    const otherMembers = (currentUser?.household?.users || []).filter(
      (u) => u.id !== currentUser?.id
    );
    const needsSuccessor =
      currentUser?.role === 'HOUSEHOLD_ADMIN' && otherMembers.length > 0;

    if (needsSuccessor && !successorId) {
      alert(
        'Please select a successor to become the new Flat Admin before leaving.'
      );
      return;
    }

    if (
      !window.confirm(
        'Are you sure you want to leave this household? You will need an invite code to rejoin.'
      )
    ) {
      return;
    }

    try {
      await apiFetch('/households/leave', {
        method: 'POST',
        body: JSON.stringify({ successorUserId: successorId || undefined }),
      });
      setIsLeaveModalOpen(false);
      setSuccessorId('');
      // Reload profile: currentUser.householdId becomes null, presenting the onboarding screen
      await loadProfile();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleToggleChecklistItem(noteId: string, itemId: string) {
    try {
      await apiFetch(`/dashboard/notes/${noteId}/toggle-item`, {
        method: 'PATCH',
        body: JSON.stringify({ itemId }),
      });
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleTogglePinNote(noteId: string) {
    try {
      await apiFetch(`/dashboard/notes/${noteId}/pin`, { method: 'PATCH' });
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!window.confirm('Delete this note?')) return;
    try {
      await apiFetch(`/dashboard/notes/${noteId}`, { method: 'DELETE' });
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleCreateHomeInfo(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/dashboard/home-info', {
        method: 'POST',
        body: JSON.stringify({
          title: infoTitle,
          category: infoCategory,
          content: infoContent,
          secretValue: infoSecretValue,
        }),
      });
      setIsHomeInfoModalOpen(false);
      setInfoTitle('');
      setInfoContent('');
      setInfoSecretValue('');
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeleteHomeInfo(id: string) {
    if (!window.confirm('Delete this home information entry?')) return;
    try {
      await apiFetch(`/dashboard/home-info/${id}`, { method: 'DELETE' });
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function loadPendingRequests() {
    try {
      const data = await apiFetch('/households/requests');
      setPendingRequests(data.requests || []);
    } catch (err) {
      console.error(err);
    }
  }

  // Close household dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        (!householdDropdownRef.current ||
          !householdDropdownRef.current.contains(target)) &&
        (!mobileHouseholdDropdownRef.current ||
          !mobileHouseholdDropdownRef.current.contains(target))
      ) {
        setShowHouseholdMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  async function handleSwitchHousehold(householdId: string) {
    try {
      await apiFetch('/households/switch-active', {
        method: 'PATCH',
        body: JSON.stringify({ householdId }),
      });
      setShowHouseholdMenu(false);
      await loadProfile();
      await loadDashboardSummary();
      await loadSchedule();
    } catch (err: any) {
      alert(err.message || 'Failed to switch household.');
    }
  }

  async function handleCreateActivity(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (activityType === 'chore') {
        const assignee = newAssignee || currentUser?.id;
        await apiFetch('/dashboard/chores', {
          method: 'POST',
          body: JSON.stringify({
            title: newTitle,
            assignedToId: assignee,
            notes: newNotes,
            priority: newPriority,
            dueDate: newChoreDueDate,
          }),
        });
      } else if (activityType === 'waste') {
        await apiFetch('/dashboard/waste', {
          method: 'POST',
          body: JSON.stringify({
            wasteType: newTitle,
            colorTag: newWasteColor,
            dayOfWeek: newWasteDay,
          }),
        });
      } else if (activityType === 'bill') {
        await apiFetch('/dashboard/bills', {
          method: 'POST',
          body: JSON.stringify({
            title: newTitle,
            amount: newAmount,
            currency: billCurrency,
            isRecurring: billIsRecurring,
            recurrence: billRecurrence,
            billDate: billDateInput,
            dueDate: billDueDateInput,
            selectedUserIds: billSelectedMembers,
          }),
        });
      }

      setIsModalOpen(false);
      setNewTitle('');
      setNewNotes('');
      setNewAmount('');
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleToggleChore(id: string) {
    try {
      await apiFetch(`/dashboard/chores/${id}/toggle`, { method: 'PATCH' });
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handlePutOutWaste(id: string) {
    try {
      await apiFetch(`/dashboard/waste/${id}/put-out`, { method: 'PATCH' });
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      if (isRegister) {
        const data = await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, confirmPassword }),
        });
        setAuthSuccess(data.message);
        setIsRegister(false);
      } else {
        const data = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setToken(data.token);
        setCurrentUser(data.user);
        if (data.user.householdId) {
          await loadDashboardSummary();
        }

      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      const data = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setAuthSuccess(data.message);
    } catch (err: any) {
      setAuthError(err.message);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      const data = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: passwordResetToken,
          password: resetPassword,
          confirmPassword: resetConfirmPassword,
        }),
      });
      setPasswordResetToken(null);
      setResetPassword('');
      setResetConfirmPassword('');
      setAuthSuccess(data.message);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      setAuthError(err.message);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setPasswordChangeSuccess('');
    try {
      const data = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          password: newPassword,
          confirmPassword: newConfirmPassword,
        }),
      });
      setIsChangePasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setNewConfirmPassword('');
      setShowNewPassword(false);
      setShowNewConfirmPassword(false);
      setPasswordChangeSuccess(data.message);
    } catch (err: any) {
      setAuthError(err.message);
    }
  }

  async function handleCreateHousehold(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/households/create', {
        method: 'POST',
        body: JSON.stringify({ name: householdName }),
      });
      await loadProfile();
    } catch (err: any) {
      setHouseholdError(err.message);
    }
  }

  async function handleJoinHousehold(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiFetch('/households/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: inviteCodeInput }),
      });
      setPendingApproval(res.householdName || 'the flat');
    } catch (err: any) {
      setHouseholdError(err.message);
    }
  }

  async function handleDeleteWaste(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!window.confirm('Remove this waste routine?')) return;
    try {
      await apiFetch(`/dashboard/waste/${id}`, { method: 'DELETE' });
      await loadDashboardSummary();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function BillsPieChart({
    bills,
    members,
  }: {
    bills: any[];
    members: Member[];
  }) {
    const activeBills = bills.filter((b) => !b.isSettled);
    const totalAmount = activeBills.reduce(
      (acc, b) => acc + (b.amount || 0),
      0
    );

    if (activeBills.length === 0 || totalAmount === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-slate-500 text-xs">
          No active expenses pending settlement.
        </div>
      );
    }

    // Calculate Recurring vs One-Time Split
    const recurringTotal = activeBills
      .filter((b) => b.isRecurring)
      .reduce((acc, b) => acc + b.amount, 0);
    const oneTimeTotal = totalAmount - recurringTotal;

    const recPercent = Math.round((recurringTotal / totalAmount) * 100);
    const oneTimePercent = 100 - recPercent;

    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const recOffset = (recPercent / 100) * circumference;

    return (
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
          <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#161F30"
              strokeWidth="12"
            />
            {/* Recurring segment (Cyan) */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#06B6D4"
              strokeWidth="12"
              strokeDasharray={`${recOffset} ${circumference}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
            {/* One-time segment (Amber) */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#F59E0B"
              strokeWidth="12"
              strokeDasharray={`${circumference - recOffset} ${circumference}`}
              strokeDashoffset={-recOffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-slate-400 font-bold uppercase">
              Pending
            </span>
            <span className="text-xs font-black text-white">
              {activeBills.length} Bills
            </span>
          </div>
        </div>

        <div className="space-y-2 flex-1 w-full">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="text-slate-300 font-medium">
                Recurring Subscriptions
              </span>
            </div>
            <span className="text-slate-300 font-mono text-[11px] font-bold">
              {recPercent}%
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-slate-300 font-medium">
                One-Time Shared Bills
              </span>
            </div>
            <span className="text-slate-300 font-mono text-[11px] font-bold">
              {oneTimePercent}%
            </span>
          </div>

          {/* <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
            <span>Active Total Volume:</span>
            <span className="text-white font-mono font-bold">
              {formatCurrency(totalAmount, activeBills[0]?.currency || 'EUR')}
            </span>
          </div> */}
        </div>
      </div>
    );
  }

  async function handleReviewRequest(
    requestId: string,
    action: 'APPROVE' | 'REJECT'
  ) {
    try {
      const assignedRole = selectedRoles[requestId] || 'MEMBER';
      await apiFetch(`/households/requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, assignedRole }),
      });
      await loadPendingRequests();
      await loadProfile();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleChangeRole(targetUserId: string, newRole: string) {
    try {
      await apiFetch(`/households/members/${targetUserId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ newRole }),
      });
      await loadProfile();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function handleLogout() {
    clearToken();
    setCurrentUser(null);
    setPendingApproval(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070A0F] flex items-center justify-center text-slate-400 font-sans">
        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Loading FlowFlat...</span>
      </div>
    );
  }

  if (passwordResetToken) {
    return (
      <div className="min-h-screen bg-[#070A0F] p-4 flex flex-col items-center justify-center font-sans">
        <div className="max-w-md w-full bg-[#0F141E] border border-slate-800/80 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#131A27] rounded-2xl border border-slate-800 text-cyan-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Reset password</h1>
              <p className="text-xs text-slate-400">
                Choose a new FlowFlat password.
              </p>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {authError}
            </div>
          )}
          {authSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              {authSuccess}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="relative">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                New password
              </label>
              <input
                required
                type={showResetPassword ? 'text' : 'password'}
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Min 8 chars, 1 uppercase, 1 symbol"
                className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() => setShowResetPassword((value) => !value)}
                className="absolute right-3 bottom-2.5 text-slate-500 hover:text-slate-300"
                aria-label="Toggle new password visibility"
              >
                {showResetPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="relative">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirm new password
              </label>
              <input
                required
                type={showResetConfirmPassword ? 'text' : 'password'}
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() =>
                  setShowResetConfirmPassword((value) => !value)
                }
                className="absolute right-3 bottom-2.5 text-slate-500 hover:text-slate-300"
                aria-label="Toggle password confirmation visibility"
              >
                {showResetConfirmPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold rounded-xl text-xs"
            >
              Reset password
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#070A0F] p-4 flex flex-col items-center justify-center font-sans">
        <div className="max-w-md w-full bg-[#0F141E] border border-slate-800/80 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#131A27] rounded-2xl border border-slate-800 text-cyan-400">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                FlowFlat
              </h1>
              <p className="text-xs text-slate-400">
                Shared Flat Command Center
              </p>
            </div>
          </div>

          <div className="flex bg-[#070A0F] p-1.5 rounded-2xl mb-6 border border-slate-800/60">
            <button
              onClick={() => {
                setIsRegister(false);
                setIsForgotPassword(false);
                setAuthError('');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
                !isRegister
                  ? 'bg-[#1F293D] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => {
                setIsRegister(true);
                setIsForgotPassword(false);
                setAuthError('');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
                isRegister
                  ? 'bg-[#1F293D] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {authError}
            </div>
          )}

          {authSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          {!isForgotPassword && (
            <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 symbol"
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-95 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-cyan-500/10 mt-2"
            >
              {isRegister ? 'Create Account' : 'Sign In'}
            </button>
            </form>
          )}

          {!isRegister && !isForgotPassword && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  or
                </span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setAuthError('');
                  setAuthSuccess('');
                }}
                className="w-full text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
              >
                Forgot your password?
              </button>
            </>
          )}

          {isForgotPassword && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">
                  Forgot your password?
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter your account email and we will send you a secure reset link.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Account email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold rounded-xl text-xs"
              >
                Send reset link
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setAuthError('');
                  setAuthSuccess('');
                }}
                className="w-full text-xs text-slate-400 hover:text-white"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-[#070A0F] p-4 flex flex-col items-center justify-center font-sans">
        <div className="max-w-md w-full bg-[#0F141E] border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">
            Join Request Pending
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Your request to join{' '}
            <span className="font-semibold text-white">{pendingApproval}</span>{' '}
            is waiting for admin approval.
          </p>
          <button
            onClick={() => loadProfile()}
            className="w-full py-2.5 bg-[#1F293D] border border-slate-700 hover:border-slate-500 text-white rounded-xl text-xs font-semibold mb-3 cursor-pointer"
          >
            Check Status
          </button>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Log out for now
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser.householdId) {
    return (
      <div className="min-h-screen bg-[#070A0F] p-4 flex flex-col items-center justify-center font-sans">
        <div className="max-w-xl w-full bg-[#0F141E] border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">
                Welcome, {currentUser.name}!
              </h2>
              <p className="text-xs text-slate-400">
                Set up or join your flat to enter the command center.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400"
            >
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#131A27] p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 w-fit mb-4">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Create a Household
                </h3>
                <p className="text-xs text-slate-400 mb-5">
                  Start fresh as Flat Admin and get a shareable code.
                </p>
                <form onSubmit={handleCreateHousehold}>
                  <input
                    type="text"
                    required
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                    placeholder="e.g. Apartment 4B"
                    className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 mb-3"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs hover:opacity-90"
                  >
                    Create Flat
                  </button>
                </form>
              </div>
            </div>

            <div className="bg-[#131A27] p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit mb-4">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Join with Code
                </h3>
                <p className="text-xs text-slate-400 mb-5">
                  Enter the 6-character code given by your flatmate.
                </p>
                <form onSubmit={handleJoinHousehold}>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={inviteCodeInput}
                    onChange={(e) =>
                      setInviteCodeInput(e.target.value.toUpperCase())
                    }
                    placeholder="e.g. F96F44"
                    className="w-full tracking-widest font-mono uppercase bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 mb-3 text-center"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs hover:opacity-90"
                  >
                    Request to Join
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isRestricted = currentUser.role === 'RESTRICTED_MEMBER';
  const isAdmin = currentUser.role === 'HOUSEHOLD_ADMIN';

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells = [];

  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  const scheduleMonthStart = new Date(
    scheduleDate.getFullYear(),
    scheduleDate.getMonth(),
    1
  );
  const scheduleGridStart = new Date(scheduleMonthStart);
  scheduleGridStart.setDate(
    scheduleGridStart.getDate() - scheduleGridStart.getDay()
  );
  const scheduleGridDays = Array.from({ length: scheduleView === 'month' ? 42 : 7 }, (_, index) => {
    const day = new Date(scheduleGridStart);
    if (scheduleView === 'week') {
      day.setDate(scheduleDate.getDate() - scheduleDate.getDay() + index);
    } else {
      day.setDate(scheduleGridStart.getDate() + index);
    }
    return day;
  });
  const scheduleRangeStart = scheduleGridDays[0];
  const scheduleRangeEnd = new Date(scheduleGridDays[scheduleGridDays.length - 1]);
  scheduleRangeEnd.setHours(23, 59, 59, 999);
  const scheduleOccurrences = scheduleEntries.flatMap((entry) =>
    getScheduleOccurrences(entry, scheduleRangeStart, scheduleRangeEnd)
  );
  const householdMembers = currentUser.household?.users || [];

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col p-4 md:p-8 gap-6 font-sans selection:bg-cyan-500/30 max-w-7xl mx-auto w-full">
      {/* 1. TOP HEADER WITH CENTRAL TABS & LOGOUT */}
      <header className="bg-[#0F141E] border border-slate-800/80 rounded-3xl px-4 py-3 min-[1440px]:px-6 min-[1440px]:py-4 flex items-center justify-between shadow-2xl">
        <button
          type="button"
          aria-label="Go to overview"
          onClick={() => {
            setActiveTab('overview');
            setIsMobileMenuOpen(false);
          }}
          className="flex items-center gap-3 min-[1440px]:hidden"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/10">
            <Home className="w-5 h-5" />
          </div>
          <span className="text-sm font-bold text-white">FlowFlat</span>
        </button>

        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen(true)}
          className="min-[1440px]:hidden flex items-center justify-center w-10 h-10 rounded-xl border border-slate-800 bg-[#131A27] text-slate-300 hover:text-white hover:border-slate-700 transition"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden min-[1440px]:flex items-center gap-3">
          <button
            type="button"
            aria-label="Go to overview"
            onClick={() => setActiveTab('overview')}
            className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/10 hover:scale-105 transition"
          >
            <Home className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              {/* <span className="font-bold text-white text-sm tracking-tight">
                {currentUser.household?.name}
              </span> */}
              <div className="relative" ref={householdDropdownRef}>
                <button
                  onClick={() => setShowHouseholdMenu(!showHouseholdMenu)}
                  className="flex items-center gap-2 bg-[#131A27] px-3.5 py-2 rounded-2xl border border-slate-800 hover:border-slate-700 transition"
                >
                  <Home className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold text-white">
                    {currentUser?.household?.name ||
                      currentUser?.activeHousehold?.name ||
                      'My Household'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showHouseholdMenu && (
                  <div className="absolute left-0 mt-2 w-56 bg-[#0F141E] border border-slate-800 rounded-2xl shadow-2xl p-2 z-50">
                    <span className="text-[10px] font-bold text-slate-500 uppercase px-3 py-1 block">
                      My Households
                    </span>

                    {currentUser?.memberships?.map((m) => (
                      <button
                        key={m.household.id}
                        onClick={() => handleSwitchHousehold(m.household.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                          m.household.id === currentUser.activeHouseholdId
                            ? 'bg-cyan-500/10 text-cyan-400 font-bold'
                            : 'text-slate-300 hover:bg-[#161F30]'
                        }`}
                      >
                        <span>{m.household.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {m.role === 'HOUSEHOLD_ADMIN' ? 'Admin' : 'Member'}
                        </span>
                      </button>
                    ))}

                    <div className="border-t border-slate-800 mt-2 pt-2">
                      <button
                        onClick={() => {
                          setShowHouseholdMenu(false);
                          setIsJoinOrCreateModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cyan-400 hover:bg-cyan-500/10 rounded-xl font-medium transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Join / Create Another Flat</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                {currentUser.household?.inviteCode}
              </span>
            </div>
          </div>
        </div>

        <nav className="hidden min-[1440px]:flex items-center gap-1 bg-[#131A27] p-1.5 rounded-2xl border border-slate-800/60">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'chores', label: 'Chores' },
            { id: 'waste', label: 'Waste' },
            { id: 'notes', label: 'Notes' },
            { id: 'home-info', label: 'Home Info' },
            ...(!isRestricted ? [{ id: 'bills', label: 'Bills' }] : []),
            { id: 'members', label: 'Members' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 font-bold shadow-md shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="hidden min-[1440px]:flex items-center gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((value) => !value)}
              aria-label="Open profile menu"
              aria-expanded={isProfileMenuOpen}
              className="flex items-center gap-3 rounded-2xl hover:bg-[#131A27] p-1.5 transition"
            >
              <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold text-xs flex items-center justify-center shadow-inner">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-white leading-tight">
                  {currentUser.name}
                </p>
                <p className="text-[10px] text-cyan-400 font-medium">
                  {currentUser.role === 'HOUSEHOLD_ADMIN'
                    ? 'Flat Admin'
                    : currentUser.role === 'RESTRICTED_MEMBER'
                      ? 'Restricted'
                      : 'Flatmate'}
                </p>
              </div>
            </button>
            {isProfileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-[#0F141E] border border-slate-800 rounded-2xl shadow-2xl p-2 z-50">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setPasswordChangeSuccess('');
                    setAuthError('');
                    setIsChangePasswordModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-[#161F30] hover:text-white"
                >
                  Change password
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10"
                >
                  Log out
                </button>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-800" />
        </div>
      </header>

      {passwordChangeSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{passwordChangeSuccess}</span>
        </div>
      )}

      {isMobileMenuOpen && (
        <div className="min-[1440px]:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm cursor-default"
          />

          <aside
            aria-label="Mobile navigation"
            className="relative h-full w-[min(86vw,22rem)] bg-[#0F141E] border-r border-slate-800 shadow-2xl p-5 flex flex-col overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-bold text-white">Menu</span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-800 bg-[#131A27] text-slate-300 hover:text-white hover:border-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="relative" ref={mobileHouseholdDropdownRef}>
                <button
                  onClick={() => setShowHouseholdMenu(!showHouseholdMenu)}
                  className="w-full flex items-center gap-2 bg-[#131A27] px-3.5 py-3 rounded-2xl border border-slate-800 hover:border-slate-700 transition text-left"
                >
                  <Home className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold text-white truncate">
                    {currentUser?.household?.name ||
                      currentUser?.activeHousehold?.name ||
                      'My Household'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto" />
                </button>

                {showHouseholdMenu && (
                  <div className="mt-2 w-full bg-[#131A27] border border-slate-800 rounded-2xl shadow-2xl p-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase px-3 py-1 block">
                      My Households
                    </span>
                    {currentUser?.memberships?.map((m) => (
                      <button
                        key={m.household.id}
                        onClick={() => {
                          setShowHouseholdMenu(false);
                          handleSwitchHousehold(m.household.id);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                          m.household.id === currentUser.activeHouseholdId
                            ? 'bg-cyan-500/10 text-cyan-400 font-bold'
                            : 'text-slate-300 hover:bg-[#161F30]'
                        }`}
                      >
                        <span>{m.household.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {m.role === 'HOUSEHOLD_ADMIN' ? 'Admin' : 'Member'}
                        </span>
                      </button>
                    ))}
                    <div className="border-t border-slate-800 mt-2 pt-2">
                      <button
                        onClick={() => {
                          setShowHouseholdMenu(false);
                          setIsMobileMenuOpen(false);
                          setIsJoinOrCreateModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cyan-400 hover:bg-cyan-500/10 rounded-xl font-medium transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Join / Create Another Flat</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <nav className="flex flex-col gap-1 bg-[#131A27] p-1.5 rounded-2xl border border-slate-800/60">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'chores', label: 'Chores' },
                  { id: 'waste', label: 'Waste' },
                  { id: 'notes', label: 'Notes' },
                  { id: 'home-info', label: 'Home Info' },
                  ...(!isRestricted ? [{ id: 'bills', label: 'Bills' }] : []),
                  { id: 'members', label: 'Members' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-xs font-semibold rounded-xl transition cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 font-bold shadow-md shadow-cyan-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((value) => !value)}
                  aria-label="Open profile menu"
                  aria-expanded={isProfileMenuOpen}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#131A27] text-left"
                >
                  <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold text-xs flex items-center justify-center shadow-inner">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white leading-tight">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-cyan-400 font-medium">
                      {currentUser.role === 'HOUSEHOLD_ADMIN'
                        ? 'Flat Admin'
                        : currentUser.role === 'RESTRICTED_MEMBER'
                          ? 'Restricted'
                          : 'Flatmate'}
                    </p>
                  </div>
                </button>
                {isProfileMenuOpen && (
                  <div className="mt-2 bg-[#131A27] border border-slate-800 rounded-2xl shadow-2xl p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsMobileMenuOpen(false);
                        setPasswordChangeSuccess('');
                        setAuthError('');
                        setIsChangePasswordModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-[#1B2638] hover:text-white"
                    >
                      Change password
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 2. DYNAMIC TAB VIEW CANVAS */}
      <main className="flex-1 space-y-6">
        {/* ==================== VIEW 1: OVERVIEW (READ-ONLY OBSERVATIONAL SUMMARY) ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick alert if requests are pending */}
            {isAdmin && pendingRequests.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-xs font-bold text-white">
                      {pendingRequests.length} Roommate{' '}
                      {pendingRequests.length === 1 ? 'Request' : 'Requests'}{' '}
                      Pending
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Approve or decline prospective flatmates.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('members')}
                  className="px-3 py-1.5 bg-amber-400 text-slate-950 font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer"
                >
                  Review Requests
                </button>
              </div>
            )}
            {/* Top Readiness, Donut Chart, and Next Collection Snapshot */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Card 1: Readiness & Progress */}
              <div className="bg-[#0F141E] border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-slate-400">
                      Household Readiness
                    </span>
                    <span className="text-xs font-mono text-cyan-400 px-2.5 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      Live
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 mb-2">
                    <h3 className="text-3xl font-black text-white tracking-tight">
                      {stats.pendingTasksCount} Tasks
                    </h3>
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5" /> All synced
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {stats.completedChores} of {stats.totalChores} chores
                    completed this cycle.
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Weekly Progress</span>
                    <span className="text-white font-semibold">
                      {stats.choreRate}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#182133] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 transition-all duration-500"
                      style={{ width: `${stats.choreRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Workload Distribution Pie / Donut Chart */}
              <div className="bg-[#0F141E] border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-slate-400">
                      Workload Distribution
                    </span>
                    <span className="text-xs font-mono text-purple-400 px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      Chores Share
                    </span>
                  </div>

                  <WorkloadPieChart
                    chores={chores}
                    members={currentUser.household?.users || []}
                  />
                </div>

                <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-800/80 text-center">
                  Fair-share ratio among registered occupants
                </p>
              </div>

              {/* Card 3: Weekly Waste Collection Schedule */}
              <div className="bg-[#0F141E] border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-slate-400">
                      Weekly Waste Schedule
                    </span>
                    <span className="text-xs font-bold text-amber-400 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      {wasteSchedules.length}{' '}
                      {wasteSchedules.length === 1 ? 'Routine' : 'Routines'}
                    </span>
                  </div>

                  {wasteSchedules.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      No bins configured yet. Switch to the Waste tab to add
                      routines.
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-[175px] overflow-y-auto pr-1">
                      {[...wasteSchedules]
                        .sort((a, b) => {
                          const today = new Date().getDay();
                          const diffA = (a.dayOfWeek - today + 7) % 7;
                          const diffB = (b.dayOfWeek - today + 7) % 7;
                          return diffA - diffB;
                        })
                        .map((w) => {
                          const today = new Date().getDay();
                          const daysUntil = (w.dayOfWeek - today + 7) % 7;
                          const relativeDay =
                            daysUntil === 0
                              ? 'Today'
                              : daysUntil === 1
                                ? 'Tomorrow'
                                : `In ${daysUntil} days`;

                          return (
                            <div
                              key={w.id}
                              className="p-3 rounded-2xl bg-[#161F30] border border-slate-800/60 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0"
                                  style={{
                                    backgroundColor: `${w.colorTag}20`,
                                    color: w.colorTag,
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white leading-tight">
                                    {w.wasteType}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    Every {DAYS[w.dayOfWeek]}
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                                  daysUntil <= 1
                                    ? 'bg-amber-500/20 text-amber-400 font-bold'
                                    : 'bg-[#0E1523] text-slate-400'
                                }`}
                              >
                                {relativeDay}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setActiveTab('waste')}
                    className="w-full py-2 bg-[#172030] hover:bg-[#1E293D] border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Manage Waste Calendar</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Suggestive Chores Status Snapshot */}
            <div className="bg-[#0F141E] border border-slate-800/80 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Active Chores Snapshot
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {chores.filter((c) => !c.lastCompletedAt).length} pending
                      • {chores.filter((c) => c.lastCompletedAt).length}{' '}
                      completed
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('chores')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition cursor-pointer flex items-center gap-1"
                >
                  <span>Manage Chores</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {chores.filter((c) => !c.lastCompletedAt).length === 0 ? (
                <div className="p-6 text-center bg-[#131A27]/50 rounded-2xl border border-slate-800/60 text-slate-400 text-xs">
                  ✨ No pending chores! The household is all caught up.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {chores
                    .filter((c) => !c.lastCompletedAt)
                    .map((chore) => {
                      const priorityToDisplay =
                        chore.effectivePriority || chore.priority || 'MEDIUM';
                      const dueDateObj = new Date(chore.dueDate);
                      const now = new Date();
                      const diffMs = dueDateObj.getTime() - now.getTime();
                      const diffDays = Math.ceil(diffMs / (1000 * 3600 * 24));

                      let dueText = '';
                      let dueColor = 'text-slate-400';
                      if (diffDays < 0) {
                        dueText = 'Overdue';
                        dueColor = 'text-rose-400 font-bold';
                      } else if (diffDays === 0) {
                        dueText = 'Due today';
                        dueColor = 'text-rose-400 font-bold';
                      } else if (diffDays === 1) {
                        dueText = 'Due tomorrow';
                        dueColor = 'text-amber-400 font-medium';
                      } else {
                        dueText = `Due in ${diffDays}d`;
                      }

                      return (
                        <div
                          key={chore.id}
                          className="p-4 rounded-2xl border border-slate-800 bg-[#131A27] flex flex-col justify-between hover:border-slate-700/80 transition"
                        >
                          <div>
                            {/* Priority + Relative Due Timing */}
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                    priorityToDisplay === 'HIGH'
                                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                      : priorityToDisplay === 'LOW'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}
                                >
                                  {priorityToDisplay}
                                </span>
                                {chore.priority === 'AUTO' && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-cyan-400 text-[8px] font-mono">
                                    AUTO
                                  </span>
                                )}
                              </div>

                              <span
                                className={`text-[10px] font-mono ${dueColor}`}
                              >
                                {dueText}
                              </span>
                            </div>

                            <p className="text-xs font-bold text-white mb-1.5 truncate">
                              {chore.title}
                            </p>

                            {chore.notes && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 italic bg-[#0A0E17]/60 px-2 py-1 rounded-lg border border-slate-800/40 mb-2">
                                "{chore.notes}"
                              </p>
                            )}
                          </div>

                          {/* Assignee Footer */}
                          <div className="pt-2.5 mt-2 border-t border-slate-800/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center">
                                {chore.assignedTo?.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[11px] text-slate-300 font-medium truncate">
                                {chore.assignedTo?.name}
                              </span>
                            </div>

                            <span className="text-[10px] font-mono text-slate-500">
                              {dueDateObj.toLocaleDateString(undefined, {
                                month: 'numeric',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Suggestive Waste Schedule Snapshot */}
            <div className="bg-[#0F141E] border border-slate-800/80 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Waste & Recycling Routines
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {wasteSchedules.length} recurring collection{' '}
                      {wasteSchedules.length === 1 ? 'routine' : 'routines'}{' '}
                      active
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('waste')}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition cursor-pointer flex items-center gap-1"
                >
                  <span>Manage Waste Calendar</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {wasteSchedules.length === 0 ? (
                <div className="p-6 text-center bg-[#131A27]/50 rounded-2xl border border-slate-800/60 text-slate-400 text-xs">
                  No waste routines configured yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[...wasteSchedules]
                    .sort((a, b) => {
                      const today = new Date().getDay();
                      const diffA = (a.dayOfWeek - today + 7) % 7;
                      const diffB = (b.dayOfWeek - today + 7) % 7;
                      return diffA - diffB;
                    })
                    .map((w) => {
                      const today = new Date().getDay();
                      const daysUntil = (w.dayOfWeek - today + 7) % 7;
                      const relativeDay =
                        daysUntil === 0
                          ? 'Today'
                          : daysUntil === 1
                            ? 'Tomorrow'
                            : `In ${daysUntil} days`;

                      return (
                        <div
                          key={w.id}
                          className="p-3.5 rounded-2xl border border-slate-800 bg-[#131A27] flex items-center justify-between hover:border-slate-700/80 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0"
                              style={{
                                backgroundColor: `${w.colorTag}20`,
                                color: w.colorTag,
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white leading-tight">
                                {w.wasteType}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Every {DAYS[w.dayOfWeek]}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                              daysUntil <= 1
                                ? 'bg-amber-500/20 text-amber-400 font-bold'
                                : 'bg-[#0E1523] text-slate-400'
                            }`}
                          >
                            {relativeDay}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Suggestive Bills Snapshot (Hidden for Restricted Members) */}
            {!isRestricted && (
              <div className="bg-[#0F141E] border border-slate-800/80 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Shared Bills Ledger
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {bills.length} shared{' '}
                        {bills.length === 1 ? 'expense' : 'expenses'} tracked
                        across flatmates
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('bills')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition cursor-pointer flex items-center gap-1"
                  >
                    <span>Manage Bills</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {bills.length === 0 ? (
                  <div className="p-6 text-center bg-[#131A27]/50 rounded-2xl border border-slate-800/60 text-slate-400 text-xs">
                    No active bills logged.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {bills.map((bill) => (
                      <div
                        key={bill.id}
                        className="p-4 rounded-2xl border border-slate-800 bg-[#131A27] flex flex-col justify-between hover:border-slate-700/80 transition"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-bold text-white truncate">
                              {bill.title}
                            </p>
                            <span className="text-xs font-black text-cyan-400">
                              {formatCurrency(bill.amount, bill.currency)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mb-3">
                            Paid by {bill.paidBy.name}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1 pt-2.5 border-t border-slate-800/60">
                          {bill.splits.map((split: any) => (
                            <span
                              key={split.id}
                              className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                split.isPaid
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {split.user.name.split(' ')[0]}:{' '}
                              {formatCurrency(split.amountOwed, bill.currency)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Suggestive Household Occupants Snapshot */}
            <div className="bg-[#0F141E] border border-slate-800/80 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Household Occupants
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {currentUser.household?.users?.length || 1} registered
                      flat{' '}
                      {currentUser.household?.users?.length === 1
                        ? 'member'
                        : 'members'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('members')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition cursor-pointer flex items-center gap-1"
                >
                  <span>Manage Flatmates</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {currentUser.household?.users?.map((member) => (
                  <div
                    key={member.id}
                    className="p-3.5 rounded-2xl border border-slate-800 bg-[#131A27] flex items-center justify-between hover:border-slate-700/80 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold text-xs flex items-center justify-center">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white">
                            {member.name}
                          </p>
                          {member.id === currentUser.id && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate max-w-[140px]">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        member.role === 'HOUSEHOLD_ADMIN'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          : member.role === 'RESTRICTED_MEMBER'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {member.role === 'HOUSEHOLD_ADMIN'
                        ? 'Admin'
                        : member.role === 'RESTRICTED_MEMBER'
                          ? 'Restricted'
                          : 'Member'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-6">
            <section className="bg-[#0F141E] border border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-black text-white">Shared Schedule</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Availability and household duties for everyone in the flat.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openScheduleModal()}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    Add availability
                  </button>
                  <button
                    type="button"
                    onClick={() => openScheduleModal('CHORE')}
                    className="px-3 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white"
                  >
                    Add schedule item
                  </button>
                  <div className="flex bg-[#131A27] p-1 rounded-xl border border-slate-800">
                    {(['month', 'week'] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setScheduleView(view)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize ${
                          scheduleView === view
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400'
                        }`}
                      >
                        {view}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {scheduleReminders.length > 0 && (
                <div className="mb-5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[11px] font-bold text-amber-300 mb-2">
                    Reminders for you
                  </p>
                  <div className="space-y-1.5">
                    {scheduleReminders.map((reminder) => (
                      <button
                        key={reminder.id}
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/schedule/reminders/${reminder.id}/read`, {
                            method: 'PATCH',
                          });
                          await loadSchedule();
                        }}
                        className="block text-left text-xs text-amber-100 hover:text-white"
                      >
                        {reminder.sender?.name || 'A household member'} reminded you about{' '}
                        <strong>{reminder.scheduleEntry.title}</strong>. Click to dismiss.
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(scheduleDate);
                    next.setDate(next.getDate() - (scheduleView === 'month' ? 1 : 7));
                    setScheduleDate(next);
                  }}
                  className="p-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white"
                  aria-label="Previous period"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-sm font-bold text-white">
                  {scheduleDate.toLocaleString('default', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(scheduleDate);
                    next.setDate(next.getDate() + (scheduleView === 'month' ? 1 : 7));
                    setScheduleDate(next);
                  }}
                  className="p-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white"
                  aria-label="Next period"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-2xl overflow-hidden border border-slate-800">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="bg-[#131A27] p-2 text-[10px] font-bold text-slate-500 uppercase">
                    {day}
                  </div>
                ))}
                {scheduleGridDays.map((day) => {
                  const dayEntries = scheduleOccurrences.filter((entry) => {
                    const start = entry.occurrenceStart as Date;
                    return (
                      start.getFullYear() === day.getFullYear() &&
                      start.getMonth() === day.getMonth() &&
                      start.getDate() === day.getDate()
                    );
                  });
                  const isCurrentMonth = day.getMonth() === scheduleDate.getMonth();
                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-28 bg-[#0F141E] p-2 align-top ${
                        !isCurrentMonth ? 'opacity-40' : ''
                      }`}
                    >
                      <span className={`text-[11px] font-bold ${day.toDateString() === new Date().toDateString() ? 'text-cyan-400' : 'text-slate-400'}`}>
                        {day.getDate()}
                      </span>
                      <div className="space-y-1 mt-1">
                        {dayEntries.map((entry, index) => (
                          <div
                            key={`${entry.id}-${index}`}
                            className={`rounded-lg px-2 py-1.5 border text-[10px] ${
                              entry.type === 'CHORE'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                                : entry.availability === 'BUSY'
                                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                                  : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-200'
                            }`}
                          >
                            <p className="font-bold truncate">{entry.title}</p>
                            <p className="truncate opacity-80">
                              {entry.member?.name} · {entry.occurrenceStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </p>
                            {entry.memberId === currentUser.id && (
                              <select
                                value={entry.status}
                                onChange={(event) => handleScheduleStatus(entry.id, event.target.value)}
                                className="mt-1 w-full bg-[#070A0F]/70 rounded px-1 py-0.5 text-[9px] text-slate-200"
                              >
                                <option value="PENDING">Pending</option>
                                <option value="IN_PROGRESS">In progress</option>
                                <option value="COMPLETED">Completed</option>
                              </select>
                            )}
                            {entry.memberId !== currentUser.id && entry.status !== 'COMPLETED' && (
                              <button
                                type="button"
                                onClick={() => handleScheduleReminder(entry.id)}
                                className="mt-1 text-[9px] underline opacity-80 hover:opacity-100"
                              >
                                Remind
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-[#0F141E] border border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Add existing chores</h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Place assigned chores on the shared calendar.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {chores.map((chore) => {
                  const isScheduled = scheduleEntries.some((entry) => entry.chore?.id === chore.id);
                  return (
                    <div key={chore.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#131A27] border border-slate-800">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{chore.title}</p>
                        <p className="text-[10px] text-slate-500">{chore.assignedTo?.name}</p>
                      </div>
                      <button
                        type="button"
                        disabled={isScheduled}
                        onClick={() => handleAddChoreToSchedule(chore.id)}
                        className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-slate-700 text-slate-300 disabled:opacity-40"
                      >
                        {isScheduled ? 'On calendar' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {isScheduleModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close schedule form"
              onClick={() => setIsScheduleModalOpen(false)}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            />
            <form
              onSubmit={handleCreateScheduleEntry}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0F141E] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">New schedule entry</h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Add availability or a custom household schedule item.
                  </p>
                </div>
                <button type="button" onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['AVAILABILITY', 'CHORE'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setScheduleType(type)}
                    className={`py-2 rounded-xl text-xs font-semibold border ${
                      scheduleType === type
                        ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    {type === 'AVAILABILITY' ? 'Availability' : 'Schedule item'}
                  </button>
                ))}
              </div>

              <label className="block text-xs text-slate-300">
                Title
                <input
                  required
                  value={scheduleTitle}
                  onChange={(event) => setScheduleTitle(event.target.value)}
                  placeholder={scheduleType === 'AVAILABILITY' ? 'Available for flat matters' : 'Gym, appointment, study time'}
                  className="mt-1 w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </label>

              {scheduleType === 'AVAILABILITY' && (
                <label className="block text-xs text-slate-300">
                  Availability
                  <select
                    value={scheduleAvailability}
                    onChange={(event) => setScheduleAvailability(event.target.value)}
                    className="mt-1 w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="BUSY">Busy</option>
                  </select>
                </label>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs text-slate-300">
                  Start
                  <input required type="datetime-local" value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} className="mt-1 w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
                </label>
                <label className="block text-xs text-slate-300">
                  End
                  <input required type="datetime-local" value={scheduleEnd} onChange={(event) => setScheduleEnd(event.target.value)} className="mt-1 w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs text-slate-300">
                  Repeats
                  <select value={scheduleRecurrence} onChange={(event) => setScheduleRecurrence(event.target.value)} className="mt-1 w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
                    <option value="ONCE">One time</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Every 2 weeks</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-300">
                  Repeat until (optional)
                  <input type="date" value={scheduleRecurrenceEnd} onChange={(event) => setScheduleRecurrenceEnd(event.target.value)} className="mt-1 w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
                </label>
              </div>

              <label className="block text-xs text-slate-300">
                Member
                <select value={scheduleMemberId} onChange={(event) => setScheduleMemberId(event.target.value)} className="mt-1 w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
                  <option value={currentUser.id}>Me ({currentUser.name})</option>
                  {householdMembers.filter((member: any) => member.id !== currentUser.id).map((member: any) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs text-slate-300">
                  Notes
                  <input value={scheduleNotes} onChange={(event) => setScheduleNotes(event.target.value)} className="mt-1 w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
                </label>
                <label className="block text-xs text-slate-300">
                  Location
                  <input value={scheduleLocation} onChange={(event) => setScheduleLocation(event.target.value)} className="mt-1 w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
                </label>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 text-xs font-bold">
                Save schedule entry
              </button>
            </form>
          </div>
        )}

        {/* ==================== VIEW 2: CHORES (DETAILED & INTERACTIVE) ==================== */}
        {/* ==================== VIEW 2: CHORES TAB ==================== */}
        {/* ==================== VIEW 2: CHORES TAB ==================== */}
        {activeTab === 'chores' && (
          <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Chores Management
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Assigned responsibilities, dynamic priorities, and completion
                  history.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivityType('chore');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-400 text-slate-950 font-bold text-xs rounded-2xl hover:opacity-90 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Chore</span>
              </button>
            </div>

            {/* 1. ACTIVE TASKS SECTION */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Active Tasks (
                  {chores.filter((c) => !c.lastCompletedAt).length})
                </h3>
              </div>

              {chores.filter((c) => !c.lastCompletedAt).length === 0 ? (
                <div className="p-8 text-center bg-[#0F141E] border border-slate-800 rounded-3xl text-slate-400 text-xs">
                  🎉 All chores are completed! Tap "Add Chore" to schedule a new
                  one.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {chores
                    .filter((c) => !c.lastCompletedAt)
                    .map((chore) => {
                      const priorityToDisplay =
                        chore.effectivePriority || chore.priority || 'MEDIUM';
                      const dueDateObj = new Date(chore.dueDate);
                      const now = new Date();
                      const diffMs = dueDateObj.getTime() - now.getTime();
                      const diffDays = Math.ceil(diffMs / (1000 * 3600 * 24));

                      let dueText = '';
                      if (diffDays < 0) dueText = 'Overdue';
                      else if (diffDays === 0) dueText = 'Due today';
                      else if (diffDays === 1) dueText = 'Due tomorrow';
                      else dueText = `Due in ${diffDays} days`;

                      return (
                        <div
                          key={chore.id}
                          className="p-5 rounded-3xl border border-slate-800 bg-[#0F141E] transition hover:border-slate-700 flex flex-col justify-between"
                        >
                          <div>
                            {/* Top row: Priority badge + Due text + Delete trash button */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                    priorityToDisplay === 'HIGH'
                                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                      : priorityToDisplay === 'LOW'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}
                                >
                                  {priorityToDisplay}
                                </span>
                                {chore.priority === 'AUTO' && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 font-medium">
                                    Auto
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[11px] font-mono ${
                                    diffDays <= 1
                                      ? 'text-rose-400 font-bold'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {dueText}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleDeleteChore(chore.id, e)
                                  }
                                  title="Delete Chore"
                                  className="text-slate-500 hover:text-rose-400 transition cursor-pointer p-1 rounded-lg hover:bg-rose-500/10"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <h4 className="text-sm font-bold text-white mb-1">
                              {chore.title}
                            </h4>

                            {chore.notes && (
                              <p className="text-xs text-slate-400 mb-3 bg-[#131A27] p-2.5 rounded-xl border border-slate-800/60 leading-relaxed">
                                {chore.notes}
                              </p>
                            )}
                          </div>

                          {/* Bottom row: Assignee info + Complete circle button */}
                          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                            <div className="text-[11px] text-slate-400">
                              <p>
                                Assigned to:{' '}
                                <span className="font-semibold text-white">
                                  {chore.assignedTo?.name}
                                </span>
                              </p>
                              <p className="text-[10px] text-slate-500">
                                Target: {dueDateObj.toLocaleDateString()}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleChore(chore.id)}
                              className="p-2 rounded-xl border bg-[#161F30] border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 transition cursor-pointer"
                              title="Mark as Complete"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* 2. COMPLETED HISTORY SECTION */}
            <div className="space-y-3 pt-6 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Completed History (
                  {chores.filter((c) => c.lastCompletedAt).length})
                </h3>
              </div>

              {chores.filter((c) => c.lastCompletedAt).length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  No chores completed yet. Tap the checkmark icon on any active
                  chore to complete it.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {chores
                    .filter((c) => c.lastCompletedAt)
                    .map((chore) => (
                      <div
                        key={chore.id}
                        className="p-4 rounded-2xl border border-slate-800/60 bg-[#0F141E]/50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleChore(chore.id)}
                            title="Re-open task"
                            className="text-emerald-400 hover:text-amber-400 transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                          <div>
                            <p className="text-xs font-bold line-through text-slate-400">
                              {chore.title}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Completed by {chore.assignedTo?.name} •{' '}
                              {new Date(
                                chore.lastCompletedAt
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteChore(chore.id, e)}
                          title="Delete from history"
                          className="text-slate-500 hover:text-rose-400 transition cursor-pointer p-1.5 rounded-lg hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== VIEW 3: WASTE & MULTI-COLOR CALENDAR ==================== */}
        {activeTab === 'waste' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Waste & Recycling Calendar
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Days are colored by scheduled bins. Days with multiple
                  collections render an evenly split gradient.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivityType('waste');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-400 text-slate-950 font-bold text-xs rounded-2xl hover:opacity-90 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Waste Routine</span>
              </button>
            </div>

            {/* Active Bins Legend Bar with Delete Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 bg-[#0F141E] p-4 rounded-3xl border border-slate-800">
              <span className="text-xs font-bold text-slate-400 mr-2 flex items-center">
                Active Bins:
              </span>
              {wasteSchedules.length === 0 ? (
                <span className="text-xs text-slate-500">
                  No active routines configured.
                </span>
              ) : (
                wasteSchedules.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold group transition"
                    style={{
                      backgroundColor: `${w.colorTag}15`,
                      color: w.colorTag,
                      border: `1px solid ${w.colorTag}30`,
                    }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: w.colorTag }}
                    />
                    <span>
                      {w.wasteType} (Every {DAYS[w.dayOfWeek]})
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteWaste(w.id, e)}
                      title="Remove routine"
                      className="ml-1 p-0.5 rounded hover:bg-black/30 transition text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="bg-[#0F141E] border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">
                  {currentCalendarDate.toLocaleString('default', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentCalendarDate(new Date(year, month - 1, 1))
                    }
                    className="p-2 bg-[#131A27] rounded-xl border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentCalendarDate(new Date(year, month + 1, 1))
                    }
                    className="p-2 bg-[#131A27] rounded-xl border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400">
                {DAYS.map((d) => (
                  <div key={d} className="py-2">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((dayNum, idx) => {
                  if (!dayNum) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="h-28 bg-transparent"
                      />
                    );
                  }

                  const thisDate = new Date(year, month, dayNum);
                  const dayOfWeek = thisDate.getDay();
                  const isToday =
                    new Date().toDateString() === thisDate.toDateString();

                  const scheduledBins = wasteSchedules.filter(
                    (w) => w.dayOfWeek === dayOfWeek
                  );

                  let backgroundStyle = {};
                  if (scheduledBins.length === 1) {
                    backgroundStyle = {
                      borderTop: `4px solid ${scheduledBins[0].colorTag}`,
                      backgroundColor: `${scheduledBins[0].colorTag}10`,
                    };
                  } else if (scheduledBins.length > 1) {
                    const colorStops = scheduledBins
                      .map((b, i) => {
                        const start = (i / scheduledBins.length) * 100;
                        const end = ((i + 1) / scheduledBins.length) * 100;
                        return `${b.colorTag} ${start}%, ${b.colorTag} ${end}%`;
                      })
                      .join(', ');
                    backgroundStyle = {
                      background: `linear-gradient(135deg, ${colorStops})`,
                    };
                  }

                  return (
                    <div
                      key={`day-${dayNum}`}
                      className={`h-28 p-2.5 rounded-2xl border flex flex-col justify-between transition ${
                        isToday
                          ? 'border-cyan-400/80 bg-[#172235]'
                          : 'border-slate-800/80 bg-[#121927] hover:border-slate-700'
                      }`}
                      style={backgroundStyle}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold ${
                            isToday
                              ? 'w-6 h-6 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center font-black'
                              : scheduledBins.length > 1
                                ? 'bg-[#070A0F]/80 text-white px-1.5 py-0.5 rounded'
                                : 'text-slate-300'
                          }`}
                        >
                          {dayNum}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {scheduledBins.map((bin) => (
                          <div
                            key={bin.id}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded truncate bg-[#070A0F]/90 text-white border border-slate-700/60"
                          >
                            {bin.wasteType}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== VIEW: NOTES & LISTS ==================== */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Shared Notes & Shopping Lists
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Shared grocery checklists, supplies to restock, and collective
                  apartment ideas.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNoteCategory('SHOPPING');
                  setChecklistItems([]);
                  setIsNoteModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold text-xs rounded-2xl hover:opacity-95 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create Note / List</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-2 border-b border-slate-800 pb-3">
              {[
                { id: 'ALL', label: 'All Notes' },
                { id: 'SHOPPING', label: 'Shopping Lists' },
                { id: 'HOUSE_SUPPLIES', label: 'House Supplies' },
                { id: 'GENERAL', label: 'General Ideas' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedNoteCategory(cat.id as any)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                    selectedNoteCategory === cat.id
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'text-slate-400 hover:text-white bg-[#0F141E] border border-slate-800/80'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Notes Grid */}
            {notes.filter(
              (n) =>
                selectedNoteCategory === 'ALL' ||
                n.category === selectedNoteCategory
            ).length === 0 ? (
              <div className="p-12 text-center bg-[#0F141E] border border-slate-800 rounded-3xl text-slate-400 text-xs">
                No notes or lists found in this category. Click "+ Create Note /
                List" to start one!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notes
                  .filter(
                    (n) =>
                      selectedNoteCategory === 'ALL' ||
                      n.category === selectedNoteCategory
                  )
                  .map((note) => {
                    const badge =
                      note.category === 'SHOPPING'
                        ? {
                            label: 'Shopping List',
                            color:
                              'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                            icon: <ShoppingCart className="w-3.5 h-3.5" />,
                          }
                        : note.category === 'HOUSE_SUPPLIES'
                          ? {
                              label: 'House Supplies',
                              color:
                                'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
                              icon: <ListTodo className="w-3.5 h-3.5" />,
                            }
                          : {
                              label: 'General Note',
                              color:
                                'text-purple-400 border-purple-500/30 bg-purple-500/10',
                              icon: <FileText className="w-3.5 h-3.5" />,
                            };

                    const items = (note.items as any[]) || [];

                    return (
                      <div
                        key={note.id}
                        className={`bg-[#0F141E] border p-5 rounded-3xl flex flex-col justify-between transition ${
                          note.isPinned
                            ? 'border-cyan-500/40 bg-gradient-to-b from-[#111928] to-[#0F141E]'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          {/* Header row: Category Badge + Pin Button + Delete */}
                          <div className="flex items-center justify-between mb-3">
                            <span
                              className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${badge.color}`}
                            >
                              {badge.icon}
                              <span>{badge.label}</span>
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleTogglePinNote(note.id)}
                                title={note.isPinned ? 'Unpin' : 'Pin to top'}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  note.isPinned
                                    ? 'text-cyan-400 bg-cyan-500/10'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note.id)}
                                title="Delete note"
                                className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h4 className="text-sm font-bold text-white mb-2">
                            {note.title}
                          </h4>

                          {/* Free-text description */}
                          {note.content && (
                            <p className="text-xs text-slate-300 bg-[#131A27] p-3 rounded-2xl border border-slate-800/60 leading-relaxed whitespace-pre-wrap mb-3">
                              {note.content}
                            </p>
                          )}

                          {/* Interactive Checklist Items */}
                          {items.length > 0 && (
                            <div className="space-y-1.5 bg-[#090D15] p-3 rounded-2xl border border-slate-800/80">
                              {items.map((item: any) => (
                                <div
                                  key={item.id}
                                  onClick={() =>
                                    handleToggleChecklistItem(note.id, item.id)
                                  }
                                  className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-800/50 transition cursor-pointer select-none"
                                >
                                  <div
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 ${
                                      item.isChecked
                                        ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-black'
                                        : 'border-slate-600 bg-transparent'
                                    }`}
                                  >
                                    {item.isChecked && (
                                      <Check className="w-3 h-3 stroke-[3]" />
                                    )}
                                  </div>
                                  <span
                                    className={`text-xs ${
                                      item.isChecked
                                        ? 'line-through text-slate-500 font-medium'
                                        : 'text-slate-200'
                                    }`}
                                  >
                                    {item.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Note Footer */}
                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>Created by {note.createdBy?.name}</span>
                          <span>
                            {new Date(note.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ==================== VIEW: HOME INFO ==================== */}
        {activeTab === 'home-info' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Home Information & Manual
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Essential flat credentials, utility account info, stopcocks,
                  and landlord contacts.
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => setIsHomeInfoModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold text-xs rounded-2xl hover:opacity-95 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Add Home Info</span>
                </button>
              )}
            </div>

            {/* Quick Stat info banner */}
            <div className="bg-[#0F141E] border border-slate-800/80 p-4 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    Flat Reference Guide
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {isAdmin
                      ? 'You have admin permissions to edit or add credentials.'
                      : 'Managed by Household Admin.'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-xl">
                {homeInfos.length} Entries
              </span>
            </div>

            {homeInfos.length === 0 ? (
              <div className="p-12 text-center bg-[#0F141E] border border-slate-800 rounded-3xl text-slate-400 text-xs">
                {isAdmin
                  ? 'No flat information entries yet. Click "+ Add Home Info" to add Wi-Fi passwords, IBANs, or emergency guides.'
                  : 'Your flat admin has not logged any home credentials yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {homeInfos.map((item) => {
                  const categoryBadge =
                    item.category === 'WIFI'
                      ? {
                          label: 'Wi-Fi & Network',
                          color:
                            'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
                          icon: <Wifi className="w-4 h-4" />,
                        }
                      : item.category === 'PAYMENT'
                        ? {
                            label: 'Banking & Bills',
                            color:
                              'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                            icon: <CreditCard className="w-4 h-4" />,
                          }
                        : item.category === 'EMERGENCY'
                          ? {
                              label: 'Emergency Contact',
                              color:
                                'text-rose-400 border-rose-500/30 bg-rose-500/10',
                              icon: <PhoneCall className="w-4 h-4" />,
                            }
                          : {
                              label: 'Apartment Manual',
                              color:
                                'text-amber-400 border-amber-500/30 bg-amber-500/10',
                              icon: <KeyRound className="w-4 h-4" />,
                            };

                  return (
                    <div
                      key={item.id}
                      className="bg-[#0F141E] border border-slate-800 p-5 rounded-3xl flex flex-col justify-between hover:border-slate-700 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${categoryBadge.color}`}
                          >
                            {categoryBadge.icon}
                            <span>{categoryBadge.label}</span>
                          </span>

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteHomeInfo(item.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-white mb-2">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-300 bg-[#131A27] p-3 rounded-2xl border border-slate-800/60 leading-relaxed whitespace-pre-wrap">
                          {item.content}
                        </p>
                      </div>

                      {item.secretValue && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between bg-[#070A0F] p-2.5 rounded-2xl border border-slate-800/80">
                          <div className="truncate mr-2">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                              Copyable Value
                            </span>
                            <span className="font-mono text-xs text-white font-bold select-all truncate block">
                              {item.secretValue}
                            </span>
                          </div>

                          <button
                            onClick={() =>
                              handleCopy(item.id, item.secretValue)
                            }
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                              copiedId === item.id
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-[#182133] hover:bg-[#1E293D] text-slate-300 border border-slate-700/80'
                            }`}
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== VIEW: BILLS & EXPENSES ==================== */}
        {activeTab === 'bills' && !isRestricted && (
          <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Household Ledger & Shared Bills
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  One-time splits, recurring subscriptions, selective members,
                  and payment reminders.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActivityType('bill');
                  if (currentUser.household?.users) {
                    setBillSelectedMembers(
                      currentUser.household.users.map((u) => u.id)
                    );
                  }
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold text-xs rounded-2xl hover:opacity-95 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Bill</span>
              </button>
            </div>

            {/* Reminder Feedback Banner */}
            {remindFeedback && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 flex items-center gap-2">
                <Bell className="w-4 h-4 animate-bounce" />
                <span>{remindFeedback}</span>
              </div>
            )}

            {/* Breakdown Donut & Summary Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 bg-[#0F141E] border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-400">
                    Expenses Allocation
                  </span>
                  <span className="text-xs font-mono text-cyan-400 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    Live Ledger
                  </span>
                </div>
                <BillsPieChart
                  bills={bills}
                  members={currentUser.household?.users || []}
                />
              </div>

              <div className="bg-[#0F141E] border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block mb-2">
                    Unsettled Splits
                  </span>
                  <h3 className="text-2xl font-black text-white">
                    {bills.filter((b) => !b.isSettled).length} Pending
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {bills.filter((b) => b.isSettled).length} bills fully
                    settled and archived in history.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-[#131A27] border border-slate-800/80 text-[11px] text-slate-400">
                  💡 Members who didn't opt into a bill (e.g., Netflix) are
                  automatically omitted from splits.
                </div>
              </div>
            </div>

            {/* SECTION 1: ACTIVE / UNSETTLED BILLS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Active Bills ({bills.filter((b) => !b.isSettled).length})
                </h3>
              </div>

              {bills.filter((b) => !b.isSettled).length === 0 ? (
                <div className="p-8 text-center bg-[#0F141E] border border-slate-800 rounded-3xl text-slate-400 text-xs">
                  🎉 All shared bills are fully settled!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bills
                    .filter((b) => !b.isSettled)
                    .map((bill) => {
                      // currency handled by formatCurrency

                      const dueDateObj = new Date(bill.dueDate);
                      const isPastDue = dueDateObj.getTime() < Date.now();

                      return (
                        <div
                          key={bill.id}
                          className="bg-[#0F141E] border border-slate-800 p-5 rounded-3xl flex flex-col justify-between hover:border-slate-700 transition"
                        >
                          <div>
                            {/* Card Top: Recurrence badge, Due Date, and Actions */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                    bill.isRecurring
                                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}
                                >
                                  {bill.isRecurring
                                    ? bill.recurrence
                                    : 'One-Time'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-mono ${
                                    isPastDue
                                      ? 'text-rose-400 font-bold'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {isPastDue
                                    ? 'Past Due'
                                    : `Due ${dueDateObj.toLocaleDateString()}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBill(bill.id)}
                                  className="text-slate-500 hover:text-rose-400 p-1"
                                  title="Delete Bill"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-baseline justify-between mb-1">
                              <h4 className="text-sm font-bold text-white">
                                {bill.title}
                              </h4>
                              <span className="text-base font-black text-cyan-400 font-mono">
                                {formatCurrency(bill.amount, bill.currency)}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 mb-3">
                              Paid upfront by{' '}
                              <span className="text-slate-200 font-medium">
                                {bill.paidBy.name}
                              </span>
                            </p>

                            {/* Individual Splits */}
                            <div className="space-y-1.5 pt-3 border-t border-slate-800">
                              <p className="text-[10px] uppercase font-bold text-slate-400">
                                Assigned Splits ({bill.splits.length}):
                              </p>
                              {bill.splits.map((split: any) => (
                                <div
                                  key={split.id}
                                  className="flex items-center justify-between bg-[#131A27] px-3 py-1.5 rounded-xl border border-slate-800/60 text-xs"
                                >
                                  <span className="text-slate-200">
                                    {split.user.name}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] text-slate-400 font-medium">
                                      {formatCurrency(
                                        split.amountOwed,
                                        bill.currency
                                      )}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleSplit(split.id)
                                      }
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                        split.isPaid
                                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                          : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                                      }`}
                                    >
                                      {split.isPaid ? 'Paid' : 'Unpaid'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Remind Button for the Creator */}
                          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">
                              {bill.lastRemindedAt
                                ? `Reminded ${new Date(bill.lastRemindedAt).toLocaleDateString()}`
                                : 'No reminders sent'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSendBillReminder(bill.id)}
                              className="flex items-center gap-1.5 px-3 py-1 bg-[#182233] hover:bg-[#202D42] text-amber-400 border border-amber-500/30 text-[11px] font-semibold rounded-xl transition cursor-pointer"
                            >
                              <Bell className="w-3 h-3" />
                              <span>Remind</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* SECTION 2: PAID BILLS HISTORY */}
            <div className="space-y-4 pt-6 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Settled Bills History (
                  {bills.filter((b) => b.isSettled).length})
                </h3>
              </div>

              {bills.filter((b) => b.isSettled).length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  No fully settled bills archived yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {bills
                    .filter((b) => b.isSettled)
                    .map((bill) => {
                      // currency handled by formatCurrency

                      return (
                        <div
                          key={bill.id}
                          className="p-4 rounded-2xl border border-slate-800/60 bg-[#0F141E]/50 flex items-center justify-between opacity-80 hover:opacity-100 transition"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-300 line-through">
                                {bill.title}
                              </span>
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                Settled
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {formatCurrency(bill.amount, bill.currency)} •
                              Paid by {bill.paidBy.name}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteBill(bill.id)}
                            className="text-slate-600 hover:text-rose-400 p-1 rounded transition"
                            title="Delete Archived Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== VIEW 5: MEMBERS & ACCESS ==================== */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Household Flatmates
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage permissions, invite codes, roles, and occupancy.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-cyan-400 px-3 py-1.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                  Invite Code:{' '}
                  <span className="font-bold">
                    {currentUser.household?.inviteCode}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    const others = (currentUser.household?.users || []).filter(
                      (u) => u.id !== currentUser.id
                    );
                    if (others.length > 0) setSuccessorId(others[0].id);
                    setIsLeaveModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition cursor-pointer"
                >
                  Leave Flat
                </button>
              </div>
            </div>

            {/* PENDING JOIN REQUESTS (ADMIN REVIEW SECTION) */}
            {isAdmin && pendingRequests.length > 0 && (
              <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400">
                    <UserPlus className="w-5 h-5" />
                    <h3 className="text-sm font-bold">
                      Pending Join Requests ({pendingRequests.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-amber-300 font-mono">
                    Action Required
                  </span>
                </div>

                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-2xl bg-[#0F141E] border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">
                          {req.user.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {req.user.email}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Role selection upon approval */}
                        <select
                          value={selectedRoles[req.id] || 'MEMBER'}
                          onChange={(e) =>
                            setSelectedRoles({
                              ...selectedRoles,
                              [req.id]: e.target.value,
                            })
                          }
                          className="bg-[#070A0F] border border-slate-700 text-[11px] text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-400"
                        >
                          <option value="MEMBER">Standard Member</option>
                          <option value="RESTRICTED_MEMBER">
                            Restricted Member
                          </option>
                          <option value="HOUSEHOLD_ADMIN">Admin</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleReviewRequest(req.id, 'APPROVE')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Approve</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReviewRequest(req.id, 'REJECT')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MEMBERS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentUser.household?.users?.map((member) => (
                <div
                  key={member.id}
                  className="bg-[#0F141E] border border-slate-800/80 p-5 rounded-3xl flex items-center justify-between hover:border-slate-700/80 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold text-sm flex items-center justify-center">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-white">
                          {member.name}
                        </p>
                        {member.id === currentUser.id && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-[130px]">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin && member.id !== currentUser.id ? (
                      <>
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleChangeRole(member.id, e.target.value)
                          }
                          className="bg-[#070A0F] border border-slate-800 text-[11px] text-slate-200 rounded-xl px-2 py-1 focus:outline-none focus:border-cyan-400 cursor-pointer"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="RESTRICTED_MEMBER">Restricted</option>
                          <option value="HOUSEHOLD_ADMIN">Admin</option>
                        </select>

                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveMember(member.id, member.name)
                          }
                          title={`Remove ${member.name} from flat`}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                          member.role === 'HOUSEHOLD_ADMIN'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                            : member.role === 'RESTRICTED_MEMBER'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {member.role === 'HOUSEHOLD_ADMIN'
                          ? 'Admin'
                          : member.role === 'RESTRICTED_MEMBER'
                            ? 'Restricted'
                            : 'Member'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 6. LEAVE HOUSEHOLD MODAL */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F141E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">
                Leave Household
              </h3>
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to leave{' '}
                <span className="font-bold text-white">
                  {currentUser.household?.name}
                </span>
                ? You will lose direct access to chores, bins, and ledger items
                until you join or create a new household.
              </p>

              {/* Successor selector if the leaving user is Flat Admin and other members remain */}
              {currentUser.role === 'HOUSEHOLD_ADMIN' &&
                (currentUser.household?.users || []).filter(
                  (u) => u.id !== currentUser.id
                ).length > 0 && (
                  <div className="p-3.5 bg-[#070A0F] border border-amber-500/30 rounded-2xl space-y-2">
                    <p className="text-xs font-semibold text-amber-400">
                      Transfer Flat Administration:
                    </p>
                    <p className="text-[11px] text-slate-400">
                      As the Flat Admin, you must appoint another flatmate to
                      inherit admin privileges before departing.
                    </p>

                    <select
                      value={successorId}
                      onChange={(e) => setSuccessorId(e.target.value)}
                      className="w-full bg-[#131A27] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      {(currentUser.household?.users || [])
                        .filter((u) => u.id !== currentUser.id)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#172030] hover:bg-[#1E293D] text-slate-300 font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLeaveHousehold}
                  className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-rose-500/10"
                >
                  Confirm & Leave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. HOME INFO CREATION MODAL (ADMIN ONLY) */}
      {isHomeInfoModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F141E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-base font-bold text-white">
                Add Home Information
              </h3>
              <button
                onClick={() => setIsHomeInfoModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHomeInfo} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={infoTitle}
                  onChange={(e) => setInfoTitle(e.target.value)}
                  placeholder="e.g. Living Room Wi-Fi or Landlord IBAN"
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={infoCategory}
                  onChange={(e) => setInfoCategory(e.target.value)}
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="WIFI">Wi-Fi & Network</option>
                  <option value="PAYMENT">Banking & Bills (Rent IBAN)</option>
                  <option value="APARTMENT">
                    Apartment Essentials (Stopcock, Keys)
                  </option>
                  <option value="EMERGENCY">
                    Emergency Contacts (Plumber, Landlord)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Notes
                </label>
                <textarea
                  required
                  value={infoContent}
                  onChange={(e) => setInfoContent(e.target.value)}
                  placeholder="e.g. Network name: FiberOptic-5G. Frequency: 5GHz band."
                  rows={3}
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Copyable Key / Password / IBAN{' '}
                  <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={infoSecretValue}
                  onChange={(e) => setInfoSecretValue(e.target.value)}
                  placeholder="e.g. MySuperSecretPass! or RO49AAAA1B31007593840000"
                  className="w-full font-mono bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-95 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-cyan-500/10 mt-3"
              >
                Save Home Information
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. ACTIVITY CREATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F141E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-base font-bold text-white">
                Create Household Activity
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex bg-[#070A0F] p-1 rounded-2xl mb-5 border border-slate-800">
              <button
                type="button"
                onClick={() => setActivityType('chore')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  activityType === 'chore'
                    ? 'bg-[#1F293D] text-white'
                    : 'text-slate-400'
                }`}
              >
                Chore
              </button>
              <button
                type="button"
                onClick={() => setActivityType('waste')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  activityType === 'waste'
                    ? 'bg-[#1F293D] text-white'
                    : 'text-slate-400'
                }`}
              >
                Waste
              </button>
              {!isRestricted && (
                <button
                  type="button"
                  onClick={() => setActivityType('bill')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                    activityType === 'bill'
                      ? 'bg-[#1F293D] text-white'
                      : 'text-slate-400'
                  }`}
                >
                  Bill
                </button>
              )}
            </div>

            <form onSubmit={handleCreateActivity} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {activityType === 'chore'
                    ? 'Chore Title'
                    : activityType === 'waste'
                      ? 'Bin Description'
                      : 'Bill Title'}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    activityType === 'chore'
                      ? 'e.g. Mop Kitchen Floor'
                      : activityType === 'waste'
                        ? 'e.g. Organic / Compost Bin'
                        : 'e.g. Water & Electricity'
                  }
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {activityType === 'chore' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        required
                        value={newChoreDueDate}
                        onChange={(e) => setNewChoreDueDate(e.target.value)}
                        className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Priority
                      </label>
                      <select
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value)}
                        className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                      >
                        <option value="AUTO">Auto (Dynamic)</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High (Urgent)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Assign To
                    </label>
                    <select
                      value={newAssignee}
                      onChange={(e) => setNewAssignee(e.target.value)}
                      className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      {currentUser.household?.users?.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Notes / Instructions
                    </label>
                    <textarea
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="e.g. Use the blue detergent under the sink"
                      rows={2}
                      className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </>
              )}

              {activityType === 'waste' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Collection Day
                    </label>
                    <select
                      value={newWasteDay}
                      onChange={(e) => setNewWasteDay(Number(e.target.value))}
                      className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      {DAYS.map((day, idx) => (
                        <option key={day} value={idx}>
                          Every {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Color Tag
                    </label>
                    <select
                      value={newWasteColor}
                      onChange={(e) => setNewWasteColor(e.target.value)}
                      className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="#EAB308">Yellow (Plastic/Metal)</option>
                      <option value="#3B82F6">Blue (Paper/Cardboard)</option>
                      <option value="#10B981">Green (Organic/Glass)</option>
                      <option value="#64748B">Black (General)</option>
                    </select>
                  </div>
                </div>
              )}

              {activityType === 'bill' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        placeholder="e.g. 35.50"
                        className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Currency
                      </label>
                      <select
                        value={billCurrency}
                        onChange={(e) => setBillCurrency(e.target.value)}
                        className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="RON">RON (lei)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Bill / Invoice Date
                      </label>
                      <input
                        type="date"
                        required
                        value={billDateInput}
                        onChange={(e) => setBillDateInput(e.target.value)}
                        className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        required
                        value={billDueDateInput}
                        onChange={(e) => setBillDueDateInput(e.target.value)}
                        className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  {/* Recurrence Selector */}
                  <div className="bg-[#070A0F] p-3 rounded-2xl border border-slate-800 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billIsRecurring}
                        onChange={(e) => setBillIsRecurring(e.target.checked)}
                        className="rounded accent-cyan-400 w-4 h-4 cursor-pointer"
                      />
                      <span>Recurring Subscription / Utility</span>
                    </label>

                    {billIsRecurring && (
                      <select
                        value={billRecurrence}
                        onChange={(e) => setBillRecurrence(e.target.value)}
                        className="w-full bg-[#131A27] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                      >
                        <option value="MONTHLY">
                          Monthly (e.g. Netflix, Wi-Fi)
                        </option>
                        <option value="WEEKLY">
                          Weekly (e.g. Shared fruit box)
                        </option>
                      </select>
                    )}
                  </div>

                  {/* Selective Flatmate Split Checkboxes */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Include in Bill Split:
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-[#070A0F] p-3 rounded-2xl border border-slate-800 max-h-32 overflow-y-auto">
                      {currentUser.household?.users?.map((u) => {
                        const isSelected = billSelectedMembers.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setBillSelectedMembers([
                                    ...billSelectedMembers,
                                    u.id,
                                  ]);
                                } else {
                                  if (billSelectedMembers.length > 1) {
                                    setBillSelectedMembers(
                                      billSelectedMembers.filter(
                                        (id) => id !== u.id
                                      )
                                    );
                                  }
                                }
                              }}
                              className="rounded accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="truncate">{u.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Uncheck roommates who should not participate in this bill.
                    </p>
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-95 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-cyan-500/10 mt-3"
              >
                Create
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. NOTE CREATION MODAL */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F141E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-base font-bold text-white">
                Create Shared Note / List
              </h3>
              <button
                type="button"
                onClick={() => setIsNoteModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Weekly Groceries or Bathroom Supplies"
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                    className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="SHOPPING">Shopping List</option>
                    <option value="HOUSE_SUPPLIES">House Supplies</option>
                    <option value="GENERAL">General Note</option>
                  </select>
                </div>

                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={noteIsPinned}
                      onChange={(e) => setNoteIsPinned(e.target.checked)}
                      className="rounded accent-cyan-400 w-4 h-4 cursor-pointer"
                    />
                    <span>Pin note to top</span>
                  </label>
                </div>
              </div>

              {/* Checklist builder for shopping and supplies */}
              {noteCategory !== 'GENERAL' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    Add Checklist Items
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChecklistText}
                      onChange={(e) => setNewChecklistText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddChecklistItem();
                        }
                      }}
                      placeholder="e.g. Oat Milk, Dish Soap"
                      className="flex-1 bg-[#070A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={handleAddChecklistItem}
                      className="px-3 py-2 bg-[#1B2433] hover:bg-[#253247] text-cyan-400 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  {checklistItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 max-h-32 overflow-y-auto">
                      {checklistItems.map((item) => (
                        <span
                          key={item.id}
                          className="flex items-center gap-1.5 text-xs bg-[#121927] border border-slate-700/80 px-2.5 py-1 rounded-xl text-slate-200"
                        >
                          <span>{item.text}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveChecklistItem(item.id)}
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Additional Details / Description{' '}
                  <span className="text-slate-500">(Optional)</span>
                </label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="e.g. Please pick up from the Lidl near the station."
                  rows={2}
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-95 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-cyan-500/10 mt-3"
              >
                Create Note / List
              </button>
            </form>
          </div>
        </div>
      )}

      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#0F141E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h3 className="text-base font-bold text-white">
                  Change password
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Use the same password requirements as sign up.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordModalOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close change password dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {authError}
                </div>
              )}
              <label className="block text-xs font-medium text-slate-300">
                Current password
                <input
                  required
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </label>
              <label className="block text-xs font-medium text-slate-300">
                New password
                <div className="relative mt-1">
                  <input
                    required
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 symbol"
                    className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    aria-label="Toggle new password visibility"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </label>
              <label className="block text-xs font-medium text-slate-300">
                Confirm new password
                <div className="relative mt-1">
                  <input
                    required
                    type={showNewConfirmPassword ? 'text' : 'password'}
                    value={newConfirmPassword}
                    onChange={(e) => setNewConfirmPassword(e.target.value)}
                    className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowNewConfirmPassword((value) => !value)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    aria-label="Toggle password confirmation visibility"
                  >
                    {showNewConfirmPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </label>
              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold rounded-xl text-xs"
              >
                Change password
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. JOIN OR CREATE ANOTHER HOUSEHOLD MODAL */}
      {isJoinOrCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F141E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">
                Add Another Household
              </h3>
              <button
                type="button"
                onClick={() => setIsJoinOrCreateModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4 bg-[#070A0F] p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setNewHouseholdMode('create')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  newHouseholdMode === 'create'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create New Flat
              </button>
              <button
                type="button"
                onClick={() => setNewHouseholdMode('join')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  newHouseholdMode === 'join'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Join with Code
              </button>
            </div>

            <form
              onSubmit={handleJoinOrCreateExtraHousehold}
              className="space-y-4"
            >
              {newHouseholdMode === 'create' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Household Name
                  </label>
                  <input
                    type="text"
                    required
                    value={extraHouseholdName}
                    onChange={(e) => setExtraHouseholdName(e.target.value)}
                    placeholder="e.g. Parents Home or Cluj Flat"
                    className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Invite Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={extraInviteCode}
                    onChange={(e) =>
                      setExtraInviteCode(e.target.value.toUpperCase())
                    }
                    placeholder="e.g. A9B2X7"
                    className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase tracking-wider font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-center"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-95 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-cyan-500/10"
              >
                {newHouseholdMode === 'create'
                  ? 'Create & Switch'
                  : 'Request to Join'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. HOME INFO MODAL */}
      {isHomeInfoModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F141E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-base font-bold text-white">
                Add Home Information
              </h3>
              <button
                type="button"
                onClick={() => setIsHomeInfoModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHomeInfo} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={infoTitle}
                  onChange={(e) => setInfoTitle(e.target.value)}
                  placeholder="e.g. Living Room Wi-Fi or Landlord IBAN"
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={infoCategory}
                  onChange={(e) => setInfoCategory(e.target.value)}
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="WIFI">Wi-Fi & Network</option>
                  <option value="PAYMENT">Banking & Bills (Rent IBAN)</option>
                  <option value="APARTMENT">
                    Apartment Essentials (Stopcock, Keys)
                  </option>
                  <option value="EMERGENCY">
                    Emergency Contacts (Plumber, Landlord)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Notes
                </label>
                <textarea
                  required
                  value={infoContent}
                  onChange={(e) => setInfoContent(e.target.value)}
                  placeholder="e.g. Network name: FiberOptic-5G. Frequency: 5GHz band."
                  rows={3}
                  className="w-full bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Copyable Key / Password / IBAN{' '}
                  <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={infoSecretValue}
                  onChange={(e) => setInfoSecretValue(e.target.value)}
                  placeholder="e.g. MySuperSecretPass! or RO49AAAA1B31007593840000"
                  className="w-full font-mono bg-[#070A0F] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-95 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-cyan-500/10 mt-3"
              >
                Save Home Information
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
