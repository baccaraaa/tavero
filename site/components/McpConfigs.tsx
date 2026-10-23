import { ClientConfigs } from './ClientConfigs';
import { reference } from '@/lib/data';

export function McpConfigs() {
  return <div className="my-6"><ClientConfigs configs={reference.configs} /></div>;
}
