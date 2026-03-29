import { NextRequest, NextResponse } from 'next/server';

let userToken: string | null = null;

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  userToken = token;
  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json({ token: userToken });
} 