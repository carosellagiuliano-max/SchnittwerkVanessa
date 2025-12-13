import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// ============================================
// PUT - Update Template
// ============================================

export async function PUT(request: NextRequest) {
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
    const { id, subject, bodyHtml, bodyText, smsBody, isActive } = body;

    if (id) {
      // Update existing template
      const { error } = await supabase
        .from('notification_templates')
        .update({
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          sms_body: smsBody,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('Template update error:', error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    } else {
      // Create new template
      const { code, name, channel = 'email', availableVariables = [] } = body;

      const { error } = await supabase
        .from('notification_templates')
        .insert({
          salon_id: staffMember.salon_id,
          code,
          name,
          channel,
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          sms_body: smsBody,
          available_variables: availableVariables,
          is_active: isActive ?? true,
        });

      if (error) {
        console.error('Template create error:', error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Template save error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
