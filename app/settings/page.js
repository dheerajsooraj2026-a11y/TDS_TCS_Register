'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getCategories, addCategory, deleteCategory, getTransactions } from '@/lib/db';
import { useToast } from '@/components/Toast';

const categoryTypes = [
  {
    type: 'work',
    title: 'Work / Category',
    description: 'Categories for the type of work (e.g., Pooram, Ulsavam, Prathishta)',
    icon: '📁',
    placeholder: 'e.g., Pooram',
  },
  {
    type: 'tdsCategory',
    title: 'TDS Category',
    description: 'Section codes for TDS deduction (e.g., 194C, 194J, 194H)',
    icon: '📋',
    placeholder: 'e.g., 194C',
  },
  {
    type: 'tdsPercent',
    title: 'TDS Percentage',
    description: 'TDS deduction rates (e.g., 1, 2, 5, 10)',
    icon: '📐',
    placeholder: 'e.g., 2',
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [categories, setCategories] = useState({ work: [], tdsCategory: [], tdsPercent: [] });
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState({ work: '', tdsCategory: '', tdsPercent: '' });

  useEffect(() => {
    if (!user) return;
    loadCategories();
  }, [user]);

  async function loadCategories() {
    try {
      const [work, tdsCategory, tdsPercent] = await Promise.all([
        getCategories(user.id, 'work'),
        getCategories(user.id, 'tdsCategory'),
        getCategories(user.id, 'tdsPercent'),
      ]);
      setCategories({ work, tdsCategory, tdsPercent });
    } catch (e) {
      addToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleAdd = async (type) => {
    const value = inputs[type].trim();
    if (!value) return;

    // For tdsPercent, validate it's a number
    if (type === 'tdsPercent') {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 100) {
        addToast('Please enter a valid percentage (0-100)', 'warning');
        return;
      }
    }

    // Check duplicate
    const existing = categories[type].find(c => c.value.toLowerCase() === value.toLowerCase());
    if (existing) {
      addToast('This value already exists', 'warning');
      return;
    }

    try {
      await addCategory(user.id, type, type === 'tdsPercent' ? parseFloat(value).toString() : value);
      setInputs(prev => ({ ...prev, [type]: '' }));
      addToast('Category added', 'success');
      loadCategories();
    } catch (e) {
      addToast('Failed to add category', 'error');
    }
  };

  const handleDelete = async (id, type) => {
    try {
      // Check if this category value is used in any transaction
      const cat = categories[type].find(c => c.id === id);
      if (cat) {
        const allTransactions = await getTransactions(user.id);
        const fieldMap = { work: 'workCategory', tdsCategory: 'tdsCategory', tdsPercent: 'tdsPercent' };
        const field = fieldMap[type];
        const inUse = allTransactions.filter(t => String(t[field]) === String(cat.value));
        if (inUse.length > 0) {
          if (!confirm(`"${cat.value}" is used in ${inUse.length} transaction(s). Remove anyway?`)) return;
        }
      }

      await deleteCategory(id);
      addToast('Category removed', 'success');
      loadCategories();
    } catch (e) {
      addToast('Failed to delete', 'error');
    }
  };

  const handleKeyDown = (e, type) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd(type);
    }
  };

  if (loading) return <div className="loading-inline"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage categories and dropdown options used in transaction entry</p>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
        {categoryTypes.map(ct => (
          <div key={ct.type} className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">{ct.icon} {ct.title}</h2>
                <p className="text-muted" style={{ fontSize: '13px', marginTop: '4px' }}>{ct.description}</p>
              </div>
              <span className="badge badge-blue">{categories[ct.type].length} items</span>
            </div>

            <div className="tag-input-group mb-lg">
              <input
                type={ct.type === 'tdsPercent' ? 'number' : 'text'}
                className="form-input"
                placeholder={ct.placeholder}
                value={inputs[ct.type]}
                onChange={(e) => setInputs(prev => ({ ...prev, [ct.type]: e.target.value }))}
                onKeyDown={(e) => handleKeyDown(e, ct.type)}
                min={ct.type === 'tdsPercent' ? '0' : undefined}
                max={ct.type === 'tdsPercent' ? '100' : undefined}
                step={ct.type === 'tdsPercent' ? '0.01' : undefined}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleAdd(ct.type)}
                disabled={!inputs[ct.type].trim()}
              >
                + Add
              </button>
            </div>

            <div className="tag-list">
              {categories[ct.type].length === 0 ? (
                <span className="text-muted" style={{ fontSize: '13px' }}>
                  No items added yet. Type a value and click Add or press Enter.
                </span>
              ) : (
                categories[ct.type].map(c => (
                  <div key={c.id} className="tag">
                    {ct.type === 'tdsPercent' ? `${c.value}%` : c.value}
                    <button
                      className="tag-remove"
                      onClick={() => handleDelete(c.id, ct.type)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
