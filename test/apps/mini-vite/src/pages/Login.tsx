export function Login() {
  return (
    <form onSubmit={(e) => { e.preventDefault(); localStorage.setItem('mini-auth', '1'); location.assign('/'); }} style={{ padding: 24 }}>
      <label>Email <input id="email" type="email" required /></label>
      <label>Password <input type="password" required /></label>
      <button type="submit" className="btn btn-primary">Sign in</button>
    </form>
  );
}
