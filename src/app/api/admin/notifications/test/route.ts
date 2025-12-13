import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';

// ============================================
// SAMPLE DATA FOR TEST EMAILS
// ============================================

const sampleData: Record<string, string> = {
  customer_name: 'Max Muster',
  appointment_date: '15.01.2025',
  appointment_time: '14:30',
  service_name: 'Herrenschnitt',
  staff_name: 'Anna Schmidt',
  salon_name: 'SCHNITTWERK',
  salon_address: 'Musterstrasse 1, 8000 Zürich',
  order_number: 'SCH-2025-00001',
  order_total: 'CHF 125.00',
  order_items: 'Shampoo (1x), Conditioner (1x)',
  tracking_number: '123456789',
  tracking_url: 'https://post.ch/tracking/123456789',
  recipient_name: 'Maria Muster',
  sender_name: 'Max Muster',
  voucher_code: 'GIFT-ABC123',
  voucher_amount: 'CHF 50.00',
  personal_message: 'Alles Gute zum Geburtstag!',
  expiry_date: '31.12.2025',
  cancellation_reason: 'Terminkonflikt',
};

// ============================================
// POST - Send Test Email
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Check admin role (only active staff)
    const { data: staffMember } = await supabase
      .from('staff')
      .select('id, role, salon_id')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single();

    if (!staffMember || !['admin', 'hq'].includes(staffMember.role)) {
      return NextResponse.json(
        { error: 'Keine Berechtigung für diese Aktion' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { templateId, recipientEmail } = body;

    if (!templateId || !recipientEmail) {
      return NextResponse.json(
        { error: 'Template-ID und Empfänger erforderlich' },
        { status: 400 }
      );
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Vorlage nicht gefunden' },
        { status: 404 }
      );
    }

    // Replace variables with sample data
    let subject = template.subject || 'Test-E-Mail';
    let bodyHtml = template.body_html || '';
    let bodyText = template.body_text || '';

    for (const [key, value] of Object.entries(sampleData)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      bodyHtml = bodyHtml.replace(new RegExp(placeholder, 'g'), value);
      bodyText = bodyText.replace(new RegExp(placeholder, 'g'), value);
    }

    // Send test email
    const result = await sendEmail({
      to: recipientEmail,
      subject: `[TEST] ${subject}`,
      html: bodyHtml,
      text: bodyText,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Fehler beim Senden' },
        { status: 500 }
      );
    }

    // Log the test notification
    await supabase.from('notifications').insert({
      salon_id: staffMember.salon_id,
      template_id: templateId,
      template_code: template.code,
      channel: 'email',
      recipient_email: recipientEmail,
      subject: `[TEST] ${subject}`,
      body_html: bodyHtml,
      body_text: bodyText,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Test-E-Mail an ${recipientEmail} gesendet`,
    });
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
