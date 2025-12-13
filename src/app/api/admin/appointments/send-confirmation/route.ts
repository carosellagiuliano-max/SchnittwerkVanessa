import { NextRequest, NextResponse } from 'next/server';
import { sendBookingConfirmationEmail } from '@/lib/email';

// ============================================
// SEND BOOKING CONFIRMATION EMAIL API
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      appointmentId,
      customerName,
      customerEmail,
      bookingNumber,
      startsAt,
      endsAt,
      staffName,
      services,
      totalPriceCents,
      salonName,
      salonAddress,
      salonPhone,
    } = body;

    if (!customerEmail || !bookingNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await sendBookingConfirmationEmail({
      customerName: customerName || 'Kunde',
      customerEmail,
      bookingNumber,
      appointmentId: appointmentId || bookingNumber,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      staffName: staffName || 'Unser Team',
      services: services || [],
      totalPriceCents: totalPriceCents || 0,
      salonName: salonName || 'SCHNITTWERK',
      salonAddress: salonAddress || 'St. Gallen',
      salonPhone: salonPhone || '+41 71 222 81 82',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
