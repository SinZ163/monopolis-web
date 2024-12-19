import { CardAction } from "./cardaction";
import { PlayerID, Tiles, PricedTiles, PurchasableTiles, Deck } from "./utils";

interface BaseState {
    pID: PlayerID;
    rolls: Array<{dice1: number, dice2: number}>,
}
interface BankruptableState extends BaseState {
    potentialBankrupt: PlayerID;
}

interface TransitionTurnState extends BaseState {
    type: "transition";
}

interface JailedState extends BankruptableState {
    type: "jailed";
    indicators: Partial<Record<Tiles, number>>;
    preRolled: boolean;
}
interface StartTurnState extends BaseState {
    type: "start";
    indicators: Partial<Record<Tiles, number>>;
}
interface EndTurnState extends BaseState {
    type: "endturn";
}
interface DiceRollState extends BaseState {
    type: "diceroll";
    dice1: number;
    dice2: number;
}
interface PayRentState extends BankruptableState {
    type: "payrent";
    property: PricedTiles;
    price: number;
}
interface UnOwnedState extends BaseState {
    type: "unowned";
    property: PurchasableTiles;
}
interface AuctionTurnState extends BaseState {
    type: "auction";
    property: PurchasableTiles;
}

interface CardPendingState extends BaseState {
    type: "card_prompt",
    deck: Deck
}
interface CardResultState extends BankruptableState {
    type: "card_result",
    card: CardAction,
}

interface AuxRollPromptState extends BaseState {
    type: "auxroll_prompt",
    card: CardAction,
}
interface AuxRollResultState extends BankruptableState {
    type: "auxroll_result",
    card: CardAction,
    dice1: number,
    dice2: number,
    value: number
}

interface GameEndState {
    type: "gameend";
    winner: number;
}


interface LobbyState {
    type: "lobby";
}

type TurnState = TransitionTurnState | JailedState | StartTurnState | DiceRollState | PayRentState | UnOwnedState | AuctionTurnState | EndTurnState | CardPendingState | CardResultState | AuxRollPromptState | AuxRollResultState | GameEndState | LobbyState;
