import { NextResponse } from 'next/server';

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '0.1.0',
    checks: {
      api: 'ok',
    },
  };

  return NextResponse.json(health);
}
