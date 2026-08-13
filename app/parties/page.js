'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getParties, addParty, updateParty, deleteParty, checkPanExists } from '@/lib/db';
import { useToast } from '@/components/Toast';

export default function PartiesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ companyName: '', panNo: '', nameAsPerPan: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadParties();
  }, [user]);

  async function loadParties() {
    try {
      const data = await getParties(user.id);
      setParties(data);
    } catch (e) {
      addToast('Failed to load parties', 'error');
    } finally {
      setLoading(false);
    }
  }

  const openAdd = () => {
    setEditingParty(null);
    setFormData({ companyName: '', panNo: '', nameAsPerPan: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (party) => {
    setEditingParty(party);
    setFormData({
      companyName: party.companyName,
      panNo: party.panNo,
      nameAsPerPan: party.nameAsPerPan,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    try {
      // PAN validation (10 chars alphanumeric)
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      const pan = formData.panNo.toUpperCase();
      if (!panRegex.test(pan)) {
        setFormError('Invalid PAN format. Expected: AAAAA9999A');
        setSaving(false);
        return;
      }

      // Check duplicate PAN
      const panExists = await checkPanExists(user.id, pan, editingParty?.id);
      if (panExists) {
        setFormError('A party with this PAN number already exists');
        setSaving(false);
        return;
      }

      if (editingParty) {
        await updateParty(editingParty.id, {
          companyName: formData.companyName,
          panNo: pan,
          nameAsPerPan: formData.nameAsPerPan.toUpperCase(),
        });
        addToast('Party updated successfully', 'success');
      } else {
        await addParty(user.id, {
          companyName: formData.companyName,
          panNo: pan,
          nameAsPerPan: formData.nameAsPerPan.toUpperCase(),
        });
        addToast('Party added successfully', 'success');
      }

      setShowModal(false);
      loadParties();
    } catch (e) {
      addToast('Failed to save party', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (party) => {
    if (!confirm(`Delete "${party.companyName}"? This action cannot be undone.`)) return;
    try {
      await deleteParty(party.id);
      addToast('Party deleted', 'success');
      loadParties();
    } catch (e) {
      addToast('Failed to delete party', 'error');
    }
  };

  const filtered = parties.filter(p =>
    p.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.panNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nameAsPerPan.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading-inline"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-actions">
          <div>
            <h1>Party Master</h1>
            <p>Manage companies and parties for TDS transactions</p>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            + Add Party
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-md mb-lg" style={{ flexWrap: 'wrap' }}>
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name, PAN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <span className="text-muted" style={{ fontSize: '13px' }}>
          {filtered.length} {filtered.length === 1 ? 'party' : 'parties'}
        </span>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Company / Party Name</th>
              <th>PAN No.</th>
              <th>Name as per PAN</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <div className="table-empty">
                    <div className="table-empty-icon">🏢</div>
                    <div className="table-empty-text">
                      {searchTerm ? 'No parties match your search' : 'No parties registered yet'}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{p.companyName}</td>
                  <td className="font-mono">{p.panNo}</td>
                  <td>{p.nameAsPerPan}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)} title="Edit">
                        ✏️
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p)} title="Delete">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingParty ? 'Edit Party' : 'Add New Party'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Company / Party Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter company or party name"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">PAN No.</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="AAAAA9999A"
                    value={formData.panNo}
                    onChange={(e) => setFormData({ ...formData, panNo: e.target.value.toUpperCase() })}
                    required
                    maxLength={10}
                    style={{ textTransform: 'uppercase' }}
                  />
                  <div className="form-hint">10-character PAN format: 5 letters, 4 digits, 1 letter</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Name as per PAN</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Full name as on PAN card"
                    value={formData.nameAsPerPan}
                    onChange={(e) => setFormData({ ...formData, nameAsPerPan: e.target.value })}
                    required
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                {formError && <p className="form-error">{formError}</p>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingParty ? 'Update Party' : 'Add Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
