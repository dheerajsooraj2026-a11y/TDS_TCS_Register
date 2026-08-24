'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getTransactions, markForPayment, updateChallanInfo, uploadChallanPdf } from '@/lib/db';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import * as XLSX from 'xlsx';

export default function PaymentReportPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState('');
  const [showChallanModal, setShowChallanModal] = useState(false);
  const [selectedForChallan, setSelectedForChallan] = useState([]);
  const [challanData, setChallanData] = useState({ challanNo: '', challanDate: '' });
  const [challanFile, setChallanFile] = useState(null);
  const [savingChallan, setSavingChallan] = useState(false);
  const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB

  useEffect(() => {
    if (!user) return;
    loadTransactions();
  }, [user]);

  async function loadTransactions() {
    try {
      const data = await getTransactions(user.id);
      setTransactions(data);
    } catch (e) {
      addToast('Failed to load transactions', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Filter by month (payment date)
  const filtered = transactions.filter(t => {
    if (!t.challanNo) { // Only show unpaid
      if (!filterMonth) return true;
      return t.paymentDate && t.paymentDate.startsWith(filterMonth);
    }
    return false;
  });

  // Sort by payment date
  const sorted = [...filtered].sort((a, b) => (a.paymentDate || '').localeCompare(b.paymentDate || ''));

  const handleTickPayment = async (t) => {
    const next = !t.forPayment;
    try {
      await markForPayment(t.id, next);
      setTransactions(prev =>
        prev.map(tr => tr.id === t.id ? { ...tr, forPayment: next } : tr)
      );
    } catch (e) {
      addToast('Failed to update', 'error');
    }
  };

  const markedItems = sorted.filter(t => t.forPayment);

  // Group marked items by TDS Category + TDS %
  const groupedSummary = {};
  markedItems.forEach(t => {
    const key = `${t.tdsCategory} @ ${t.tdsPercent}%`;
    if (!groupedSummary[key]) {
      groupedSummary[key] = { tdsCategory: t.tdsCategory, tdsPercent: t.tdsPercent, totalTDS: 0, count: 0 };
    }
    groupedSummary[key].totalTDS += t.tdsAmount || 0;
    groupedSummary[key].count += 1;
  });

  const openChallanModal = () => {
    if (markedItems.length === 0) {
      addToast('Please tick at least one transaction for payment', 'warning');
      return;
    }
    setSelectedForChallan(markedItems.map(t => t.id));
    setChallanData({ challanNo: '', challanDate: '' });
    setChallanFile(null);
    setShowChallanModal(true);
  };

  const handleSaveChallan = async (e) => {
    e.preventDefault();
    setSavingChallan(true);

    try {
      let pdfUrl = null;
      if (challanFile) {
        // Upload PDF for the first selected transaction (shared)
        pdfUrl = await uploadChallanPdf(user.id, challanFile, selectedForChallan[0]);
      }

      // Update all selected transactions
      for (const id of selectedForChallan) {
        await updateChallanInfo(id, challanData.challanNo, challanData.challanDate, pdfUrl);
      }

      addToast('Challan details saved successfully', 'success');
      setShowChallanModal(false);
      loadTransactions();
    } catch (e) {
      addToast('Failed to save challan details — some transactions may already be updated, please check below', 'error');
      loadTransactions();
    } finally {
      setSavingChallan(false);
    }
  };

  const exportToExcel = () => {
    const data = sorted.map((t, i) => ({
      '#': i + 1,
      'Company/Party Name': t.companyName,
      'Name as per PAN': t.nameAsPerPan,
      'PAN': t.panNo,
      'Work/Category': t.workCategory,
      'Payment Date': t.paymentDate,
      'Bill No.': t.billNo,
      'Taxable Amount': t.taxableAmount,
      'TDS Category': t.tdsCategory,
      'TDS %': t.tdsPercent,
      'TDS Amount': t.tdsAmount,
      'For Payment': t.forPayment ? 'Yes' : 'No',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Report');
    XLSX.writeFile(wb, `Payment_Report_${filterMonth || 'All'}.xlsx`);
    addToast('Excel exported successfully', 'success');
  };

  if (loading) return <div className="loading-inline"><div className="spinner" /></div>;

  const totalMarkedTDS = markedItems.reduce((s, t) => s + (t.tdsAmount || 0), 0);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-actions">
          <div>
            <h1>Monthly Payment Report</h1>
            <p>Payment date-wise listing — tick items for payment and record challans</p>
          </div>
          <div className="flex gap-md">
            <button className="btn btn-secondary" onClick={exportToExcel} disabled={sorted.length === 0}>
              📥 Export Excel
            </button>
            <button className="btn btn-primary" onClick={openChallanModal}>
              📋 Enter Challan
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Filter by Month</label>
          <input
            type="month"
            className="form-input"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            onClick={(e) => {
              try {
                e.target.showPicker();
              } catch (err) {}
            }}
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
            {sorted.length} unpaid transactions
          </span>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="table-container mb-lg">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>Pay</th>
              <th>Party</th>
              <th>Name as per PAN</th>
              <th>PAN</th>
              <th>Work</th>
              <th>Date</th>
              <th>Bill No.</th>
              <th>Taxable Amt</th>
              <th>TDS Cat.</th>
              <th>TDS %</th>
              <th>TDS Amount</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan="11">
                  <div className="table-empty">
                    <div className="table-empty-icon">💳</div>
                    <div className="table-empty-text">No pending transactions found</div>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map(t => (
                <tr key={t.id} style={t.forPayment ? { background: 'rgba(59, 130, 246, 0.05)' } : {}}>
                  <td>
                    <div className="checkbox-wrapper">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={t.forPayment || false}
                        onChange={() => handleTickPayment(t)}
                      />
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{t.companyName}</td>
                  <td>{t.nameAsPerPan}</td>
                  <td className="font-mono" style={{ fontSize: '12px' }}>{t.panNo}</td>
                  <td><span className="badge badge-purple">{t.workCategory}</span></td>
                  <td>{formatDate(t.paymentDate)}</td>
                  <td className="font-mono">{t.billNo}</td>
                  <td className="text-right">{formatCurrency(t.taxableAmount)}</td>
                  <td><span className="badge badge-blue">{t.tdsCategory}</span></td>
                  <td className="text-center">{t.tdsPercent}%</td>
                  <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(t.tdsAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary of marked items */}
      {markedItems.length > 0 && (
        <div className="card summary-section">
          <div className="card-header">
            <h2 className="card-title">Payment Summary ({markedItems.length} items selected)</h2>
            <div className="computed-field" style={{ minWidth: '200px' }}>
              <span className="computed-label">Total TDS</span>
              <span className="computed-value">{formatCurrency(totalMarkedTDS)}</span>
            </div>
          </div>
          <div className="summary-grid">
            {Object.entries(groupedSummary).map(([key, val]) => (
              <div key={key} className="summary-item">
                <div>
                  <div className="summary-item-label">{val.tdsCategory} @ {val.tdsPercent}%</div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>{val.count} transactions</div>
                </div>
                <div className="summary-item-value">{formatCurrency(val.totalTDS)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challan Modal */}
      {showChallanModal && (
        <div className="modal-overlay" onClick={() => setShowChallanModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Enter Challan Details</h2>
              <button className="modal-close" onClick={() => setShowChallanModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveChallan}>
              <div className="modal-body">
                <p className="text-muted mb-lg" style={{ fontSize: '13px' }}>
                  Recording challan for {selectedForChallan.length} selected transactions
                  (Total TDS: {formatCurrency(totalMarkedTDS)})
                </p>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Challan No. *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter challan number"
                      value={challanData.challanNo}
                      onChange={(e) => setChallanData({ ...challanData, challanNo: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Challan Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={challanData.challanDate}
                      onChange={(e) => setChallanData({ ...challanData, challanDate: e.target.value })}
                      onClick={(e) => {
                        try {
                          e.target.showPicker();
                        } catch (err) {}
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Challan PDF (Optional)</label>
                  <div
                    className="file-upload"
                    onClick={() => document.getElementById('challan-pdf').click()}
                  >
                    <input
                      type="file"
                      id="challan-pdf"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file && file.size > MAX_PDF_SIZE) {
                          addToast('File size exceeds 10MB limit', 'warning');
                          e.target.value = '';
                          return;
                        }
                        setChallanFile(file);
                      }}
                    />
                    <div className="file-upload-icon">📄</div>
                    <div className="file-upload-text">
                      {challanFile ? challanFile.name : 'Click to upload challan PDF'}
                    </div>
                    <div className="file-upload-hint">PDF files only, max 10MB</div>
                  </div>
                  {challanFile && (
                    <div className="file-preview">
                      <span>📄</span>
                      <span className="file-preview-name">{challanFile.name}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setChallanFile(null)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowChallanModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingChallan}>
                  {savingChallan ? 'Saving...' : 'Save Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
