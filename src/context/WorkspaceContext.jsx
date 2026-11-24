import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { workspaceApi } from '../services/workspaceApi.js';
import { useAuth } from './AuthContext.jsx';

const WorkspaceContext = createContext(null);

const TRANSLATIONS = {
  en: {
    nav_dashboard: 'Dashboard',
    nav_businesses: 'Create Forms',
    nav_customers: 'Register Forms',
    nav_records: 'Records',
    nav_reports: 'Reports',
    nav_profile: 'Profile',
    nav_settings: 'Settings',
    nav_help: 'Help & Support',
    nav_logout: 'Sign Out',
    search_placeholder: 'Search businesses, records, tickets (Ctrl+K)',
    active_businesses: 'Active Businesses',
    total_customers: 'Customer Records',
    total_revenue: 'Total Collected',
    today_registrations: "Today's Registrations",
  },
  te: {
    nav_dashboard: 'డాష్‌బోర్డ్',
    nav_businesses: 'ఫారమ్‌లను సృష్టించండి',
    nav_customers: 'ఫారమ్‌లను నమోదు చేయండి',
    nav_records: 'రికార్డులు',
    nav_reports: 'నివేదికలు',
    nav_profile: 'ప్రొఫైల్',
    nav_settings: 'సెట్టింగ్‌లు',
    nav_help: 'సహాయం & మద్దతు',
    nav_logout: 'సైన్ అవుట్',
    search_placeholder: 'వ్యాపారాలు, రికార్డులు, టికెట్లను శోధించండి (Ctrl+K)',
    active_businesses: 'క్రియాశీల వ్యాపారాలు',
    total_customers: 'కస్టమర్ రికార్డులు',
    total_revenue: 'మొత్తం వసూలు',
    today_registrations: 'నేటి నమోదులు',
  },
};

const DEFAULT_SETTINGS = {
  language: 'en',
  phoneAlerts: true,
  emailReceipts: true,
  twoFactorOtp: false,
  dailyBackup: true,
  lastBackupAt: null,
};

export function WorkspaceProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [deletedBusinesses, setDeletedBusinesses] = useState([]);
  const [records, setRecords] = useState([]);
  const [recycleBin, setRecycleBin] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoadedOnceRef = useRef(false);

  const refreshAll = useCallback(
    async ({ silent = false } = {}) => {
      if (!isAuthenticated) {
        hasLoadedOnceRef.current = false;
        setBusinesses([]);
        setDeletedBusinesses([]);
        setRecords([]);
        setRecycleBin([]);
        setTickets([]);
        setSettings(DEFAULT_SETTINGS);
        setError('');
        setLoading(false);
        return;
      }
      if (!hasLoadedOnceRef.current && !silent) {
        setLoading(true);
      }
      setError('');
      try {
        const [bizRes, deletedBizRes, recRes, binRes, setRes, tickRes] = await Promise.all([
          workspaceApi.getBusinesses(),
          workspaceApi.getDeletedBusinesses(),
          workspaceApi.getRecords(),
          workspaceApi.getRecycleBin(),
          workspaceApi.getSettings(),
          workspaceApi.getTickets(),
        ]);
        setBusinesses(bizRes.businesses || []);
        setDeletedBusinesses(deletedBizRes.businesses || []);
        setRecords(recRes.records || []);
        setRecycleBin(binRes.records || []);
        if (setRes.settings) setSettings(setRes.settings);
        setTickets(tickRes.tickets || []);
        hasLoadedOnceRef.current = true;
      } catch (err) {
        setError(err.message || 'Unable to load workspace data.');
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const lang = settings?.language === 'te' ? 'te' : 'en';
  const t = useCallback(
    (key) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key,
    [lang]
  );

  const value = {
    businesses,
    setBusinesses,
    deletedBusinesses,
    setDeletedBusinesses,
    records,
    setRecords,
    recycleBin,
    setRecycleBin,
    tickets,
    setTickets,
    settings,
    setSettings,
    loading,
    error,
    refreshAll,
    t,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
