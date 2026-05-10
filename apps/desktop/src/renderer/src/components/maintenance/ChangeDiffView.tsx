import { SceneImageGallery } from "@mdcz/views/detail";
import {
  type ChangeDiffViewProps,
  type MaintenanceImageOptionProps,
  type MaintenanceSceneImageOptionProps,
  ChangeDiffView as SharedChangeDiffView,
} from "@mdcz/views/maintenance";
import { resolveDesktopImageCandidates } from "@/adapters/ports";
import { ImageOptionCard } from "@/components/ImageOptionCard";

const renderImageOption = (props: MaintenanceImageOptionProps) => <ImageOptionCard {...props} stacked />;

const renderSceneImages = (props: MaintenanceSceneImageOptionProps) => (
  <SceneImageGallery {...props} resolveImageCandidates={resolveDesktopImageCandidates} />
);

export default function ChangeDiffView(props: ChangeDiffViewProps) {
  return (
    <SharedChangeDiffView {...props} renderImageOption={renderImageOption} renderSceneImages={renderSceneImages} />
  );
}
