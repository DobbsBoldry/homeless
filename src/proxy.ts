import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Routes that REQUIRE auth. Everything else (including /, /sign-in, /sign-up)
// is public until added here.
const isProtectedRoute = createRouteMatcher(['/app(.*)', '/api/protected(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isProtectedRoute(req)) return;

  const { userId } = await auth();
  if (userId) return;

  // No session: 401 for API requests, redirect-to-sign-in for pages.
  // (Clerk's auth.protect() defaults to a 404 for unauthenticated requests,
  // which is hostile to UX.)
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const signInPath = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in';
  const signIn = new URL(signInPath, req.url);
  signIn.searchParams.set('redirect_url', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(signIn);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files unless found in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
};
