import { AuctionState } from "./auctionstate";
import { TradeState } from "./tradestate";
import { TurnState } from "./turnstate";
import { TeamID, PlayerID, PurchasableTiles } from "./utils";

interface PropertyOwnership {
    houseCount: number;
    owner: TeamID;
}
interface PlayerState {
    pID: PlayerID;
    name: string;
    colour: number,
    location: number;
    jailed: number;
    team: TeamID;
}
interface TeamState {
    tID: TeamID;
    name: string;
    money: number;
    alive: boolean;
}

interface LobbyMetadata {
    lobbyId: string,
	name: string,
	hostName: string,
	status: "lobby" | "inprogress" | "over",
	playerCount: number,
	maxPlayers: number, // Will be hardcoded for now
}
interface CustomNetTableDeclarations {
    property_ownership: Record<PurchasableTiles, PropertyOwnership>,
    player_state: Record<string, PlayerState>,
    team_state: Record<string, TeamState>,
    misc: {
        current_turn: TurnState
        roll_order: PlayerID[],
        housing_market: {
            houses: number,
            hotels: number,
        },
        //price_definition: Record<Tiles,SpaceDefinition>,
        auction: AuctionState | undefined,
        trade: TradeState | undefined,
        ui_state: UIState
    },
    lobbyData: {
        players: {
            name: string,
            localId: string,
            configured: boolean,
            colour: number,
            team: number,
        }[]
        teams: {
            name: string,
        }[],
        status: "lobby" | "inprogress" | "over",
        name: string,
        host: {
            name: string,
            localId: string,
        },
        id: string,
    }
}
interface NullUIState {
    type: "n/a";
}
interface BankruptConfirmationUIState {
    type: "bankrupt_confirm";
}
interface TradeUIState {
    type: "trade";
}
type UIState = NullUIState | BankruptConfirmationUIState | TradeUIState;