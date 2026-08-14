'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getTransactions } from '@/lib/db';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import * as XLSX from 'xlsx';

export default function TDSReportPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState('');

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const data = await getTransactions(user.id);
        setTransactions(data);
      } catch (e) {
        addToast('Failed to load transactions', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  // Only show transactions with challan info (paid)
  const paidTransactions = transactions.filter(t => t.challanNo);

  // Filter by challan date month
  const filtered = paidTransactions.filter(t => {
    if (!filterMonth) return true;
    return t.challanDate && t.challanDate.startsWith(filterMonth);
  });

  // Sort by challan date
  const sorted = [...filtered].sort((a, b) => (a.challanDate || '').localeCompare(b.challanDate || ''));

  const totalTDS = sorted.reduce((s, t) => s + (t.tdsAmount || 0), 0);
  const totalTaxable = sorted.reduce((s, t) => s + (t.taxableAmount || 0), 0);

  const exportToExcel = () => {
    const data = sorted.map((t, i) => ({
      '#': i + 1,
      'Company/Party Name': t.companyName,
      'Name as per PAN': t.nameAsPerPan,
      'PAN': t.panNo,
      'Payment Date': t.paymentDate,
      'Taxable Amount': t.taxableAmount,
      'TDS Category': t.tdsCategory,
      'TDS %': t.tdsPercent,
      'TDS Amount': t.tdsAmount,
      'Challan No.': t.challanNo,
      'Challan Date': t.challanDate,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TDS Report');
    XLSX.writeFile(wb, `TDS_Report_${filterMonth || 'All'}.xlsx`);
    addToast('Excel exported successfully', 'success');
  };

  if (loading) return <div className="loading-inline"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-actions">
          <div>
            <h1>Monthly TDS Report</h1>
            <p>Challan date-wise listing of all paid TDS transactions</p>
          </div>
          <button className="btn btn-secondary" onClick={exportToExcel}>
            📥 Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Filter by Challan Month</label>
          <input
            type="month"
            className="form-input"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            style={{ maxWidth: '200px' }}
          />
        </div>
        {filterMonth && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setFilterMonth('')}
            style={{ marginTop: '20px' }}
          >
            Clear Filter
          </button>
        )}
        <div style={{ marginLeft: 'auto', marginTop: '20px' }}>
          <span className="text-muted" style={{ fontSize: '13px' }}>
            {sorted.length} paid transactions
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="stat-card">
          <div className="stat-icon green">💰</div>
          <div className="stat-value">{formatCurrency(totalTDS)}</div>
          <div className="stat-label">Total TDS Paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">📊</div>
          <div className="stat-value">{formatCurrency(totalTaxable)}</div>
          <div className="stat-label">Total Taxable Amount</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">📋</div>
          <div className="stat-value">{sorted.length}</div>
          <div className="stat-label">Transactions</div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Party</th>
              <th>Name as per PAN</th>
              <th>PAN</th>
              <th>Payment Date</th>
              <th>Taxable Amt</th>
              <th>TDS Cat.</th>
              <th>TDS %</th>
              <th>TDS Amount</th>
              <th>Challan No.</th>
              <th>Challan Date</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan="12">
                  <div className="table-empty">
                    <div className="table-empty-icon">📋</div>
                    <div className="table-empty-text">
                      No paid transactions found. Record challans in the Payment Report.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((t, i) => (
                <tr key={t.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{t.companyName}</td>
                  <td>{t.nameAsPerPan}</td>
                  <td className="font-mono" style={{ fontSize: '12px' }}>{t.panNo}</td>
                  <td>{formatDate(t.paymentDate)}</td>
                  <td className="text-right">{formatCurrency(t.taxableAmount)}</td>
                  <td><span className="badge badge-blue">{t.tdsCategory}</span></td>
                  <td className="text-center">{t.tdsPercent}%</td>
                  <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(t.tdsAmount)}</td>
                  <td className="font-mono">{t.challanNo}</td>
                  <td>{formatDate(t.challanDate)}</td>
                  <td>
                    {t.challanPdfUrl ? (
                      <a
                        href={t.challanPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        title="View PDF"
                      >
                        📄
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
