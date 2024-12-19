import { Accessor, Component, useContext } from "solid-js";
import { effect } from "solid-js/web";
import { ThreeContext } from "~/app";
import { CustomNetTableDeclarations } from "~/common/state";
import { useWSContext } from "~/ws-context";
import ThreeMeshUI from 'three-mesh-ui'

import type { Space } from "~/common/tiledb";
import { FreeParkingSpace, GOSpace, GOTOJailSpace, JailSpace } from "./imagespace";
import { SpaceProps } from "./common";
import { calculateXYForSpacePosition } from "~/common/utils";
import { TaxSpace } from "./tax-space";
import { UtilitySpace } from "./utility";
import { RailRoadSpace } from "./railroad";
import { CardDrawSpace } from "./carddraw";
import { EstateSpace } from "./estate";
import { LobbyState } from "~/common/turnstate";

export type SpaceMap = {
    [P in Space["type"]]: Component<SpaceProps<Extract<Space, { type: P}>>>
}
export function Space({info, index, localLobbyPlayer}: {info: Space, index: number, localLobbyPlayer: Accessor<[number, CustomNetTableDeclarations["lobbyData"]["players"][1]]|undefined>}) {
    const {createWSSignal} = useWSContext();
    const [turnState] = createWSSignal<CustomNetTableDeclarations["misc"]["current_turn"]|undefined>("monopolis:current_turn", undefined);
    const [propertyState] = createWSSignal<CustomNetTableDeclarations["property_ownership"]["1"]|undefined>("monopolis:property_ownership:"+info.id, undefined);
    const [lobbyData] = createWSSignal<CustomNetTableDeclarations["lobbyData"]|undefined>("monopolis:lobbyData", undefined);
    const {scene} = useContext(ThreeContext)!;
    const SpaceMap: SpaceMap = {
      GO: GOSpace,
      Jail: JailSpace,
      FreeParking: FreeParkingSpace,
      GOTOJail: GOTOJailSpace,
      Estate: EstateSpace,
      Railroad: RailRoadSpace,
      Utility: UtilitySpace,
      CardDraw: CardDrawSpace,
      Tax: TaxSpace,
    }
    const [position, rotation] = calculateXYForSpacePosition(index);
  
    const indicatorMaterial = new THREE.MeshBasicMaterial({color: 0xdddddd, side: THREE.DoubleSide});
    
    const indicatorSemiCircleGeometry = new THREE.CircleGeometry(20, 30, 0, Math.PI);
    const indicatorSemiCircleMesh = new THREE.Mesh(indicatorSemiCircleGeometry, indicatorMaterial);
    indicatorSemiCircleMesh.position.y = 30;
  
    const indicatorRectGeometry = new THREE.PlaneGeometry(40, 30);
    const indicatorRectMesh = new THREE.Mesh(indicatorRectGeometry, indicatorMaterial);
    indicatorRectMesh.position.y = 15;
  
    const indicatorTextBlock = new ThreeMeshUI.Block({
      width: 40,
      height: 40,
      padding: 0.2,
      backgroundColor: new THREE.Color(0xdddddd),
      borderRadius: [20, 20, 0, 0],
      fontFamily: '/Roboto-msdf.json',
      fontTexture: '/Roboto-msdf.png',
      //fontSide: THREE.DoubleSide,
      backgroundSide: THREE.DoubleSide
    });
    indicatorTextBlock.frame.material.side = THREE.DoubleSide;
    const text = new ThreeMeshUI.Text({content: "\n\n12", fontSize: 9, fontColor: new THREE.Color(0x000000), fontSide: THREE.DoubleSide,});
    indicatorTextBlock.add(text);
    indicatorTextBlock.position.y = 20;
  
    const indicatorGroup = new THREE.Group();
    //indicatorGroup.add(indicatorSemiCircleMesh);
    //indicatorGroup.add(indicatorRectMesh);
    indicatorGroup.add(indicatorTextBlock);
  
    indicatorGroup.position.y = 40;
    indicatorGroup.rotation.x = Math.PI / 2;
    indicatorGroup.visible = false;
  
    const group = new THREE.Group();
    group.add(indicatorGroup);
    group.position.set(position.x, position.y, position.z);
  
    group.rotation.set(rotation.x, rotation.y, rotation.z + (index % 10 === 0 ? Math.PI/2 : 0));
    scene.add(group);
  
    effect(() => {
      let property = propertyState();
      let lobby = lobbyData();
      if (!property || !lobby) return;
      if (property.owner !== -1) {
        // TODO: This is a problem, conflating team and player
        indicatorTextBlock.set({backgroundColor: new THREE.Color(lobby.players[property.owner].colour)})
      }
    });
    effect(() => {
      let turn = turnState();
      if (turn?.type == "start" || turn?.type == "jailed") {
        let indicator = turn.indicators[info.id];
        if (indicator) {
          text.set({content: "\n\n" + indicator.toString()})
          indicatorGroup.visible = true;
        } else {
          indicatorGroup.visible = false;
        }
      }
      else if (turn?.type == "endturn") {
        indicatorGroup.visible = false;
      }
    });
  
    return (
      //@ts-expect-error (Dynamic can't know the discrimated union got discriminated when passing info downstream)
      <Dynamic component={SpaceMap[info.type]} position={position} info={info} rotation={rotation} localLobbyPlayer={localLobbyPlayer} />
    )
  }