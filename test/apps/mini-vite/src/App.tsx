import { Home } from './pages/Home';
import { Many } from './pages/Many';
import { Login } from './pages/Login';
export function App() {
  if (location.pathname === '/many') return <Many />;
  if (location.pathname === '/login') return <Login />;
  return <Home />;
}
