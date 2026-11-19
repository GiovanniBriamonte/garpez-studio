import Television from './television';
import { videoChannels } from './channels';

export default function Page() {
  return <Television videos={videoChannels()} />;
}
