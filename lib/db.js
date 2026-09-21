import { supabase } from './supabase';
import { calculateTDS } from './utils';

// ─── Parties (Input 01) ─────────────────────────────────────────────────────

export async function addParty(userId, data) {
  const { data: result, error } = await supabase
    .from('parties')
    .insert({
      user_id: userId,
      company_name: data.companyName,
      pan_no: data.panNo.toUpperCase(),
      name_as_per_pan: data.nameAsPerPan.toUpperCase(),
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getParties(userId) {
  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapParty);
}

export async function updateParty(id, data) {
  const updates = {};
  if (data.companyName !== undefined) updates.company_name = data.companyName;
  if (data.panNo !== undefined) updates.pan_no = data.panNo.toUpperCase();
  if (data.nameAsPerPan !== undefined) updates.name_as_per_pan = data.nameAsPerPan.toUpperCase();

  const { error } = await supabase
    .from('parties')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteParty(id) {
  const { error } = await supabase
    .from('parties')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function checkPanExists(userId, panNo, excludeId = null) {
  let query = supabase
    .from('parties')
    .select('id')
    .eq('user_id', userId)
    .eq('pan_no', panNo.toUpperCase());

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data && data.length > 0;
}

// ─── Transactions (Input 02) ────────────────────────────────────────────────

export async function addTransaction(userId, data) {
  const tdsAmount = calculateTDS(data.taxableAmount, data.tdsPercent);

  const { data: result, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      party_id: data.partyId,
      company_name: data.companyName,
      pan_no: data.panNo,
      name_as_per_pan: data.nameAsPerPan,
      payment_date: data.paymentDate,
      bill_no: data.billNo,
      work_category: data.workCategory,
      total_amount: data.totalAmount != null && data.totalAmount !== '' ? Number(data.totalAmount) : 0,
      taxable_amount: data.taxableAmount,
      tds_category: data.tdsCategory,
      tds_percent: data.tdsPercent,
      tds_amount: tdsAmount,
      for_payment: false,
      challan_no: null,
      challan_date: null,
      challan_pdf_url: null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getTransactions(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapTransaction);
}

export async function updateTransaction(id, data) {
  // Map camelCase keys to snake_case for Supabase
  const keyMap = {
    partyId: 'party_id',
    companyName: 'company_name',
    panNo: 'pan_no',
    nameAsPerPan: 'name_as_per_pan',
    paymentDate: 'payment_date',
    billNo: 'bill_no',
    workCategory: 'work_category',
    totalAmount: 'total_amount',
    taxableAmount: 'taxable_amount',
    tdsCategory: 'tds_category',
    tdsPercent: 'tds_percent',
    tdsAmount: 'tds_amount',
    forPayment: 'for_payment',
    challanNo: 'challan_no',
    challanDate: 'challan_date',
    challanPdfUrl: 'challan_pdf_url',
  };

  const mapped = {};
  for (const [key, value] of Object.entries(data)) {
    mapped[keyMap[key] || key] = value;
  }

  const { error } = await supabase
    .from('transactions')
    .update(mapped)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function markForPayment(id, forPayment) {
  const { error } = await supabase
    .from('transactions')
    .update({ for_payment: forPayment })
    .eq('id', id);

  if (error) throw error;
}

export async function updateChallanInfo(id, challanNo, challanDate, challanPdfUrl) {
  const updates = {
    challan_no: challanNo,
    challan_date: challanDate,
    for_payment: true,
  };

  // Only update challan_pdf_url if explicitly provided (avoids wiping existing PDF if undefined)
  if (challanPdfUrl !== undefined) {
    updates.challan_pdf_url = challanPdfUrl;
  }

  const { error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

// ─── Categories (Settings) ─────────────────────────────────────────────────

export async function addCategory(userId, type, value) {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      type,
      value,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCategories(userId, type) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapCategory);
}

export async function deleteCategory(id) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateCategory(id, value) {
  const { error } = await supabase
    .from('categories')
    .update({ value })
    .eq('id', id);

  if (error) throw error;
}

// ─── File Upload (Challan PDF) ──────────────────────────────────────────────

export async function uploadChallanPdf(userId, file, transactionId) {
  if (!file) throw new Error('No file provided for upload.');

  // Try server-side upload first (uses service role key to bypass client RLS issues securely)
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId || '');
    formData.append('transactionId', transactionId || '');

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.publicUrl) {
        return data.publicUrl;
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error && !errData.error.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        throw new Error(errData.error);
      }
    }
  } catch (apiErr) {
    if (!apiErr.message?.includes('SUPABASE_SERVICE_ROLE_KEY') && !apiErr.message?.includes('fetch failed')) {
      throw apiErr;
    }
  }

  // Fallback to direct Supabase client storage upload
  const cleanFileName = (file.name || 'challan.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${userId}/${transactionId}/${Date.now()}_${cleanFileName}`;

  const { data, error } = await supabase.storage
    .from('challans')
    .upload(filePath, file, {
      contentType: file.type || 'application/pdf',
      upsert: true,
    });

  if (error) {
    if (
      error.message?.includes('Bucket not found') ||
      error.error === 'Bucket not found' ||
      error.statusCode === '404' ||
      error.statusCode === 404
    ) {
      throw new Error(
        'Supabase Storage bucket "challans" does not exist.'
      );
    }
    if (
      error.message?.includes('row-level security') ||
      error.error === 'Unauthorized' ||
      error.statusCode === '403' ||
      error.statusCode === 403
    ) {
      throw new Error(
        'Storage permission denied. Please ensure Storage RLS policies for the "challans" bucket are added in Supabase.'
      );
    }
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from('challans')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// ─── Mappers (snake_case → camelCase) ───────────────────────────────────────

function mapParty(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    panNo: row.pan_no,
    nameAsPerPan: row.name_as_per_pan,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

function mapTransaction(row) {
  return {
    id: row.id,
    partyId: row.party_id,
    companyName: row.company_name,
    panNo: row.pan_no,
    nameAsPerPan: row.name_as_per_pan,
    paymentDate: row.payment_date,
    billNo: row.bill_no,
    workCategory: row.work_category,
    totalAmount: row.total_amount != null ? Number(row.total_amount) : 0,
    taxableAmount: row.taxable_amount,
    tdsCategory: row.tds_category,
    tdsPercent: row.tds_percent,
    tdsAmount: row.tds_amount,
    forPayment: row.for_payment,
    challanNo: row.challan_no,
    challanDate: row.challan_date,
    challanPdfUrl: row.challan_pdf_url,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

function mapCategory(row) {
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}
