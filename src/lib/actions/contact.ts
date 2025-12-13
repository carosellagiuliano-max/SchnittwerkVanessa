'use server';

import { z } from 'zod';
import { createServerClient } from '@/lib/db/client';
import { getSalon } from './salon';

// ============================================
// CONTACT FORM SERVER ACTIONS
// ============================================

// Validation schema
const contactFormSchema = z.object({
  firstName: z.string().min(1, 'Vorname ist erforderlich').max(100),
  lastName: z.string().min(1, 'Nachname ist erforderlich').max(100),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  phone: z.string().max(30).optional(),
  reason: z.enum(['termin', 'beratung', 'bewerbung', 'feedback', 'sonstiges']),
  message: z.string().min(10, 'Nachricht muss mindestens 10 Zeichen lang sein').max(5000),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

export type ContactFormResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

// Reason labels for email
const REASON_LABELS: Record<string, string> = {
  termin: 'Terminanfrage',
  beratung: 'Beratungsgespräch',
  bewerbung: 'Bewerbung',
  feedback: 'Feedback',
  sonstiges: 'Sonstiges',
};

// ============================================
// SUBMIT CONTACT FORM
// ============================================

export async function submitContactForm(
  formData: FormData
): Promise<ContactFormResult> {
  try {
    // Parse form data
    const rawData = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string | undefined,
      reason: formData.get('reason') as string,
      message: formData.get('message') as string,
    };

    // Validate
    const validation = contactFormSchema.safeParse(rawData);

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      return {
        success: false,
        error: 'Bitte überprüfen Sie Ihre Eingaben.',
        fieldErrors,
      };
    }

    const data = validation.data;

    // Get salon info
    const salon = await getSalon();

    // Store inquiry in database
    const supabase = createServerClient();

    const { error: dbError } = await supabase
      .from('contact_inquiries')
      .insert({
        salon_id: salon?.id || '550e8400-e29b-41d4-a716-446655440001',
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone || null,
        reason: data.reason,
        message: data.message,
        status: 'new',
      });

    if (dbError) {
      console.error('Error storing contact inquiry:', dbError);
      // Continue anyway - email is more important
    }

    // Send notification email
    const emailSent = await sendContactNotificationEmail(data, salon);

    if (!emailSent) {
      console.error('Failed to send contact notification email');
      // Still return success if DB save worked
    }

    // Log to audit
    await supabase
      .from('audit_logs')
      .insert({
        salon_id: salon?.id || '550e8400-e29b-41d4-a716-446655440001',
        action_type: 'contact_inquiry_submitted',
        target_type: 'contact_inquiry',
        metadata: {
          email: data.email,
          reason: data.reason,
        },
      });

    return { success: true };
  } catch (error) {
    console.error('Contact form submission error:', error);
    return {
      success: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
    };
  }
}

// ============================================
// SEND NOTIFICATION EMAIL
// ============================================

async function sendContactNotificationEmail(
  data: ContactFormData,
  salon: { name: string; email: string | null } | null
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return false;
  }

  const toEmail = salon?.email || 'info@schnittwerk.ch';
  const fromEmail = process.env.EMAIL_FROM || 'noreply@schnittwerk.ch';

  const emailHtml = `
    <h2>Neue Kontaktanfrage über die Website</h2>

    <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Name:</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">E-Mail:</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td>
      </tr>
      ${data.phone ? `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Telefon:</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="tel:${escapeHtml(data.phone)}">${escapeHtml(data.phone)}</a></td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Anliegen:</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${REASON_LABELS[data.reason] || data.reason}</td>
      </tr>
    </table>

    <h3 style="margin-top: 24px;">Nachricht:</h3>
    <div style="background: #f9f9f9; padding: 16px; border-radius: 4px; white-space: pre-wrap;">
${escapeHtml(data.message)}
    </div>

    <p style="margin-top: 24px; color: #666; font-size: 12px;">
      Diese Nachricht wurde über das Kontaktformular auf ${salon?.name || 'SCHNITTWERK'} gesendet.
    </p>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        reply_to: data.email,
        subject: `[${REASON_LABELS[data.reason]}] Kontaktanfrage von ${data.firstName} ${data.lastName}`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Resend API error:', response.status, errorBody);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

// ============================================
// HELPER: Escape HTML
// ============================================

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
