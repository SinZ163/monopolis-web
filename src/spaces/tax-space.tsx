import { useContext, onCleanup } from "solid-js";
import { ThreeContext } from "~/app";
import { SpaceProps, useCard, useText } from "./common";
import type { TaxSpace } from "~/common/tiledb";
import { USLocale } from "~/common/localization";

export function TaxSpace(props: SpaceProps<TaxSpace>) {
  const { scene } = useContext(ThreeContext)!;

  const { borderMesh, backMesh } = useCard();

  const { textBlock: propertyNameBlock } = useText(
    USLocale[props.info.id].toUpperCase()
  );
  propertyNameBlock.position.set(0, 35, 0);

  // TODO: imagry
  const { textBlock: purchasePriceBlock } = useText("$" + props.info.cost);
  purchasePriceBlock.position.set(0, -40, 0);

  const cardGroup = new THREE.Group();
  cardGroup.add(borderMesh);
  cardGroup.add(backMesh);
  cardGroup.add(propertyNameBlock);
  cardGroup.add(purchasePriceBlock);
  cardGroup.position.set(0, -10, 0);

  const group = new THREE.Group();
  group.add(cardGroup);

  scene.add(group);
  group.position.set(props.position.x, props.position.y, props.position.z);
  group.rotation.set(props.rotation.x, props.rotation.y, props.rotation.z);

  onCleanup(() => scene.remove(group));
  return null;
}
