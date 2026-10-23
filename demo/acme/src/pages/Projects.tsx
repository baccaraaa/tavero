import { Button } from '../components/Button';
import { projects } from '../data';
export function Projects() {
  return (
    <>
      <div className="page-head"><h1>Projects</h1><Button>New project</Button></div>
      <div className="projects">
        {projects.map((p) => (
          <div className="project-card" key={p.name}>
            <h3>{p.name}</h3>
            <div className="meta">{p.owner} · due {p.due} · {p.status}</div>
            <Button variant="ghost">Open</Button>
          </div>
        ))}
      </div>
    </>
  );
}
