import { useContext, onCleanup } from "solid-js";
import { ThreeContext } from "~/app";
import type { Space, GOSpace, GOTOJailSpace, JailSpace, FreeParkingSpace } from "~/common/tiledb";
import { SpaceProps } from "./common";

interface ImageSpaceProps extends SpaceProps<Space> {
  image: string;
}
function ImageSpace(props: ImageSpaceProps) {
  const { scene } = useContext(ThreeContext)!;

  const borderGeometry = new THREE.PlaneGeometry(100, 100);
  const borderMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    depthWrite: false,
  });
  const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
  borderMesh.position.set(10, -10, 0);

  const imageGeometry = new THREE.PlaneGeometry(100, 100);
  const imageTexture = new THREE.TextureLoader().load(props.image);
  imageTexture.colorSpace = THREE.SRGBColorSpace;
  const imageMaterial = new THREE.MeshBasicMaterial({
    map: imageTexture,
    depthWrite: false,
  });
  const imageMesh = new THREE.Mesh(imageGeometry, imageMaterial);

  imageMesh.position.set(10, -10, 0);
  imageMesh.rotation.set(
    -props.rotation.x,
    -props.rotation.y,
    -props.rotation.z
  );
  const group = new THREE.Group();
  group.add(borderMesh);
  group.add(imageMesh);

  group.position.set(props.position.x, props.position.y, props.position.z);
  group.rotation.set(props.rotation.x, props.rotation.y, props.rotation.z);

  scene.add(group);
  onCleanup(() => scene.remove(group));
  return null;
}
export function GOSpace(props: SpaceProps<GOSpace>) {
  return <ImageSpace {...props} image="/go.png" />;
}
export function JailSpace(props: SpaceProps<JailSpace>) {
  return <ImageSpace {...props} image="/jail.png" />;
}
export function FreeParkingSpace(props: SpaceProps<FreeParkingSpace>) {
  return <ImageSpace {...props} image="/freeparking.png" />;
}
export function GOTOJailSpace(props: SpaceProps<GOTOJailSpace>) {
  return <ImageSpace {...props} image="/gotojail.png" />;
}
