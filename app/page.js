'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getParties, getTransactions } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [parties, setParties] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [p, t] = await Promise.all([
          getParties(user.id),
          getTransactions(user.id),
        ]);
        setParties(p);
        setTransactions(t);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) return <div className="loading-inline"><div className="spinner" /></div>;

  const totalParties = parties.length;
  const totalTransactions = transactions.length;
  const pendingPayments = transactions.filter(t => !t.forPayment && !t.challanNo).length;
  const totalTDS = transactions.reduce((sum, t) => sum + (t.tdsAmount || 0), 0);
  const totalTaxable = transactions.reduce((sum, t) => sum + (t.taxableAmount || 0), 0);
  const recentTransactions = transactions.slice(0, 8);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back! Here&apos;s your TDS/TCS overview.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card" onClick={() => router.push('/parties')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon blue">🏢</div>
          <div className="stat-value">{totalParties}</div>
          <div className="stat-label">Registered Parties</div>
        </div>

        <div className="stat-card" onClick={() => router.push('/transactions')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon purple">📝</div>
          <div className="stat-value">{totalTransactions}</div>
          <div className="stat-label">Total Transactions</div>
        </div>

        <div className="stat-card" onClick={() => router.push('/reports/payment')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon amber">⏳</div>
          <div className="stat-value">{pendingPayments}</div>
          <div className="stat-label">Pending Payments</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">💰</div>
          <div className="stat-value">{formatCurrency(totalTDS)}</div>
          <div className="stat-label">Total TDS Amount</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon cyan">📊</div>
          <div className="stat-value">{formatCurrency(totalTaxable)}</div>
          <div className="stat-label">Total Taxable Amount</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Transactions</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/transactions')}>
            View All
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon">📝</div>
            <div className="table-empty-text">No transactions yet</div>
            <button className="btn btn-primary btn-sm mt-md" onClick={() => router.push('/transactions')}>
              Add Transaction
            </button>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Party</th>
                  <th>Payment Date</th>
                  <th>Bill No.</th>
                  <th>Category</th>
                  <th>Taxable Amt</th>
                  <th>TDS</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map(t => (
                  <tr key={t.id}>
                    <td>{t.companyName}</td>
                    <td>{formatDate(t.paymentDate)}</td>
                    <td className="font-mono">{t.billNo}</td>
                    <td><span className="badge badge-purple">{t.workCategory}</span></td>
                    <td className="text-right">{formatCurrency(t.taxableAmount)}</td>
                    <td className="text-right">{formatCurrency(t.tdsAmount)}</td>
                    <td>
                      {t.challanNo ? (
                        <span className="badge badge-green">Paid</span>
                      ) : t.forPayment ? (
                        <span className="badge badge-amber">Marked</span>
                      ) : (
                        <span className="badge badge-red">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
