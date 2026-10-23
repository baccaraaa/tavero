'use client';
import { useState } from 'react';
import { Button } from './Button';
export function Counter() {
  const [n, setN] = useState(0);
  return <div className="card"><p>Count: {n}</p><Button variant="primary" onClick={() => setN(n + 1)}>Increment</Button><Button variant="ghost" onClick={() => setN(0)}>Reset</Button></div>;
}
