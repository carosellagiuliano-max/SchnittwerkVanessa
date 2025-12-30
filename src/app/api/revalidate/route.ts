import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag');
  console.log('[Revalidate API] Called with tag:', tag);

  if (!tag) {
    return NextResponse.json({ error: 'Missing tag parameter' }, { status: 400 });
  }

  try {
    revalidateTag(tag, 'max');
    console.log('[Revalidate API] Successfully revalidated tag:', tag);
    return NextResponse.json({ revalidated: true, tag });
  } catch (error) {
    console.error('[Revalidate API] Error:', error);
    return NextResponse.json({ error: 'Failed to revalidate' }, { status: 500 });
  }
}
