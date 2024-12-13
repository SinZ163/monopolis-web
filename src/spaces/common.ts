import { EstateSpace, RailRoadSpace, Space, UtilitySpace } from "~/common/tiledb";
import * as THREE from "three";
import ThreeMeshUI from 'three-mesh-ui';
import { Accessor, useContext } from "solid-js";
import { CustomNetTableDeclarations } from "~/common/state";
import { ThreeContext } from "~/app";
import { useWSContext } from "~/ws-context";
import { effect } from "solid-js/web";

export interface SpaceProps<T extends Space> {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  info: T;
  localLobbyPlayer: Accessor<[number, CustomNetTableDeclarations["lobbyData"]["players"][1]]|undefined>;
}

export function useCard() {
  const borderGeometry = new THREE.PlaneGeometry(80, 100);
  const borderMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    depthWrite: false,
  });
  const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);

  const backGeometry = new THREE.PlaneGeometry(78, 99);
  const backMaterial = new THREE.MeshBasicMaterial({
    color: 0xd1e5d1,
    depthWrite: false,
  });
  const backMesh = new THREE.Mesh(backGeometry, backMaterial);
  backMesh.position.y = -0.5;

  return { borderMesh, backMesh };
}
export function useText(content: string) {
  const textBlock = new ThreeMeshUI.Block({
    width: 78,
    height: 10,
    padding: 0.2,
    backgroundOpacity: 0,
    fontFamily: "/Roboto-msdf.json",
    fontTexture: "/Roboto-msdf.png",
  });
  textBlock.frame.material.depthWrite = false;
  const text = new ThreeMeshUI.Text({
    content,
    fontSize: 9,
    fontColor: new THREE.Color(0x000000),
  });
  textBlock.add(text);
  return { text, textBlock };
}

export function useMortgage(props: SpaceProps<EstateSpace|RailRoadSpace|UtilitySpace>) {
    
    const {raytraceEntities} = useContext(ThreeContext)!;
    const {createWSSignal, dispatch} = useWSContext();
    const [propertyState] = createWSSignal<CustomNetTableDeclarations["property_ownership"]["1"]|undefined>("monopolis:property_ownership:"+props.info.id, undefined);
    const [turnState] = createWSSignal<CustomNetTableDeclarations["misc"]["current_turn"]|undefined>("monopolis:current_turn", undefined);
    
    const mortgageBlock = new ThreeMeshUI.Block({
        width: 78,
        height: 10,
        padding: 0.2,
        fontFamily: "/Roboto-msdf.json",
        fontTexture: "/Roboto-msdf.png",
        
    });
    mortgageBlock.setupState({
        state: 'idle',
        attributes: {
            backgroundColor: new THREE.Color(0xbbbbbb),
            fontColor: new THREE.Color(0xffffff),
        }
    });
    mortgageBlock.setupState({
        state: 'hovered',
        attributes: {
            backgroundColor: new THREE.Color(0xdddddd),
            fontColor: new THREE.Color(0xffffff),
        }
    });
    mortgageBlock.setupState({
        state: 'selected',
        attributes: {
            backgroundColor: new THREE.Color(0xffffff),
            fontColor: new THREE.Color(0x000000),
        },
        onSet: () => {
            console.log("Clicked on ", props.info.id);
            let propState = propertyState();
            if (!propState) return;
            let houseCount = 0;
            if (propState.houseCount === 0) {
                houseCount = -1;
            }
            dispatch({id: "monopolis_requestrenovation", payload: {property: props.info.id, houseCount}})
        }
    });
    mortgageBlock.setState("idle");
    mortgageBlock.frame.material.depthWrite = false;
    const mortgageText = new ThreeMeshUI.Text({
        content: "Mortgage",
        fontSize: 9,
        fontColor: new THREE.Color(0x000000),
    });
    mortgageBlock.add(mortgageText);
    mortgageBlock.frame.layers.set(1);
    mortgageBlock.frame.userData["isUI"] = true;
    mortgageBlock.position.set(0, -60, 0);
    raytraceEntities.push(mortgageBlock);

    effect(() => {
        let player = props.localLobbyPlayer();
        let turn = turnState();
        let propState = propertyState();
        if (!turn || !player || !propState) return;
        if (propState.houseCount === -1) {
            mortgageText.set({content: "Unmortgage"});
        } else {
            mortgageText.set({content: "Mortgage"});
        }
        // TODO: Be more picky in payrent/card_result/auxroll_result that its mortgage but never unmortgage
        if (turn.type !== "endturn" && turn.type !== "payrent" && turn.type !== "card_result" && turn.type !== "auxroll_result") {
            mortgageBlock.visible = false;
            return;
        }
        if (turn.pID !== player[0]) {
            mortgageBlock.visible = false;
            return;
        }
        // Has houses/hotels, they need to be dealt with first
        if (propState.houseCount > 0) {
            mortgageBlock.visible = false;
            return;
        }
        if (propState.owner === player[1].team) {
            mortgageBlock.visible = true;
        } else {
            mortgageBlock.visible = false;
        }
    });
    return mortgageBlock;
}