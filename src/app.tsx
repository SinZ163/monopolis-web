import { Accessor, Component, For, Index, JSX, Match, Show, Signal, Suspense, Switch, createContext, createEffect, createSignal, onCleanup, untrack, useContext } from "solid-js";
import "./app.css";
import { Dynamic, effect } from "solid-js/web";
import { degToRad } from "three/src/math/MathUtils";
import { MapControls } from 'three/addons/controls/MapControls.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import ThreeMeshUI from 'three-mesh-ui'
import { styled } from "solid-styled-components";

import type { Space, GOSpace, JailSpace, EstateSpace, FreeParkingSpace, GOTOJailSpace, CardDrawSpace, RailRoadSpace, UtilitySpace, TaxSpace } from "./common/tiledb";
import { TileDB } from "./common/tiledb";

import * as THREE from "three";
window.THREE = THREE;

import 'solid-devtools';
import { CustomNetTableDeclarations } from "./common/state";
import { EventMessage } from "./common/message";
import { ColourToString, PlayerColors } from "./common/utils";
import { AuxRollResultState, CardPendingState, CardResultState, DiceRollState, JailedState, PayRentState, UnOwnedState } from "./common/turnstate";
import { generateUUID } from "three/src/math/MathUtils.js";

const ws = new WebSocket("ws://localhost:3000/_ws");


interface Player {
  money: number;
  position: number;
  color: number;
}


// TODO: More Generic
const USLocale: Record<string, string> = {
  "GO": "Go",
  "BrownA": "Mediterranean Avenue",
  "CommunityChestA": "Community Chest",
  "BrownB": "Baltic Avenue",
  "IncomeTax": "Income Tax",
  "RailroadA": "Reading Railroad",
  "LightBlueA": "Oriental Avenue",
  "ChanceA": "Chance",
  "LightBlueB": "Vermont Avenue",
  "LightBlueC": "Connecticut Avenue",
  "Jail": "Jail",
  "PinkA": "St. Charles Place",
  "ElectricCompany": "Electric Company",
  "PinkB": "States Avenue",
  "PinkC": "Virginia Avenue",
  "RailroadB": "Pennsylyania Railroad",
  "OrangeA": "St. James Place",
  "CommunityChestB": "Community Chest",
  "OrangeB": "Tennessee Avenue",
  "OrangeC": "New York Avenue",
  "FreeParking": "Free Parking",
  "RedA": "Kentucky Avenue",
  "ChanceB": "Chance",
  "RedB": "Indiana Avenue",
  "RedC": "Illinois Avenue",
  "RailroadC": "B & O Railroad",
  "YellowA": "Atlantic Avenue",
  "YellowB": "Ventnor Avenue",
  "Waterworks": "Water Works",
  "YellowC": "Marvin Gardens",
  "GOTOJail": "Go to Jail",
  "GreenA": "Pacific Avenue",
  "GreenB": "North Carolina Avenue",
  "CommunityChestC": "Community Chest",
  "GreenC": "Pennsylyania Avenue",
  "RailroadD": "Short Line",
  "ChanceC": "Chance",
  "DarkBlueA": "Park Place",
  "SuperTax": "Luxury Tax",
  "DarkBlueB": "Boardwalk",
}

const ColourMap = {
  "Brown": new THREE.Color(0x7e4b27),
  "LightBlue": new THREE.Color(0x9fd3ed),
  "Pink": new THREE.Color(0xc93182),
  "Orange": new THREE.Color(0xe3992d),
  "Red": new THREE.Color(0xcf112e),
  "Yellow": new THREE.Color(0xebea50),
  "Green": new THREE.Color(0x3eab5c),
  "DarkBlue": new THREE.Color(0x446aa9),
}

function dispatch<T extends Omit<EventMessage, "type">>(ws: WebSocket, event: T) {
  ws.send(JSON.stringify({
    ...event,
    type: "event",
  }));
}

const wsRegistrationCache: Record<string, any> = {};
ws.addEventListener("message", ev => {
  let msg = JSON.parse(ev.data);
  if ("id" in msg && "value" in msg) {
    wsRegistrationCache[msg.id] = msg.value;
  }
});

function createWSSignal<T>(ws: WebSocket, identifier: string, defaultValue: T): Signal<T> {
  const [value, setValue] = createSignal(defaultValue);

  const [bypass, setBypass] = createSignal(true);
  if (!wsRegistrationCache[identifier]) {
    ws.send(JSON.stringify({
      type: "register",
      id: identifier,
      defaultValue
    }));
  } else {
    setBypass(true);
    setValue(wsRegistrationCache[identifier]);
  }

  const handleMessage = (ev: MessageEvent) => {
    let msg = JSON.parse(ev.data);
    if ("id" in msg && "value" in msg) {
      if (msg.id === identifier) {
        setBypass(true);
        setValue(msg.value);
      }
    }
  };
  ws.addEventListener("message", handleMessage);
  onCleanup(() => {
    ws.removeEventListener("message", handleMessage);
  });
  

  createEffect(() => {
    const val = value();
    if (ws.readyState !== ws.OPEN) return;
    let bypassVal = false;
    untrack(() => {
      bypassVal = bypass();
    })
    if (bypassVal) {
      setBypass(false);
      return;
    }
    ws.send(JSON.stringify({
      type: "change",
      id: identifier,
      value: value()
    }));
  });
  return [value, setValue];
}

interface ImageSpaceProps extends SpaceProps<Space> {
  image: string;
}
function ImageSpace(props: ImageSpaceProps) {
  const {scene} = useContext(ThreeContext)!;

  const borderGeometry = new THREE.PlaneGeometry(100, 100);
  const borderMaterial = new THREE.MeshBasicMaterial({color: 0x000000, depthWrite: false });
  const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
  borderMesh.position.set(10, -10, 0);

  const imageGeometry = new THREE.PlaneGeometry(100, 100);
  const imageTexture = new THREE.TextureLoader().load(props.image);
  imageTexture.colorSpace = THREE.SRGBColorSpace; 
  const imageMaterial = new THREE.MeshBasicMaterial( { map: imageTexture, depthWrite: false } );
  const imageMesh = new THREE.Mesh( imageGeometry, imageMaterial );

  imageMesh.position.set(10, -10, 0);
  imageMesh.rotation.set(-props.rotation.x, -props.rotation.y, -props.rotation.z);  
  const group = new THREE.Group();
  group.add(borderMesh);
  group.add(imageMesh);

  group.position.set(props.position.x, props.position.y, props.position.z);
  group.rotation.set(props.rotation.x, props.rotation.y, props.rotation.z);  

  scene.add( group );
  onCleanup(() => scene.remove(group));
  return null;
}
function GOSpace(props: SpaceProps<GOSpace>) {
  return <ImageSpace {...props} image="/go.png" /> 
}
function JailSpace(props: SpaceProps<JailSpace>) {
  return <ImageSpace {...props} image="/jail.png" /> 
}
function FreeParkingSpace(props: SpaceProps<FreeParkingSpace>) {
  return <ImageSpace {...props} image="/freeparking.png" /> 
}
function GOTOJailSpace(props: SpaceProps<GOTOJailSpace>) {
  return <ImageSpace {...props} image="/gotojail.png" /> 
}

function useCard() {
  const borderGeometry = new THREE.PlaneGeometry(80, 100);
  const borderMaterial = new THREE.MeshBasicMaterial({color: 0x000000, depthWrite: false });
  const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);

  const backGeometry = new THREE.PlaneGeometry(78, 99);
  const backMaterial = new THREE.MeshBasicMaterial({color: 0xd1e5d1, depthWrite: false });
  const backMesh = new THREE.Mesh(backGeometry, backMaterial);
  backMesh.position.y = -0.5;

  return {borderMesh, backMesh};
}
function useText(content: string) {
  const textBlock = new ThreeMeshUI.Block({
    width: 78,
    height: 10,
    padding: 0.2,
    backgroundOpacity: 0,
    fontFamily: '/Roboto-msdf.json',
    fontTexture: '/Roboto-msdf.png',
  });
  textBlock.frame.material.depthWrite = false;
  const text = new ThreeMeshUI.Text({content, fontSize: 9, fontColor: new THREE.Color(0x000000)});
  textBlock.add(text);
  return {text, textBlock};
}

function EstateSpace(props: SpaceProps<EstateSpace>) {
  const {scene} = useContext(ThreeContext)!;

  const {borderMesh, backMesh} = useCard();

  const propertySetGeometry = new THREE.PlaneGeometry(78, 20);
  const propertySetMaterial = new THREE.MeshBasicMaterial({color: ColourMap[props.info.category], depthWrite: false});
  const propertySetMesh = new THREE.Mesh(propertySetGeometry, propertySetMaterial);
  propertySetMesh.position.set(0, 40, 0);
  propertySetMesh.renderOrder = 2;

  const {textBlock: propertyNameBlock} = useText(USLocale[props.info.id].toUpperCase());
  propertyNameBlock.position.set(0, 20, 0);

  const {textBlock: purchasePriceBlock} = useText("$" + new Intl.NumberFormat().format(props.info.purchasePrice));
  purchasePriceBlock.position.set(0, -40, 0);

  const cardGroup = new THREE.Group();
  cardGroup.add(borderMesh);
  cardGroup.add(backMesh);
  cardGroup.add(propertySetMesh);
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

function CardDrawSpace(props: SpaceProps<CardDrawSpace>) {
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

function RailRoadSpace(props: SpaceProps<RailRoadSpace>) {
  const {scene} = useContext(ThreeContext)!;

  const {borderMesh, backMesh} = useCard();

  const {textBlock: propertyNameBlock} = useText(USLocale[props.info.id].toUpperCase());
  propertyNameBlock.position.set(0, 35, 0);

  
  const {textBlock: purchasePriceBlock} = useText("$200");
  purchasePriceBlock.position.set(0, -40, 0);

  // TODO: train imagry

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

function UtilitySpace(props: SpaceProps<UtilitySpace>) {
  const {scene} = useContext(ThreeContext)!;

  const {borderMesh, backMesh} = useCard();

  const {textBlock: propertyNameBlock} = useText(USLocale[props.info.id].toUpperCase());
  propertyNameBlock.position.set(0, 35, 0);
  
  const {textBlock: purchasePriceBlock} = useText("$150");
  purchasePriceBlock.position.set(0, -40, 0);

  // TODO: Utility imagry

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

function TaxSpace(props: SpaceProps<TaxSpace>) {
  const {scene} = useContext(ThreeContext)!;

  const {borderMesh, backMesh} = useCard();

  const {textBlock: propertyNameBlock} = useText(USLocale[props.info.id].toUpperCase());
  propertyNameBlock.position.set(0, 35, 0);

  // TODO: Chance / Community Chest imagry
  const {textBlock: purchasePriceBlock} = useText("$" + props.info.cost);
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


interface ThreeContextType {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}
interface SpaceProps<T extends Space> {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  info: T;
}

type SpaceMap = {
  [P in Space["type"]]: Component<SpaceProps<Extract<Space, { type: P}>>>
}

function calculateXYForSpacePosition(index: number) {
  
  // TODO: Refactor when more complex boards exist
  const side = Math.floor(index / 10);
  const delta = index % 10;

  let xComponent = 0;
  let yComponent = 0;
  switch (side) {
    case 0:
      yComponent = 0;
      xComponent = -1 * delta * 80;
      break;
    case 1:
      xComponent = -800;
      yComponent = delta * 80;
      break;
    case 2:
      yComponent = 800;
      xComponent = -800 + (delta * 80);
      break;
    case 3:
      xComponent = 0;
      yComponent = 800 - (delta * 80);
      break;
  }

  // index 0 = 0,0
  // index 10 = 1000, 0
  // index 20 = 1000, 1000
  // index 30 = 0, 1000
  // index 40 = 0,0
  return [new THREE.Vector3(xComponent, yComponent, 0), new THREE.Euler(0, 0, degToRad(-90 * side))];
}

function Space({info, index}: {info: Space, index: number}) {
  const [turnState] = createWSSignal<CustomNetTableDeclarations["misc"]["current_turn"]|undefined>(ws, "monopolis:current_turn", undefined);
  const [propertyState] = createWSSignal<CustomNetTableDeclarations["property_ownership"]["1"]|undefined>(ws, "monopolis:property_ownership:"+info.id, undefined);
  const [lobbyData] = createWSSignal<CustomNetTableDeclarations["lobbyData"]|undefined>(ws, "monopolis:lobbyData", undefined);
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
    backgroundColor: new THREE.Color(0xdddddd), // TODO: Ownership colour
    borderRadius: [20, 20, 0, 0],
    fontFamily: '/Roboto-msdf.json',
    fontTexture: '/Roboto-msdf.png',
    //fontSide: THREE.DoubleSide,
    backgroundSide: THREE.DoubleSide
  });
  indicatorTextBlock.frame.material.side = THREE.DoubleSide;
  console.log(indicatorTextBlock);
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
    console.log(turn, info);
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
    <Dynamic component={SpaceMap[info.type]} position={position} info={info} rotation={rotation} />
  )
}
function Player({index}: {index: number}) {
  const {scene} = useContext(ThreeContext)!;

  const [playerState] = createWSSignal<CustomNetTableDeclarations["player_state"]["1"] | undefined>(ws, `monopolis:player_state:${index}`, undefined);

  const playerCoinGeometry = new THREE.CylinderGeometry(7, 7, 4, 32);
  const playerCoinMaterial = new THREE.MeshBasicMaterial();
  effect(() => {
    if (!playerState()) return;
    console.log("Player State in Player", index, playerState());
    playerCoinMaterial.color = new THREE.Color(playerState()!.colour);
  });
  const playerCoinMesh = new THREE.Mesh(playerCoinGeometry, playerCoinMaterial);
  playerCoinMesh.rotation.x = Math.PI / 2;
  playerCoinMesh.position.z = 2;

  playerCoinMesh.position.x = -30 + (index % 5) * 15;
  playerCoinMesh.position.y = 10 - Math.floor(index / 5) * 15;

  const group = new THREE.Group();
  group.add(playerCoinMesh);

  effect(() => {
    if (!playerState()) return;
    const [position, rotation] = calculateXYForSpacePosition(playerState()!.location);
    group.position.set(position.x, position.y, position.z);
    group.rotation.set(rotation.x, rotation.y, rotation.z);
  });

  scene.add(group);
  return null;
}

const TeamHUDCell = styled("div")`
  position: absolute;
  left: calc(6px + 200px * ${props => props.about});
  bottom: 6px;
  width: 180px;
  background-color: white;
`;
function Team({index}: {index: number}) {
  const [teamState] = createWSSignal<CustomNetTableDeclarations["team_state"]["1"]|undefined>(ws, "monopolis:team_state:"+index, undefined);
  return (
    <Show when={teamState() != undefined}>
      <TeamHUDCell about={index.toString()}>
        <div>{teamState()!.name}</div>
        <div>{teamState()!.money}</div>
      </TeamHUDCell>
    </Show>
  )
}

const TurnIndicator = styled("div")`
  position: absolute;
  width: calc(100vw - 6px);
  height: calc(100vh - 6px);
  top: 0;
  left: 0;
  pointer-events: none;
  border: 3px solid ${props => props.color};
`
const ActionButtonContainer = styled("div")`
  position: absolute;
  bottom: 200px;
  left: 0;
  right: 0;
  margin: 0 auto;
  width: max-content;
`
const DiceRollContainer = styled("div")`
  position: absolute;
  bottom: 300px;
  left: 0;
  right: 0;
  margin: 0 auto;
  width: max-content;
  display: flex;
  flex-direction: row;
  gap: 20px;
`

const CardText = styled("h3")`
  background-color: white;
`
function CardScreen(turnState: CardResultState | AuxRollResultState) {
  const [disabled, setDisabled] = createSignal(true);
  setTimeout(() => setDisabled(false), 1000);
  return (<div>
    <CardText id="card-text">{turnState.card.text}</CardText>
    <button id="trade" onClick={() => dispatch(ws, {id: "monopolis_acknowledgecard", payload: undefined})} disabled={disabled()}>OK</button>
  </div>);
}
function GlobalHUD() {
  const [turnState] = createWSSignal<CustomNetTableDeclarations["misc"]["current_turn"] | undefined>(ws, "monopolis:current_turn", undefined);
  const [lobbyData] = createWSSignal<CustomNetTableDeclarations["lobbyData"] | undefined>(ws, "monopolis:lobbyData", undefined);
  //setInterval(() => {
  //  setCurrentPlayer(prev => (prev + 1) % 25);
  //}, 5000);
  effect(() => console.log("Turn State:", turnState()));
  return (
    <Show when={turnState() != undefined && lobbyData() != undefined}>
      <TurnIndicator color={ColourToString(lobbyData()!.players[turnState()!.pID].colour)} />
      <Show when={turnState()!.type === "diceroll" || turnState()!.type === "auxroll_result"}>
        <DiceRollContainer>
          <CardText>{(turnState() as DiceRollState).dice1}</CardText>
          <CardText>{(turnState() as DiceRollState).dice2}</CardText>
        </DiceRollContainer>
      </Show>
      <ActionButtonContainer>
        <Show when={turnState()!.type === "start" || turnState()!.type === "auxroll_prompt" || (turnState()!.type === "jailed" && (turnState() as JailedState)!.preRolled === false)}>
          <button id="rolldice" onClick={() => dispatch(ws, {id: "monopolis_requestdiceroll", payload: undefined})}>Roll Dice</button>
        </Show>
        <Show when={turnState()!.type === "unowned"}>
          <button id="purchase" onClick={() => dispatch(ws, {id: "monopolis_requestpurchase", payload: undefined})}>Purchase for ${(TileDB.find(tile => tile.id === (turnState() as UnOwnedState)!.property) as EstateSpace).purchasePrice}</button>
        </Show>
        <Show when={turnState()!.type === "unowned"}>
          <button id="auction" onClick={() => dispatch(ws, {id: "monopolis_requestauction", payload: undefined})}>Auction</button>
        </Show>
        <Show when={turnState()!.type === "payrent"}>
          <button id="payrent" onClick={() => dispatch(ws, {id: "monopolis_requestpayrent", payload: undefined})}>Pay ${(turnState() as PayRentState).price}</button>
        </Show>
        <Show when={turnState()!.type === "jailed"}>
          <button id="payjail" onClick={() => dispatch(ws, {id: "monopolis_requestpayrent", payload: undefined})}>Pay $50</button>
        </Show>
        <Show when={turnState()!.type === "endturn"}>
          <button id="endturn" onClick={() => dispatch(ws, {id: "monopolis_endturn", payload: undefined})}>End turn</button>
        </Show>
        <Show when={turnState()!.type === "endturn"}>
          <button id="trade" onClick={() => dispatch(ws, {id: "monopolis_requesttrade", payload: undefined})}>Trade</button>
        </Show>
        <Show when={turnState()!.type === "card_prompt"}>
          <button id="trade" onClick={() => dispatch(ws, {id: "monopolis_requestcard", payload: undefined})}>Draw {(turnState() as CardPendingState).deck} card</button>
        </Show>
        <Show when={turnState()!.type === "card_result" || turnState()!.type === "auxroll_result"}>
          <CardScreen {...turnState() as CardResultState | AuxRollResultState} />
        </Show>
      </ActionButtonContainer>
    </Show>
  )
}

const LobbyMenu = styled("div")`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto auto;
  width: max-content;
  height: max-content;
  background-color: white;
`
const FlexRow = styled("div")`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 10px;
`
const Column = styled("div")`
  display: flex;
  flex-direction: column;
`
function LobbyManagement({lobby}: {lobby: Accessor<CustomNetTableDeclarations["lobbyData"]>}) {
  const [localId, setLocalId] = createSignal(sessionStorage.getItem("MONOPOLIS_LOCALID"));

  const proposedLocalId = generateUUID();

  const [localName, setLocalName] = createSignal("");
  const [localColour, setLocalColour] = createSignal<number|undefined>();

  const localTeam = () => lobby().players.find(player => player.localId === localId())?.team;

  const isFirstPlayer = () => lobby().players[0] != undefined && lobby().players[0].localId === localId();

  const unassignedPlayers = () => lobby().players.filter(player => player.team === -1);

  effect(() => {
    if (localId() != null && !lobby().players.find(player => player.localId === localId())) {
      setLocalId(null);
    }
    if (localId() == null && lobby().players.find(player => player.localId === proposedLocalId)) {
      setLocalId(proposedLocalId);
      sessionStorage.setItem("MONOPOLIS_LOCALID", proposedLocalId);
    }
  });
  const [pendingTeamName, setPendingTeamName] = createSignal("");
  return (<LobbyMenu>
    <h1>Lobby Management</h1>
    <Show when={localId() == null}>
      <Column>
        <label>Player Name: </label>
        <input type="text" value={localName()} onInput={e => setLocalName(e.currentTarget.value)}></input>
        <label>Colour picker</label>
        <FlexRow>
          <Index each={PlayerColors}>
            {(colour, index) => lobby().players.find(player => player.colour === colour()) == null && <button style={{"background-color": ColourToString(colour()), height: "20px"}} onClick={e => setLocalColour(colour())}></button>}
          </Index>
        </FlexRow>
        <button disabled={localColour() == null || localName().length < 1} onClick={() => dispatch(ws, {id: "lobby_addplayer", payload: {playerName: localName(), playerColour: localColour()!, localId: proposedLocalId}})}>Join Game</button>
      </Column>
    </Show>
    <Show when={localId() != null}>
      <Show when={unassignedPlayers().length > 0}>
        <FlexRow style={{"justify-content": "flex-start"}}>
          <b><label>Unassigned Players:</label></b>
          <For each={unassignedPlayers()}>
            {(item, index) => <span>{item.name}</span>}
          </For>
        </FlexRow>
      </Show>
      <FlexRow>
        <Index each={lobby().teams}>
          {(team, tID) => <Column>
            <h3>{team().name}</h3>
            <Index each={lobby().players}>
              {(player, pID) => <Show when={player().team === tID}>
                <h4>{player().name}</h4>
              </Show>}
            </Index>
            <Show when={localTeam() === -1}>
              <button onClick={() => dispatch(ws, {id: "lobby_jointeam", payload: {teamId: tID}})}>Join Team</button>
            </Show>
          </Column>}
        </Index>
        <Show when={lobby().teams.length < 8}>
          <Column>
            <input type="text" value={pendingTeamName()} oninput={e => setPendingTeamName(e.currentTarget.value)}></input>
            <button disabled={pendingTeamName().length < 1} onClick={() => dispatch(ws, {id: "lobby_addteam", payload: {teamName: pendingTeamName()}})}>Add Team</button>
          </Column>
        </Show>
      </FlexRow>
      <Show when={isFirstPlayer()}>
        <button onclick={() => dispatch(ws, {id: "lobby_start", payload: undefined})}>Start Game</button>
      </Show>
    </Show>
  </LobbyMenu>);
}
function Monopolis() {
  const [lobbyState] = createWSSignal<CustomNetTableDeclarations["lobbyData"]|undefined>(ws, "monopolis:lobbyData", undefined);
  
  const localId = sessionStorage.getItem("MONOPOLIS_LOCALID"); 
  if (localId) {
    ws.send(JSON.stringify({type: "resume", localId }));
  }
  return (
    <Show when={lobbyState() != undefined}>
      <Index each={TileDB}>
        {(item, index) => <Space info={item()} index={index} />}
      </Index>
      <Show when={lobbyState()!.started}>
        <Index each={lobbyState()!.players}>
          {(item, index) => <Player index={index} />}
        </Index>
        <Index each={lobbyState()!.teams}>
          {(item, index) => <Team index={index} />}
        </Index>
        <GlobalHUD />
      </Show>
      <Show when={lobbyState()!.started === false}>
        <LobbyManagement lobby={lobbyState}/>
      </Show>
    </Show>
  )
}

export const ThreeContext = createContext<ThreeContextType>();
export default function App() {
  const [wsReady, setWSReady] = createSignal(false);

  ws.addEventListener("open", () => setWSReady(true));
  ws.addEventListener("close", () => setWSReady(false));

  const clock = new THREE.Clock();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
  camera.up = new THREE.Vector3(0, 0, 1);
  camera.position.set(-400, -200, 400);
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(window.innerWidth, window.innerHeight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target = new THREE.Vector3(-400, 400, 0);
  //controls.screenSpacePanning = true;

  function renderLoop() {
    controls.update( clock.getDelta() );
    renderer.render(scene, camera);
    ThreeMeshUI.update();
  }
  renderer.setAnimationLoop(renderLoop);

  const global = window as unknown as any;
  global["monoplis_scene"] = scene;
  global["monopolis_camera"] = camera;
  global["monopolis_renderer"] = renderer;

  return (
    <ThreeContext.Provider value={{scene, camera, renderer}}>
      <Show when={wsReady()}>
        {renderer.domElement}
        <Monopolis />
      </Show>
    </ThreeContext.Provider>
  );
}
