import { useContext, onCleanup } from "solid-js";
import { ThreeContext } from "~/app";
import { USLocale } from "~/common/localization";
import { SpaceProps, useCard, useMortgage, useText } from "./common";
import ThreeMeshUI from 'three-mesh-ui';

import type { EstateSpace } from "~/common/tiledb";
import { ColourMap } from "~/common/utils";
import { useWSContext } from "~/ws-context";
import { CustomNetTableDeclarations } from "~/common/state";
import { effect } from "solid-js/web";

export function EstateSpace(props: SpaceProps<EstateSpace>) {
    const {scene, raytraceEntities} = useContext(ThreeContext)!;

    const {createWSSignal, dispatch} = useWSContext();
    const [propertyState] = createWSSignal<CustomNetTableDeclarations["property_ownership"]["1"]|undefined>("monopolis:property_ownership:"+props.info.id, undefined);
    const [turnState] = createWSSignal<CustomNetTableDeclarations["misc"]["current_turn"]|undefined>("monopolis:current_turn", undefined);

  
    const {borderMesh, backMesh} = useCard();
  
    const propertySetGeometry = new THREE.PlaneGeometry(78, 20);
    const propertySetMaterial = new THREE.MeshBasicMaterial({color: new THREE.Color(ColourMap[props.info.category]), depthWrite: false});
    const propertySetMesh = new THREE.Mesh(propertySetGeometry, propertySetMaterial);
    propertySetMesh.position.set(0, 40, 0);
    propertySetMesh.renderOrder = 2;
  
    const {textBlock: propertyNameBlock} = useText(USLocale[props.info.id].toUpperCase());
    propertyNameBlock.position.set(0, 20, 0);
  
    const {textBlock: purchasePriceBlock} = useText("$" + new Intl.NumberFormat().format(props.info.purchasePrice));
    purchasePriceBlock.position.set(0, -40, 0);

    const mortgageBlock = useMortgage(props);
  
    const cardGroup = new THREE.Group();
    cardGroup.add(borderMesh);
    cardGroup.add(backMesh);
    cardGroup.add(propertySetMesh);
    cardGroup.add(propertyNameBlock);
    cardGroup.add(purchasePriceBlock);
    cardGroup.add(mortgageBlock);
    cardGroup.position.set(0, -10, 0);
  
    const group = new THREE.Group();
    group.add(cardGroup);
  
    scene.add(group);
    group.position.set(props.position.x, props.position.y, props.position.z);
    group.rotation.set(props.rotation.x, props.rotation.y, props.rotation.z);
  
    onCleanup(() => scene.remove(group));
    return null;
  }