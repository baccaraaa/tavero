import { describe, it, expect } from 'vitest';
import { parseReactRouterRoutes } from '../../src/runtime/routes/reactRouter.js';

const JSX = `
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/pricing" element={<Pricing />} />
  <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
    <Route index element={<Dashboard />} />
    <Route path="resumes" element={<Resumes />} />
    <Route path="resumes/:resumeId" element={<ResumeView />} />
    <Route path="settings">
      <Route path="profile" element={<Profile />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Route>
  <Route path="/admin/*" element={<Admin />} />
</Routes>
const router = createBrowserRouter([{ path: '/login', element: <Login /> }, { path: 'relative', element: <X /> }]);
`;

describe('parseReactRouterRoutes', () => {
  it('joins nested JSX routes, keeps index as parent, skips dynamic and wildcard', () => {
    const r = parseReactRouterRoutes(JSX);
    expect(r.routes).toEqual(['/', '/dashboard', '/dashboard/resumes', '/dashboard/settings', '/dashboard/settings/profile', '/login', '/pricing']);
    expect(r.skipped.map((s) => s.path).sort()).toEqual(['/admin/*', '/dashboard/*', '/dashboard/resumes/:resumeId', 'relative']);
  });
});
