import { Outlet, Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const LoadingFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const AccessDenied = () => (
  <div className="max-w-md mx-auto mt-16 bg-card border border-border rounded-xl p-8 text-center space-y-3">
    <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground" />
    <h1 className="text-lg font-semibold text-foreground">You don't have access to this page</h1>
    <p className="text-sm text-muted-foreground">
      This area is restricted to certain roles. Ask an admin in your organisation
      if you think you should be able to see it.
    </p>
    <Link to="/" className="inline-block text-sm font-medium text-primary underline">
      Back to dashboard
    </Link>
  </div>
);

/**
 * Route guard for role-restricted areas. Use as a layout route:
 *
 *   <Route element={<ProtectedRoute roles={['admin']} />}>
 *     <Route path="/settings" element={<Settings />} />
 *   </Route>
 *
 * Note: this is a UX guard only — real enforcement lives in backend
 * functions and Base44 entity security rules. Anything a role must not be
 * able to DO has to be blocked server-side as well.
 */
export default function ProtectedRoute({ roles }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return <LoadingFallback />;

  // Unauthenticated users are handled by AuthenticatedApp (redirect to login).
  if (!isAuthenticated || !user) return <LoadingFallback />;

  if (Array.isArray(roles) && roles.length > 0 && !roles.includes(user.role)) {
    return <AccessDenied />;
  }

  return <Outlet />;
}
