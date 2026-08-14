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
  const { error } = await supabase
    .from('transactions')
    .update(data)
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
  const { error } = await supabase
    .from('transactions')
    .update({
      challan_no: challanNo,
      challan_date: challanDate,
      challan_pdf_url: challanPdfUrl,
      for_payment: true,
    })
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
  const filePath = `challans/${userId}/${transactionId}/${file.name}`;

  const { data, error } = await supabase.storage
    .from('challans')
    .upload(filePath, file, { upsert: true });

  if (error) throw error;

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
