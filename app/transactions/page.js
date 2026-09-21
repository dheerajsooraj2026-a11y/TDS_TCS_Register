'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getParties, getTransactions, addTransaction, deleteTransaction, getCategories } from '@/lib/db';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, calculateTDS } from '@/lib/utils';

export default function TransactionsPage() {
  const { user, verifyPassword } = useAuth();
  const { addToast } = useToast();
  const [parties, setParties] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState({ work: [], tdsCategory: [], tdsPercent: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Guarded delete state for paid transactions
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    partyId: '',
    companyName: '',
    panNo: '',
    nameAsPerPan: '',
    paymentDate: '',
    billNo: '',
    workCategory: '',
    totalAmount: '',
    taxableAmount: '',
    tdsCategory: '',
    tdsPercent: '',
  });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    try {
      const [p, t, wc, tc, tp] = await Promise.all([
        getParties(user.id),
        getTransactions(user.id),
        getCategories(user.id, 'work'),
        getCategories(user.id, 'tdsCategory'),
        getCategories(user.id, 'tdsPercent'),
      ]);
      setParties(p);
      setTransactions(t);
      setCategories({ work: wc, tdsCategory: tc, tdsPercent: tp });
    } catch (e) {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handlePartySelect = (partyId) => {
    const party = parties.find(p => p.id === partyId);
    if (party) {
      setFormData(prev => ({
        ...prev,
        partyId: party.id,
        companyName: party.companyName,
        panNo: party.panNo,
        nameAsPerPan: party.nameAsPerPan,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        partyId: '',
        companyName: '',
        panNo: '',
        nameAsPerPan: '',
      }));
    }
  };

  const tdsAmount = formData.taxableAmount && formData.tdsPercent
    ? calculateTDS(parseFloat(formData.taxableAmount), parseFloat(formData.tdsPercent))
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    // Warn if duplicate bill number for same party
    const duplicate = transactions.find(
      t => t.panNo === formData.panNo && t.billNo === formData.billNo
    );
    if (duplicate) {
      if (!confirm(`Bill No. "${formData.billNo}" already exists for this party. Add anyway?`)) {
        setSaving(false);
        return;
      }
    }

    try {
      await addTransaction(user.id, {
        partyId: formData.partyId,
        companyName: formData.companyName,
        panNo: formData.panNo,
        nameAsPerPan: formData.nameAsPerPan,
        paymentDate: formData.paymentDate,
        billNo: formData.billNo,
        workCategory: formData.workCategory,
        totalAmount: formData.totalAmount ? parseFloat(formData.totalAmount) : 0,
        taxableAmount: parseFloat(formData.taxableAmount),
        tdsCategory: formData.tdsCategory,
        tdsPercent: parseFloat(formData.tdsPercent),
      });

      addToast('Transaction added successfully', 'success');

      // Reset form but keep party selected for fast entry
      setFormData(prev => ({
        ...prev,
        paymentDate: '',
        billNo: '',
        workCategory: '',
        totalAmount: '',
        taxableAmount: '',
        tdsCategory: '',
        tdsPercent: '',
      }));

      loadData();
    } catch (e) {
      addToast('Failed to add transaction', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (t) => {
    if (t.challanNo) {
      // Guarded: Paid transaction requires account password verification
      setDeletingTransaction(t);
      setDeletePassword('');
      setDeleteError('');
    } else {
      handleDeleteUnpaid(t);
    }
  };

  const handleDeleteUnpaid = async (t) => {
    if (!confirm(`Delete unpaid transaction for "${t.companyName}" (Bill ${t.billNo})?`)) return;
    try {
      await deleteTransaction(t.id);
      addToast('Transaction deleted', 'success');
      loadData();
    } catch (e) {
      addToast('Failed to delete transaction', 'error');
    }
  };

  const handleConfirmPaidDelete = async (e) => {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteError('Please enter your account password.');
      return;
    }
    setDeleting(true);
    setDeleteError('');

    try {
      // Verify account password
      await verifyPassword(deletePassword);
      
      // Delete the paid transaction
      await deleteTransaction(deletingTransaction.id);
      addToast(`Paid transaction for "${deletingTransaction.companyName}" deleted successfully`, 'success');
      setDeletingTransaction(null);
      setDeletePassword('');
      loadData();
    } catch (err) {
      setDeleteError(err.message || 'Incorrect password. Deletion unauthorized.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="loading-inline"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Transaction Entry</h1>
        <p>Record TDS/TCS transactions against registered parties</p>
      </div>

      {/* Transaction Form */}
      <div className="card mb-lg">
        <div className="card-header">
          <h2 className="card-title">New Transaction</h2>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Party Selection */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Company / Party Name *</label>
              <select
                className="form-select"
                value={formData.partyId}
                onChange={(e) => handlePartySelect(e.target.value)}
                required
              >
                <option value="">Select a party...</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id}>{p.companyName}</option>
                ))}
              </select>
              {parties.length === 0 && (
                <div className="form-hint">No parties registered. Go to Party Master to add one.</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">PAN No.</label>
              <input
                type="text"
                className="form-input"
                value={formData.panNo}
                readOnly
                placeholder="Auto-filled"
                style={{ opacity: 0.7 }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Name as per PAN</label>
              <input
                type="text"
                className="form-input"
                value={formData.nameAsPerPan}
                readOnly
                placeholder="Auto-filled"
                style={{ opacity: 0.7 }}
              />
            </div>
          </div>

          {/* Transaction Details */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Payment Date *</label>
              <input
                type="date"
                className="form-input"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                onClick={(e) => {
                  try {
                    e.target.showPicker();
                  } catch (err) {}
                }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Bill No. *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter bill number"
                value={formData.billNo}
                onChange={(e) => setFormData({ ...formData, billNo: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Work / Category *</label>
              <select
                className="form-select"
                value={formData.workCategory}
                onChange={(e) => setFormData({ ...formData, workCategory: e.target.value })}
                required
              >
                <option value="">Select category...</option>
                {categories.work.map(c => (
                  <option key={c.id} value={c.value}>{c.value}</option>
                ))}
              </select>
              {categories.work.length === 0 && (
                <div className="form-hint">Add categories in Settings</div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Total Amount</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                min="0"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Taxable Amount *</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                value={formData.taxableAmount}
                onChange={(e) => setFormData({ ...formData, taxableAmount: e.target.value })}
                required
                min="0"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">TDS Category *</label>
              <select
                className="form-select"
                value={formData.tdsCategory}
                onChange={(e) => setFormData({ ...formData, tdsCategory: e.target.value })}
                required
              >
                <option value="">Select TDS category...</option>
                {categories.tdsCategory.map(c => (
                  <option key={c.id} value={c.value}>{c.value}</option>
                ))}
              </select>
              {categories.tdsCategory.length === 0 && (
                <div className="form-hint">Add TDS categories in Settings</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">TDS % *</label>
              <select
                className="form-select"
                value={formData.tdsPercent}
                onChange={(e) => setFormData({ ...formData, tdsPercent: e.target.value })}
                required
              >
                <option value="">Select %...</option>
                {categories.tdsPercent.map(c => (
                  <option key={c.id} value={c.value}>{c.value}%</option>
                ))}
              </select>
              {categories.tdsPercent.length === 0 && (
                <div className="form-hint">Add TDS % in Settings</div>
              )}
            </div>
          </div>

          {/* Computed TDS Amount */}
          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-group">
              <label className="form-label">TDS Amount (Auto-calculated)</label>
              <div className="computed-field">
                <span className="computed-label">Taxable × TDS%</span>
                <span className="computed-value">{formatCurrency(tdsAmount)}</span>
              </div>
            </div>
            <div></div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-primary w-full" disabled={saving}>
                {saving ? 'Saving...' : '+ Add Transaction'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">All Transactions</h2>
          <span className="text-muted" style={{ fontSize: '13px' }}>
            {transactions.length} entries
          </span>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Party</th>
                <th>PAN</th>
                <th>Date</th>
                <th>Bill No.</th>
                <th>Work</th>
                <th>Total Amt</th>
                <th>Taxable Amt</th>
                <th>TDS Cat.</th>
                <th>TDS %</th>
                <th>TDS Amt</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="13">
                    <div className="table-empty">
                      <div className="table-empty-icon">📝</div>
                      <div className="table-empty-text">No transactions yet. Use the form above to add one.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((t, i) => (
                  <tr key={t.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{t.companyName}</td>
                    <td className="font-mono" style={{ fontSize: '12px' }}>{t.panNo}</td>
                    <td>{formatDate(t.paymentDate)}</td>
                    <td className="font-mono">{t.billNo}</td>
                    <td><span className="badge badge-purple">{t.workCategory}</span></td>
                    <td className="text-right">{formatCurrency(t.totalAmount || 0)}</td>
                    <td className="text-right">{formatCurrency(t.taxableAmount)}</td>
                    <td><span className="badge badge-blue">{t.tdsCategory}</span></td>
                    <td className="text-center">{t.tdsPercent}%</td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(t.tdsAmount)}</td>
                    <td>
                      {t.challanNo ? (
                        <span className="badge badge-green">Paid</span>
                      ) : t.forPayment ? (
                        <span className="badge badge-amber">Marked</span>
                      ) : (
                        <span className="badge badge-red">Pending</span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteClick(t)} title="Delete">
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guarded Delete Modal for Paid Transactions */}
      {deletingTransaction && (
        <div className="modal-overlay" onClick={() => !deleting && setDeletingTransaction(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-danger)' }}>
                <span>🔒</span> Guarded Action: Delete Paid Transaction
              </h2>
              <button
                className="modal-close"
                onClick={() => !deleting && setDeletingTransaction(null)}
                disabled={deleting}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmPaidDelete}>
              <div className="modal-body">
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  marginBottom: 'var(--space-lg)'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent-danger)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⚠️ Report Impact Warning
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '10px' }}>
                    This transaction has already been marked as <strong>PAID</strong> with Challan details. Deleting it will permanently remove it from your <strong>TDS Report</strong> and <strong>Payment History</strong>.
                  </p>
                  <div style={{ fontSize: '12px', background: 'rgba(0, 0, 0, 0.25)', padding: '10px', borderRadius: 'var(--radius-sm)', lineHeight: '1.6' }}>
                    <div><strong>Party:</strong> {deletingTransaction.companyName}</div>
                    <div><strong>Bill No:</strong> {deletingTransaction.billNo} | <strong>Taxable Amt:</strong> {formatCurrency(deletingTransaction.taxableAmount)}</div>
                    <div><strong>TDS Amount:</strong> {formatCurrency(deletingTransaction.tdsAmount)} ({deletingTransaction.tdsPercent}% - {deletingTransaction.tdsCategory})</div>
                    <div><strong>Challan No:</strong> {deletingTransaction.challanNo} | <strong>Challan Date:</strong> {formatDate(deletingTransaction.challanDate)}</div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Enter Account Password to Authorize Deletion *
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter your account password"
                    value={deletePassword}
                    onChange={(e) => {
                      setDeletePassword(e.target.value);
                      if (deleteError) setDeleteError('');
                    }}
                    required
                    autoFocus
                  />
                  <div className="form-hint">
                    Account: <strong>{user?.email}</strong>. Password verification protects against accidental deletion of reconciled tax data.
                  </div>
                  {deleteError && (
                    <p className="form-error" style={{ marginTop: '8px', color: 'var(--accent-danger)' }}>
                      ❌ {deleteError}
                    </p>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeletingTransaction(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={deleting || !deletePassword}
                >
                  {deleting ? 'Verifying & Deleting...' : '🔒 Delete Paid Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
