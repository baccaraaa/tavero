import { Button } from '../components/Button';
import { Card } from '../components/Card';
export function Settings() {
  return (
    <>
      <div className="page-head"><h1>Settings</h1></div>
      <Card title="Workspace">
        <label className="field"><span>Name</span><input defaultValue="Acme" /></label>
        <label className="field"><span>URL</span><input defaultValue="acme.dev" /></label>
        <div className="actions"><Button variant="secondary">Cancel</Button><Button>Save changes</Button></div>
      </Card>
      <Card title="Danger zone"><div className="row"><span>Delete this workspace and all projects</span><button className="danger">Delete workspace</button></div></Card>
    </>
  );
}
