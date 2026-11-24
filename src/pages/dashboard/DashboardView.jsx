import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  IndianRupee,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { formatCurrency, getLocalDateString } from '../../utils/exportUtils.js';

export default function DashboardView() {
  const { user } = useAuth();
  const { businesses, records, recycleBin, t } = useWorkspace();

  const activeBusinesses = useMemo(
    () => businesses.filter((b) => !b.archived),
    [businesses]
  );
  const archivedCount = businesses.length - activeBusinesses.length;

  const recordCountByBiz = useMemo(() => {
    const counts = {};
    records.forEach((r) => {
      counts[r.businessId] = (counts[r.businessId] || 0) + 1;
    });
    return counts;
  }, [records]);

  const todayStr = getLocalDateString();

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let todayCount = 0;
    let todayRevenue = 0;
    let cashTotal = 0;
    let onlineTotal = 0;

    records.forEach((r) => {
      const amt = Number(r.payment?.amount) || 0;
      totalRevenue += amt;
      if (r.payment?.method === 'Online') onlineTotal += amt;
      else cashTotal += amt;

      const rawDate = r.payment?.paidAt || r.createdAt || '';
      let dateVal = rawDate.slice(0, 10);
      if (rawDate.includes('T')) {
        const parsed = new Date(rawDate);
        if (!Number.isNaN(parsed.getTime())) dateVal = getLocalDateString(parsed);
      }
      if (dateVal === todayStr) {
        todayCount += 1;
        todayRevenue += amt;
      }
    });

    return { totalRevenue, todayCount, todayRevenue, cashTotal, onlineTotal };
  }, [records, todayStr]);

  const quickLinks = [
    {
      to: '/dashboard/businesses',
      title: 'Create Forms',
      subtitle: `${activeBusinesses.length} active ${activeBusinesses.length === 1 ? 'form' : 'forms'}`,
      icon: Building2,
    },
    {
      to: '/dashboard/customers',
      title: 'Register Forms',
      subtitle: 'Select a saved form and register a customer',
      icon: UserPlus,
    },
    {
      to: '/dashboard/records',
      title: 'Records',
      subtitle: `${records.length} saved customer ${records.length === 1 ? 'record' : 'records'}`,
      icon: ClipboardList,
    },
    {
      to: '/dashboard/reports',
      title: 'Reports',
      subtitle: 'Filter payment totals and export PDF or Excel',
      icon: BarChart3,
    },
  ];

  return (
    <div className="d-flex flex-column gap-3">
      <div className="ff-card p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <h2 className="h5 fw-bold mb-1">Welcome back, {user?.fullName || 'Owner'}</h2>
            <p className="text-secondary small mb-0">
              Summary of your active businesses, saved forms, and customer records.
            </p>
          </div>
          <Link
            to="/dashboard/customers"
            className="btn btn-ff-primary btn-sm d-inline-flex align-items-center gap-2"
          >
            <UserPlus size={15} />
            <span>New Registration</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="row g-3">
        <div className="col-sm-6 col-xl-3">
          <div className="ff-card p-3 h-100 d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
              <span className="small text-secondary fw-medium">{t('active_businesses')}</span>
              <span className="ff-kpi-icon">
                <Building2 size={17} />
              </span>
            </div>
            <div className="ff-stat-value mb-2">{activeBusinesses.length}</div>
            <div className="small text-secondary mt-auto">{archivedCount} archived</div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="ff-card p-3 h-100 d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
              <span className="small text-secondary fw-medium">{t('total_customers')}</span>
              <span className="ff-kpi-icon">
                <Users size={17} />
              </span>
            </div>
            <div className="ff-stat-value mb-2">{records.length}</div>
            <div className="small text-secondary mt-auto">{recycleBin.length} in Recycle Bin</div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="ff-card p-3 h-100 d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
              <span className="small text-secondary fw-medium">{t('total_revenue')}</span>
              <span className="ff-kpi-icon ff-kpi-icon-success">
                <IndianRupee size={17} />
              </span>
            </div>
            <div className="ff-stat-value mb-2">{formatCurrency(stats.totalRevenue)}</div>
            <div className="d-flex flex-column small text-secondary ff-tabular mt-auto" style={{ lineHeight: 1.45 }}>
              <span>Cash: {formatCurrency(stats.cashTotal)}</span>
              <span>Online: {formatCurrency(stats.onlineTotal)}</span>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="ff-card p-3 h-100 d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
              <span className="small text-secondary fw-medium">{t('today_registrations')}</span>
              <span className="ff-kpi-icon">
                <ClipboardList size={17} />
              </span>
            </div>
            <div className="ff-stat-value mb-2">{stats.todayCount}</div>
            <div className="small text-secondary ff-tabular mt-auto">
              Collected today: {formatCurrency(stats.todayRevenue)}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Overview */}
      <div className="row g-3 align-items-stretch">
        <div className="col-lg-7">
          <div className="ff-card overflow-hidden h-100 d-flex flex-column">
            <div className="p-3 border-bottom d-flex justify-content-between align-items-center gap-2">
              <div>
                <h3 className="h6 fw-bold mb-0">Active Business Forms</h3>
                <div className="small text-secondary">
                  Your saved forms and customer record counts
                </div>
              </div>
              <Link
                to="/dashboard/businesses"
                className="small fw-semibold text-decoration-none d-inline-flex align-items-center gap-1"
              >
                <span>Manage All</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {activeBusinesses.length === 0 ? (
              <div className="p-4 text-center text-secondary small my-auto">
                <p className="mb-3">No active businesses available yet.</p>
                <Link to="/dashboard/businesses" className="btn btn-sm btn-ff-primary">
                  Create Form
                </Link>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table ff-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th className="px-4 py-3">Business</th>
                      <th className="px-3 py-3 text-end">Form Fields</th>
                      <th className="px-3 py-3 text-end">Records</th>
                      <th className="px-4 py-3 text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBusinesses.slice(0, 6).map((biz) => {
                      const fieldCount = (biz.fields || []).length;
                      const recCount = recordCountByBiz[biz.id] || 0;
                      return (
                        <tr key={biz.id}>
                          <td className="px-4 py-3">
                            <div className="fw-semibold text-dark">{biz.name}</div>
                            <div className="small text-secondary">{biz.category}</div>
                          </td>
                          <td className="px-3 py-3 text-end ff-mono small text-secondary">
                            {fieldCount}
                          </td>
                          <td className="px-3 py-3 text-end ff-mono small fw-semibold text-dark">
                            {recCount}
                          </td>
                          <td className="px-4 py-3 text-end">
                            <Link
                              to={`/dashboard/businesses?id=${biz.id}`}
                              className="small fw-semibold text-decoration-none"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-5">
          <div className="ff-card overflow-hidden h-100 d-flex flex-column">
            <div className="p-3 border-bottom">
              <h3 className="h6 fw-bold mb-0">Workspace Shortcuts</h3>
              <div className="small text-secondary">
                Jump directly to your daily workflows
              </div>
            </div>

            <div className="d-flex flex-column flex-grow-1">
              {quickLinks.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`ff-list-row d-flex align-items-center justify-content-between gap-3 px-3 px-sm-4 py-3 text-decoration-none ${
                      idx !== quickLinks.length - 1 ? 'border-bottom' : ''
                    }`}
                  >
                    <div className="d-flex align-items-center gap-3 min-w-0">
                      <span className="ff-kpi-icon">
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="fw-semibold small text-dark text-truncate">
                          {item.title}
                        </div>
                        <div className="small text-secondary text-truncate">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={15} className="text-secondary flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
