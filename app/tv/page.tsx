import Television from '../television';
import { aboutModels, videoChannels } from '../channels';

export default function Page() {
  return <Television videos={videoChannels()} models={aboutModels()} />;
}
