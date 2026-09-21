import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not configured.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const userId = formData.get('userId') || 'common';
    const transactionId = formData.get('transactionId') || 'general';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Verify file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 });
    }

    // Initialize Supabase admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const cleanName = (file.name || 'challan.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${userId}/${transactionId}/${Date.now()}_${cleanName}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabaseAdmin.storage
      .from('challans')
      .upload(filePath, fileBuffer, {
        contentType: file.type || 'application/pdf',
        upsert: true,
      });

    if (error) {
      console.error('Admin storage upload error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('challans')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      publicUrl: urlData.publicUrl,
      path: filePath,
    });
  } catch (err) {
    console.error('Upload API route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error during upload' },
      { status: 500 }
    );
  }
}
