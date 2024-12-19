import { Accessor, For, Index, Match, ParentProps, Show, Switch, createContext, createMemo, createSignal, useContext } from "solid-js";
import "./app.css";
import { effect } from "solid-js/web";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import ThreeMeshUI, { Block } from 'three-mesh-ui'
import { styled } from "solid-styled-components";
import * as i18n from "@solid-primitives/i18n";


import { EstateSpace, TileDB } from "./common/tiledb";
import type {Space as TSpace} from "./common/tiledb";

import {
  DragDropProvider,
  DragDropSensors,
  DragEventHandler,
  createDraggable,
  createDroppable,
} from "@thisbeyond/solid-dnd";

import * as THREE from "three";
window.THREE = THREE;

import 'solid-devtools';
import { CustomNetTableDeclarations, LobbyMetadata, PropertyOwnership, TeamState } from "./common/state";
import { calculateXYForSpacePosition, ColourMap, ColourToString, PlayerColors } from "./common/utils";
import { AuxRollResultState, CardPendingState, CardResultState, DiceRollState, GameEndState, JailedState, PayRentState, UnOwnedState } from "./common/turnstate";
import { generateUUID } from "three/src/math/MathUtils.js";
import { createWebSocket, useWSContext, WSContext } from "./ws-context";
import { Space } from "./spaces/space";
import { MoneyTradeOffer, PropertyTradeOffer, TradeStateStatus } from "./common/tradestate";
import { Deck2008, USLocale } from "./common/localization";

interface Player {
  money: number;
  position: number;
  color: number;
}

function Player({index, teamStates}: {index: number, teamStates: Record<string, Accessor<TeamState|undefined>>}) {
  const {scene} = useContext(ThreeContext)!;

  const {createWSSignal} = useWSContext();

  const [playerState] = createWSSignal<CustomNetTableDeclarations["player_state"]["1"] | undefined>(`monopolis:player_state:${index}`, undefined);

  const playerCoinGeometry = new THREE.CylinderGeometry(7, 7, 4, 32);
  const playerCoinMaterial = new THREE.MeshBasicMaterial();
  const playerCoinMesh = new THREE.Mesh(playerCoinGeometry, playerCoinMaterial);
  effect(() => {
    if (!playerState()) return;
    playerCoinMaterial.color = new THREE.Color(playerState()!.colour);
  });
  effect(() => {
    let player = playerState();
    if (player) {
      let teamState = teamStates[player.team]();
      if (teamState?.alive == false) {
        playerCoinMesh.visible = false;
      }
    }
  });
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
  left: calc(6px + 238px * ${props => props.about});
  bottom: 6px;
  width: 230px;
  background-color: white;
`;
function Team({index, propertyStates}: {index: number, propertyStates: Record<string, Accessor<PropertyOwnership|undefined>>}) {
  const {createWSSignal} = useWSContext();
  const [teamState] = createWSSignal<CustomNetTableDeclarations["team_state"]["1"]|undefined>("monopolis:team_state:"+index, undefined);
  const categories = [...TileDB.filter(tile => tile.type === "Estate").map(tile => tile.category).filter((val, i, array) => array.indexOf(val) === i), "Railroad", "Utility"];
  return (
    <Show when={teamState()?.alive}>
      <TeamHUDCell about={index.toString()}>
        <div>{teamState()!.name}</div>
        <div>{teamState()!.money}</div>
        <FlexRow>
          <For each={categories}>
            {(category) => {
              const categoryColour = ColourToString(ColourMap[category]);
              return (<Column>
              <div style={{width: "10px", height: "3px", "background-color": categoryColour, border: "1px solid black", outline: "1px solid white", margin: "1px"}} />
              <For each={TileDB.filter(tile => tile.type === category || (tile.type === "Estate" && tile.category === category))}>
                {(tile) => {

                  const colour = () => {
                    const owner = propertyStates[tile.id]()?.owner;
                    let colour = categoryColour;
                    /*if (owner !== index) {
                      colour += "30";
                    }*/
                    if (owner === -1) {
                      colour = "#666666";
                    } else if (owner !== index) {
                      colour = "#999999";
                    }
                    return colour;
                  }

                  return <div style={{width: "10px", height: "12.5px", "background-color": colour(), border: "1px solid black", outline: "1px solid white", margin: "1px"}} />
                }}
              </For>
            </Column>)}}
          </For>
        </FlexRow>
      </TeamHUDCell>
    </Show>
  )
}

const TradeContainer = styled("div")`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  margin: auto auto;
  width: max-content;
  height: max-content;
  pointer-events: none;

  margin-top: 50px;

  display: flex;
  flex-direction: row;
  max-width: 95%;
  gap: 30px;
`;

function Draggable({id, data, children}: ParentProps & {id: string, data?: Record<string, any>}) {
  const draggable = createDraggable(id, data);
  return <div style={{"pointer-events": "auto"}} use:draggable>{children}</div>;
}

function PropertyCard({scale, tile, teamId, categoryColour, propertyState}: {scale: number, tile: TSpace, teamId?: number, categoryColour: string, propertyState?: Accessor<PropertyOwnership|undefined>}) {
  const colour = () => {
    const owner = propertyState?.()?.owner;
    let colour = categoryColour;
    /*if (owner !== index) {
      colour += "30";
    }*/
    if (teamId == undefined || propertyState == undefined) return colour;
    
    if (owner === -1) {
      colour = "#666666";
    } else if (owner !== teamId) {
      colour = "#999999";
    }
    return colour;
  }
  const marking = () => {
    if (tile.id.endsWith("A")) return 1;
    if (tile.id.endsWith("B")) return 2;
    if (tile.id.endsWith("C")) return 3;
    if (tile.id.endsWith("D")) return 4;
    if (tile.id === "Waterworks") return "W";
    if (tile.id === "ElectricCompany") return "E";
  } 

  return <div style={{width: `${scale}px`, height: `${scale * 1.25}px`, "background-color": colour(), border: "1px solid black", outline: "1px solid white", margin: "1px"}}>{marking()}</div>
}
function TradeTeamSection({teamData, propertyStates, teamId, trade}: {teamData: Accessor<CustomNetTableDeclarations["lobbyData"]["teams"]["1"]>, propertyStates: Record<string, Accessor<PropertyOwnership|undefined>>, teamId: number, trade: Accessor<CustomNetTableDeclarations["misc"]["trade"]>}) {
  const droppable = createDroppable(teamId);
  const categories = [...TileDB.filter(tile => tile.type === "Estate").map(tile => tile.category).filter((val, i, array) => array.indexOf(val) === i), "Railroad", "Utility"];
  const {createWSSignal} = useWSContext();
  const [teamState] = createWSSignal<CustomNetTableDeclarations["team_state"]["1"]|undefined>("monopolis:team_state:"+teamId, undefined);

  const [money, setMoney] = createSignal(0);

  return (
    <Show when={teamState()?.alive}>
      <div use:droppable>
        <Text>{teamData().name} - {teamState()?.money}</Text>
        <FlexRow>
          <For each={categories}>
            {(category) => {
              const categoryColour = ColourToString(ColourMap[category]);
              return (<Column>
                <div style={{width: "30px", height: "3px", "background-color": categoryColour, border: "1px solid black", outline: "1px solid white", margin: "1px"}} />
                <For each={TileDB.filter(tile => tile.type === category || (tile.type === "Estate" && tile.category === category))}>
                  {(tile) => {
                    const shouldDrag = () => propertyStates[tile.id]()?.owner === teamId && trade()?.status === TradeStateStatus.ModifyTrade;
                    const contents = () => <PropertyCard scale={30} tile={tile} categoryColour={categoryColour} propertyState={propertyStates[tile.id]} teamId={teamId} />;
                    return <Show when={shouldDrag()} fallback={contents()}>
                      <Draggable id={teamId + ":" + tile.id} data={{tile: tile.id, team: teamId, type: "property"}}>{contents()}</Draggable>
                    </Show>;
                  }}
                  </For>
              </Column>)
            }}
          </For>
        </FlexRow>
        <Draggable id={teamId+"|money"} data={{team: teamId, type: "money", money: money}}>
          <Text>Money: {money()}</Text>
          <input style={{"pointer-events": "auto"}} type="number" min="0" max={teamState()?.money} onInput={e => ((e.currentTarget.valueAsNumber <= (teamState()?.money??0)) && (e.currentTarget.valueAsNumber >= 0)) ? setMoney(e.currentTarget.valueAsNumber) : e.currentTarget.valueAsNumber = money()} value={money()} />     
        </Draggable> 
      </div>
    </Show>
  )
}

const RowWrap = styled("div")`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 30px;
`;

const Text = styled("div")`
  color: white; 
  text-shadow: 0.05em 0 black, 0 0.05em black, -0.05em 0 black, 0 -0.05em black, -0.05em -0.05em black, -0.05em 0.05em black, 0.05em -0.05em black, 0.05em 0.05em black;
  align-self: anchor-center;
`;

function Trade({propertyStates}: {propertyStates: Record<string, Accessor<PropertyOwnership|undefined>>}) {
  const {createWSSignal, dispatch} = useWSContext();
  const [lobbyState] = createWSSignal<CustomNetTableDeclarations["lobbyData"]|undefined>("monopolis:lobbyData", undefined);
  const [trade] = createWSSignal<CustomNetTableDeclarations["misc"]["trade"]>("monopolis:trade", undefined);

  const onDragEnd: DragEventHandler = (({draggable, droppable}) => {
    console.log(draggable);
    if (droppable && draggable.data["team"] !== droppable.id) {
      console.log("Drag success");
      // Handle the drop. Note that solid-dnd doesn't move a draggable into a
      // droppable on drop. It leaves it up to you how you want to handle the
      // drop.
      if (draggable.data.type === "property") {
        dispatch({id: "monopolis_trade", payload: {type: "add_property", property: draggable.data["tile"], from: draggable.data["team"], to: Number(droppable.id)}});
      } else if (draggable.data.type === "money") {
        dispatch({id: "monopolis_trade", payload: {type: "add_money", from: draggable.data["team"], to: Number(droppable.id), money: draggable.data.money()}})
      }
    }
  });
  /*
    border: 3px solid red;
    content: "";
    display: block;
    width: calc(100% - 6px);
    height: calc(100% - 6px);
  */

  return (
    <TradeContainer>
      <DragDropProvider
       onDragEnd={onDragEnd}
      >
        <DragDropSensors />
        <RowWrap>
          <Index each={lobbyState()!.teams}>
            {(item, index) => <TradeTeamSection teamData={item} propertyStates={propertyStates} teamId={index} trade={trade} />}
          </Index>
        </RowWrap>
        <Column>
          <div style={{"background-color": "white"}}>Trade Offers</div>
          <div style={{display: "grid", "grid-template-columns": "auto auto auto", "justify-content": "space-between", "column-gap": "4px"}}>
            <Text>From</Text>
            <Text>➡️</Text>
            <Text>To</Text>
            <For each={trade()?.offers ?? []}>
              {(item, index) => <>
                <Text>
                  {lobbyState()?.teams[item.from].name}
                </Text>
                <Show when={item.type === "property"}>
                  {(_) => {
                    let propOffer = (item as PropertyTradeOffer);
                    let property = TileDB.find(prop => prop.id === propOffer.property)!;
                    const categoryColour = ColourToString(ColourMap[property.type === "Estate" ? property.category : property.type]);
                    return <PropertyCard scale={20} tile={property} categoryColour={categoryColour} />;
                  }}
                </Show>
                <Show when={item.type === "money"}>
                  {(_) => {
                    let moneyOffer = (item as MoneyTradeOffer);
                    return <Text>{moneyOffer.money.toLocaleString(undefined)}</Text>
                  }}
                </Show>
                <Text>
                  {lobbyState()?.teams[item.to].name}
                </Text>
              </>}
            </For>
            <Show when={trade()?.status === TradeStateStatus.ModifyTrade}>
              <button style={{"pointer-events": "auto"}} onClick={() => dispatch({id: "monopolis_trade", payload: {type: "confirm"}})}>Confirm</button>
              <span /> {/* Grid filler */}
              <button style={{"pointer-events": "auto"}} onClick={() => dispatch({id: "monopolis_trade", payload: {type: "cancel"}})}>Cancel</button>
            </Show>
            <Show when={trade()?.status === TradeStateStatus.Confirmation}>
              <button style={{"pointer-events": "auto"}} onClick={() => dispatch({id: "monopolis_trade", payload: {type: "accept"}})}>Accept</button>
              <span /> {/* Grid filler */}
              <button style={{"pointer-events": "auto"}} onClick={() => dispatch({id: "monopolis_trade", payload: {type: "reject"}})}>Reject</button>
            </Show>
          </div>
          <Show when={trade()?.status === TradeStateStatus.Confirmation}>
            <FlexRow>
              <Index each={trade()?.participants}>
                {(item, index) => {
                  
                  const background = () => {
                    const status = trade()?.confirmations[item()];
                    if (status === undefined) return "unset";
                    if (status) return "greenyellow";
                    return "red";
                  }

                  return (<div>
                    <Text>{lobbyState()?.teams[item()].name}</Text>
                    <div style={{width: "10px", height: "10px", border: "1px solid black", outline: "1px solid white", background: background() }} />
                  </div>)
                }}
              </Index>
            </FlexRow>
          </Show>
        </Column>
      </DragDropProvider>
    </TradeContainer>
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
  max-width: 50%;
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
  const {dispatch} = useWSContext();
  const [disabled, setDisabled] = createSignal(true);
  setTimeout(() => setDisabled(false), 1000);

  const dict = createMemo(() => Deck2008);

  const t = i18n.translator(dict, i18n.resolveTemplate);

  return (<div>
    <CardText id="card-text">{t(turnState.card.text.substring(1), {...turnState.card, dest: turnState.card.dest && USLocale[turnState.card.dest]})}</CardText>
    <button id="trade" onClick={() => dispatch({id: "monopolis_acknowledgecard", payload: undefined})} disabled={disabled()}>OK</button>
  </div>);
}
function GlobalHUD({propertyStates, teamStates}: {propertyStates: Record<string, Accessor<PropertyOwnership|undefined>>, teamStates: Record<string, Accessor<TeamState|undefined>>}) {
  const {createWSSignal, dispatch} = useWSContext();
  const [turnState] = createWSSignal<CustomNetTableDeclarations["misc"]["current_turn"] | undefined>("monopolis:current_turn", undefined);
  const [lobbyData] = createWSSignal<CustomNetTableDeclarations["lobbyData"] | undefined>("monopolis:lobbyData", undefined);
  const [uiState] = createWSSignal<CustomNetTableDeclarations["misc"]["ui_state"]>("monopolis:ui_state", {type: "n/a"});

  //setInterval(() => {
  //  setCurrentPlayer(prev => (prev + 1) % 25);
  //}, 5000);
  effect(() => console.log("Turn State:", turnState()));

  const Bankruptable = () => {
    const turn = turnState();
    const lobby = lobbyData();
    // Imposible to hit
    if (turn?.type === "lobby" || turn?.type === "gameend") return false;
    let pID = turn?.pID;
    let tID = lobby?.players[pID!].team;
    let teamState = teamStates[tID!]();
    console.log(teamState, turn, lobby);
    if (!teamState) return false;
    if (!turn || (turn.type !== "payrent" && turn.type !== "auxroll_result" && turn.type !== "card_result" && turn.type !== "jailed")) {
      return false;
    }
    if (turn.type === "jailed" && turn.preRolled) {
      return teamState.money < 50; // TODO: Unhardcode
    }
    if (turn.type === "payrent") {
      return turn.price > teamState.money;
    }
    if (turn.type === "card_result" && (turn.card.type === "money_lose" || turn.card.type === "money_lose_others")) {
      return turn.card.value > teamState.money;
    }
    if (turn.type === "auxroll_result") {
      return turn.value > teamState.money;
    }
    return false;
  }

  return (
    <Show when={turnState() != undefined && lobbyData() != undefined}>
      <Show when={turnState()?.type !== "lobby" && turnState()?.type !== "gameend"}>
        <TurnIndicator color={ColourToString(lobbyData()?.players[turnState()?.pID ?? 0].colour ?? 0)} />
      </Show>
      <Show when={turnState()?.type === "gameend"}>
        <DiceRollContainer>
          <Text>{lobbyData()?.teams[(turnState() as GameEndState).winner].name} Wins!</Text>
          <button id="leave" onClick={() => dispatch({id: "start_lobbyleave", payload: undefined})}>Leave Game</button>
        </DiceRollContainer>
      </Show>
      <Show when={turnState()!.type === "diceroll" || turnState()!.type === "auxroll_result"}>
        <DiceRollContainer>
          <CardText>{(turnState() as DiceRollState).dice1}</CardText>
          <CardText>{(turnState() as DiceRollState).dice2}</CardText>
        </DiceRollContainer>
      </Show>
      <Switch>
        <Match when={uiState().type === "trade"}>
          <Trade propertyStates={propertyStates} />
        </Match>
        <Match when={uiState().type === "bankrupt_confirm"}>
          <DiceRollContainer>
            <button id="bankrupt_confirm" onClick={() => dispatch({id: "monopolis_requestbankrupt", payload: true})}>Bankrupt</button>
            <button id="bankrupt_cancel" onClick={() => dispatch({id: "monopolis_requestbankrupt", payload: false})}>Cancel</button>
          </DiceRollContainer>
        </Match>
        <Match when={true}>
          <ActionButtonContainer>
            <Show when={turnState()!.type === "start" || turnState()!.type === "auxroll_prompt" || (turnState()!.type === "jailed" && (turnState() as JailedState)!.preRolled === false)}>
              <button id="rolldice" onClick={() => dispatch({id: "monopolis_requestdiceroll", payload: undefined})}>Roll Dice</button>
            </Show>
            <Show when={turnState()!.type === "unowned"}>
              <button id="purchase" onClick={() => dispatch({id: "monopolis_requestpurchase", payload: undefined})}>Purchase for ${(TileDB.find(tile => tile.id === (turnState() as UnOwnedState)!.property) as EstateSpace).purchasePrice}</button>
            </Show>
            <Show when={turnState()!.type === "unowned"}>
              <button id="auction" onClick={() => dispatch({id: "monopolis_requestauction", payload: undefined})}>Auction</button>
            </Show>
            <Show when={turnState()!.type === "unowned"}>
              <button id="pass" onClick={() => dispatch({id: "monopolis_requestpass", payload: undefined})}>Pass up on Purchase</button>
            </Show>
            <Show when={turnState()!.type === "payrent"}>
              <button id="payrent" onClick={() => dispatch({id: "monopolis_requestpayrent", payload: undefined})}>Pay ${(turnState() as PayRentState).price}</button>
            </Show>
            <Show when={turnState()!.type === "jailed"}>
              <button id="payjail" onClick={() => dispatch({id: "monopolis_requestpayrent", payload: undefined})}>Pay $50</button>
            </Show>
            <Show when={turnState()!.type === "endturn"}>
              <button id="endturn" onClick={() => dispatch({id: "monopolis_endturn", payload: undefined})}>End turn</button>
            </Show>
            <Show when={turnState()!.type === "endturn"}>
              <button id="trade" onClick={() => dispatch({id: "monopolis_requesttrade", payload: undefined})}>Trade</button>
            </Show>
            <Show when={turnState()!.type === "card_prompt"}>
              <button id="trade" onClick={() => dispatch({id: "monopolis_requestcard", payload: undefined})}>Draw {(turnState() as CardPendingState).deck} card</button>
            </Show>
            <Show when={Bankruptable()}>
              <button id="bankrupt" onClick={() => dispatch({id: "monopolis_requestbankrupt", payload: undefined})}>Bankrupt</button>
            </Show>
            <Show when={turnState()!.type === "card_result" || turnState()!.type === "auxroll_result"}>
              <CardScreen {...turnState() as CardResultState | AuxRollResultState} />
            </Show>
          </ActionButtonContainer>
        </Match>
      </Switch>
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
function LobbyManagement({lobby}: {lobby: Accessor<CustomNetTableDeclarations["lobbyData"]|undefined>}) {
  const {createWSSignal, dispatch} = useWSContext();
  const [localId] = createWSSignal("localId", sessionStorage.getItem("MONOPOLIS_LOCALID"));
  const [localName] = createWSSignal("localName", "");
  const [lobbyList] = createWSSignal<LobbyMetadata[]>("lobbyList", []);

  const proposedLocalId = generateUUID();

  // Local state for User Creation
  const [proposedLocalName, setProposedLocalName] = createSignal("");

  // Local state for creating a lobby
  const [proposedLobbyName, setProposedLobbyName] = createSignal("");

  // Local state for Joining as a user in a lobby
  const [localColour, setLocalColour] = createSignal<number|undefined>();
  
  // Local state for creating a team in a lobby
  const [pendingTeamName, setPendingTeamName] = createSignal("");

  const localPlayer = () => lobby()?.players.find(player => player.localId === localId());
  const localTeam = () => localPlayer()?.team;
  const isFirstPlayer = () => lobby()?.players[0] != undefined && lobby()?.players[0].localId === localId();
  const unassignedPlayers = () => lobby()?.players.filter(player => player.team === -1);
  return (<LobbyMenu>
    <h1>Lobby Management</h1>
    <Switch>
      <Match when={localId() == null}>
        <Column>
          <label>Player Name: </label>
          <input type="text" value={proposedLocalName()} onInput={e => setProposedLocalName(e.currentTarget.value)}></input>
          <button disabled={proposedLocalName().length < 1} onClick={() => dispatch({id: "start_createuser", payload: {playerName: proposedLocalName(), localId: proposedLocalId}})}>Select Name</button>
        </Column>
      </Match>
      <Match when={lobby() == null}>
        <h3>Join Lobby</h3>
        <FlexRow>
          <Column>
            <For each={lobbyList()}>
              {(item, index) => <div>
                  <h3>{item.name}{item.status === "inprogress" ? " (in progress)" : item.status === "over" ? " (Ended)" : ""}</h3>
                  <div>hosted by {item.hostName}</div>
                  <div>{item.playerCount}/{item.maxPlayers} players</div>
                  <button disabled={(item.maxPlayers - item.playerCount) < 1} onClick={() => dispatch({id: "start_lobbyjoin", payload: {lobbyId: item.lobbyId}})}>Join Game</button>
                </div>}
            </For>
          </Column>
          <Column>
            <label>Lobby Name:</label>
            <input type="text" value={proposedLobbyName()} onInput={e => setProposedLobbyName(e.currentTarget.value)}></input>
            <button onClick={() => dispatch({id: "start_lobbycreate", payload: {lobbyName: proposedLobbyName()}})}>Create Lobby</button>
          </Column>
        </FlexRow>
      </Match>
      <Match when={true}>
        <Show when={localPlayer()?.configured === false}>
          <Column>
            <label>Colour picker</label>
            <FlexRow>
              <Index each={PlayerColors}>
                {(colour, index) => lobby()?.players.find(player => player.colour === colour()) == null && <button style={{"background-color": ColourToString(colour()), height: "20px"}} onClick={e => setLocalColour(colour())}></button>}
              </Index>
            </FlexRow>
            <button disabled={localColour() == null} onClick={() => dispatch({id: "lobby_addplayer", payload: {playerName: localName(), playerColour: localColour()!, localId: proposedLocalId}})}>Join Game</button>
          </Column>
        </Show>
        <Show when={localPlayer()?.configured === true}>
          <Show when={(unassignedPlayers()?.length ?? 0) > 0}>
            <FlexRow style={{"justify-content": "flex-start"}}>
              <b><label>Unassigned Players:</label></b>
              <For each={unassignedPlayers()}>
                {(item, index) => <span>{item.name}</span>}
              </For>
            </FlexRow>
          </Show>
          <FlexRow>
            <Index each={lobby()?.teams}>
              {(team, tID) => <Column>
                <h3>{team().name}</h3>
                <Index each={lobby()?.players}>
                  {(player, pID) => <Show when={player().team === tID}>
                    <h4>{player().name}</h4>
                  </Show>}
                </Index>
                <Show when={localTeam() === -1}>
                  <button onClick={() => dispatch({id: "lobby_jointeam", payload: {teamId: tID}})}>Join Team</button>
                </Show>
              </Column>}
            </Index>
            <Show when={(lobby()?.teams.length ?? 0) < 8}>
              <Column>
                <input type="text" value={pendingTeamName()} oninput={e => setPendingTeamName(e.currentTarget.value)}></input>
                <button disabled={pendingTeamName().length < 1} onClick={() => dispatch({id: "lobby_addteam", payload: {teamName: pendingTeamName()}})}>Add Team</button>
              </Column>
            </Show>
          </FlexRow>
          <Show when={isFirstPlayer()}>
            <button onclick={() => dispatch({id: "lobby_start", payload: undefined})}>Start Game</button>
          </Show>
          <button id="leave" onClick={() => dispatch({id: "start_lobbyleave", payload: undefined})}>Leave Game</button>
        </Show>
      </Match>
    </Switch>
  </LobbyMenu>);
}

function Monopolis() {
  const {createWSSignal} = useWSContext();
  const [lobbyState] = createWSSignal<CustomNetTableDeclarations["lobbyData"]|undefined>("monopolis:lobbyData", undefined);

  const propertyStates = Object.fromEntries(Object.values(TileDB).filter(tile => tile.type === "Estate" || tile.type === "Railroad" || tile.type === "Utility").map(info => [info.id, createWSSignal<CustomNetTableDeclarations["property_ownership"]["1"]|undefined>("monopolis:property_ownership:"+info.id, undefined)[0]]));
  const teamStates = Object.fromEntries(Array(8).fill(true).map((_,i) => [i, createWSSignal<CustomNetTableDeclarations["team_state"]["1"]|undefined>("monopolis:team_state:"+i, undefined)[0]]));

  const [localId] = createWSSignal("localId", sessionStorage.getItem("MONOPOLIS_LOCALID"));
  effect(() => {
    let id = localId();
    if (id) {
      sessionStorage.setItem("MONOPOLIS_LOCALID", id);
    } else {
      sessionStorage.removeItem("MONOPOLIS_LOCALID");
    }
  });

  effect(() => {
    console.log("Monopolis root", lobbyState());
  })

  const localLobbyPlayer = () => Array.from(lobbyState()?.players.entries() ?? []).find(p => p[1].localId === localId());
  return (
    <>
      <Index each={TileDB}>
        {(item, index) => <Space info={item()} index={index} localLobbyPlayer={localLobbyPlayer} />}
      </Index>
      <Show when={lobbyState()?.status === "inprogress"}>
        <Index each={lobbyState()!.players}>
          {(item, index) => <Player index={index} teamStates={teamStates} />}
        </Index>
        <Index each={lobbyState()!.teams}>
          {(item, index) => <Team index={index} propertyStates={propertyStates} />}
        </Index>
        <GlobalHUD propertyStates={propertyStates} teamStates={teamStates} />
      </Show>
      <Show when={(lobbyState()?.status === "lobby" || !lobbyState())}>
        <LobbyManagement lobby={lobbyState}/>
      </Show>
    </>
  )
}

interface ThreeContextType {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  raytraceEntities: THREE.Object3D[];
}
export const ThreeContext = createContext<ThreeContextType>();

export default function App() {
  const {context, wsErrorReason, wsReady} = createWebSocket();

  const clock = new THREE.Clock();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
  camera.layers.enable(1);
  camera.up = new THREE.Vector3(0, 0, 1);
  camera.position.set(-400, -200, 400);
  const renderer = new THREE.WebGLRenderer({antialias: true});
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);

  const raycaster = new THREE.Raycaster();
  raycaster.layers.set(1);
  const pointer = new THREE.Vector2();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target = new THREE.Vector3(-400, 400, 0);

  renderer.domElement.addEventListener("pointermove", e => {
    e.preventDefault();
    pointer.x = (e.clientX / width) * 2 - 1;
    pointer.y = - (e.clientY / height) * 2 + 1;
  });
  let selectState = false;
  renderer.domElement.addEventListener("pointerdown", () => {
    selectState = true;
  });
  renderer.domElement.addEventListener("pointerup", () => {
    selectState = false;
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    pointer.x = -1;
    pointer.y = -1;
  })

  function renderLoop() {
    controls.update( clock.getDelta() );
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(scene.children);
    if (intersections.length) {
      for (let intersection of intersections) {
        if (intersection.object.parent instanceof Block) {
          intersection.object.parent.setState(selectState ? "selected": "hovered");
        }
      }
    }
    for (let obj of raytraceEntities) {
      const frame = obj.children.find(obj => obj.layers.isEnabled(1));
      if (!frame) continue;
      if (intersections.find(intersect => intersect.object === frame)) continue;
      obj.setState("idle");
    }
    renderer.render(scene, camera);
    ThreeMeshUI.update();
  }
  renderer.setAnimationLoop(renderLoop);

  const raytraceEntities: THREE.Object3D[] = [];

  return (
    <WSContext.Provider value={context}>
      <ThreeContext.Provider value={{scene, camera, renderer, raytraceEntities}}>
        <Show when={wsReady()}>
          {renderer.domElement}
          <Monopolis />
        </Show>
        <Show when={!wsReady() && wsErrorReason()}>
          <LobbyMenu>
            <h1>Connection to Monopolis failed</h1>
            <pre>{wsErrorReason()}</pre>
          </LobbyMenu>
        </Show>
      </ThreeContext.Provider>
    </WSContext.Provider>
  );
}
