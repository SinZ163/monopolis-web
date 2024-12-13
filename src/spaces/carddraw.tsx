import { onCleanup, useContext } from "solid-js";
import { ThreeContext } from "~/app";
import { USLocale } from "~/common/localization";
import { SpaceProps, useCard, useText } from "./common";

import type { CardDrawSpace } from "~/common/tiledb";

export function CardDrawSpace(props: SpaceProps<CardDrawSpace>) {
    const {scene} = useContext(ThreeContext)!;
  
    const {borderMesh, backMesh} = useCard();
  
    const {textBlock: propertyNameBlock} = useText(USLocale[props.info.id].toUpperCase());
    propertyNameBlock.position.set(0, 35, 0);
  
    // TODO: Chance / Community Chest imagry
  
    const cardGroup = new THREE.Group();
    cardGroup.add(borderMesh);
    cardGroup.add(backMesh);
    cardGroup.add(propertyNameBlock);
    cardGroup.position.set(0, -10, 0);
  
    const group = new THREE.Group();
    group.add(cardGroup);
  
    scene.add(group);
    group.position.set(props.position.x, props.position.y, props.position.z);
    group.rotation.set(props.rotation.x, props.rotation.y, props.rotation.z);
  
    onCleanup(() => scene.remove(group));
    return null;
  }