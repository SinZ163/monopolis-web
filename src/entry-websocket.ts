import { defineWebSocket, eventHandler } from "vinxi/http";
import { EstateSpace, RailRoadSpace, Space, TileDB, UtilitySpace } from "./common/tiledb";
import { Deck, PlayerColors, PlayerID } from "./common/utils";
import { CustomGameEventDeclarations, MonopolisRenovationEvent, MonopolisAuctionBid, MonopolisTradeEvent, LobbyAddTeamEvent, LobbyAddPlayerEvent, LobbyJoinTeamEvent, StartCreateUserEvent, StartLobbyCreateEvent, StartLobbyJoinEvent } from "./common/events";
import { WSMessage } from "./common/message";
import { CustomNetTableDeclarations, LobbyMetadata, PlayerState, PropertyOwnership, TeamState } from "./common/state";
import { TurnState } from "./common/turnstate";
import { CardAction, TeleportCategoryCardAction } from "./common/cardaction";
import { generateUUID } from "three/src/math/MathUtils.js";
// TODO: find a sane way to import this without conflicts
type Peer = Parameters<Exclude<ReturnType<typeof defineWebSocket>["open"], undefined>>[0]

interface BasePlayerInfo {
	localId: string;
	playerName: string;
}
interface ConnectedLobbyPlayerInfo extends BasePlayerInfo {
	type: "connected";
	peer: Peer;
	lobbyId: string;
};
interface DisconnectedLobbyPlayerInfo extends BasePlayerInfo {
	type: "disconnected";
	lobbyId: string;
}
interface StartPlayerInfo extends BasePlayerInfo {
	type: "start";
	peer: Peer;
}
type PlayerInfo = StartPlayerInfo | ConnectedLobbyPlayerInfo | DisconnectedLobbyPlayerInfo;
const PlayerMap: Record<string, PlayerInfo> = {};

const CardDeck: Record<Deck, CardAction[]> = {
    "Chance": [
        {type: "teleport", dest: "GO", text: "#card_adv_go"},
        {type: "teleport", dest: "RedC", text: "#card_adv"},
        {type: "teleport", dest: "PinkA", text: "#card_adv"},
        {type: "teleport_category", dest: "Utility", text: "#card_adv_utility"},
        {type: "teleport_category", dest: "Railroad", text: "#card_adv_railroad"}, // intentionally repeated
        {type: "teleport_category", dest: "Railroad", text: "#card_adv_railroad"},
        {type: "money_gain", value: 50, text: "#CHANCE_BankDividend"},
        //{type: "fuckjail", text: "#card_fuckjail_text"},
        {type: "teleport_relative", value: -3, text: "#card_adv_relative_back"},
        {type: "jail", text: "#card_jail_text"},
        //{type: "repairs", house: 25, hotel: 100, text: "#CHANCE_GeneralRepairs"},
        {type: "money_lose", value: 15, text: "#CHANCE_Speeding"},
        {type: "teleport", dest: "RailroadA", text: "#card_adv_railroad1"},
        {type: "teleport", dest: "DarkBlueB", text: "#card_adv_blue2"},
        {type: "money_lose_others", value: 50, text: "#CHANCE_Chairman"},
        {type: "money_gain", value: 150, text: "#CHANCE_BuildingLoan"},
    ],
    "CommunityChest": [
        {type: "teleport", dest: "GO", text: "#card_adv_go"},
        {type: "money_gain", value: 200, text: "#COMMUNITYCHEST_BankError"},
        {type: "money_lose", value: 50, text: "#COMMUNITYCHEST_Doctor"},
        {type: "money_gain", value: 50, text: "#COMMUNITYCHEST_Stock"},
        //{type: "fuckjail", text: "#card_fuckjail_text"},
        {type: "jail", text: "#card_jail_text"},
        {type: "money_gain", value: 100, text: "#COMMUNITYCHEST_HolidaySeason"},
        {type: "money_gain", value: 20, text: "#COMMUNITYCHEST_Income"},
        //{type: "money_gain_others", value: 10, text: "#COMMUNITYCHEST_Birthday"},
        {type: "money_gain", value: 100, text: "#COMMUNITYCHEST_LifeInsurance"},
        {type: "money_lose", value: 50, text: "#COMMUNITYCHEST_Hospital"},
        {type: "money_lose", value: 50, text: "#COMMUNITYCHEST_School"},
        {type: "money_gain", value: 25, text: "#COMMUNITYCHEST_Consultancy"},
        //{type: "repairs", house: 40, hotel: 115, text: "#COMMUNITYCHEST_StreetRepairs"},
        {type: "money_gain", value: 10, text: "#COMMUNITYCHEST_Beauty"},
        {type: "money_gain", value: 100, text: "#COMMUNITYCHEST_Inherit"},
    ],
};

function IsPurchasableTile(tile: Space|undefined): tile is EstateSpace | RailRoadSpace | UtilitySpace  {
	switch(tile?.type) {
		case "Estate":
		case "Railroad":
		case "Utility":
			return true;
	}
	return false;
}

const MAX_PLAYERS = 25;
const MAX_TEAMS = 8;

const LobbyMap: Record<string, MonopolisLobbyInstance> = {};
const LobbyList: Record<string, LobbyMetadata> = {};

function updateLobbyList(peer: Peer, lobbyData: CustomNetTableDeclarations["lobbyData"]) {
	const lobbyId = lobbyData.id;
	LobbyList[lobbyId] = {
		lobbyId,
		hostName: lobbyData.host.name,
		name: lobbyData.name,
		maxPlayers: MAX_PLAYERS,
		playerCount: lobbyData.players.length,
		started: lobbyData.started
	}
	peer.send({id: "lobbyList", value: Object.values(LobbyList)});
	peer.publish("lobbyList", {id: "lobbyList", value: Object.values(LobbyList)});
}

class MonopolisLobbyInstance {
	addPlayer(localState: StartPlayerInfo) {
		this.DataModel.lobbyData.players.push({
			name: localState.playerName,
			localId: localState.localId,
			configured: false,
			colour: -1,
			team: -1,
		});
		PlayerMap[localState.localId] = {
			type: "connected",
			lobbyId: this.DataModel.lobbyData.id,
			peer: localState.peer,
			localId: localState.localId,
			playerName: localState.playerName,
		}
		this.subscribe(localState.peer);
		updateLobbyList(localState.peer, this.DataModel.lobbyData);
	}
	private DataModel: CustomNetTableDeclarations = {
		property_ownership: {},
		player_state: {},
		team_state: {},
		misc: {
			current_turn: { type: "lobby" },
			roll_order: [],
			housing_market: {
				houses: 32,
				hotels: 12
			},
			auction: undefined,
			trade: undefined,
			ui_state: { type: "n/a" }
		},
		lobbyData: {
			players: [],
			teams: [],
			name: "",
			started: false,
			host: {
				name: "",
				localId: "",
			},
			id: ""
		}
	}
	private currentDecks: Record<Deck, CardAction[]> = {
		Chance: ShuffleArray([...CardDeck.Chance]),
		CommunityChest: ShuffleArray([...CardDeck.CommunityChest]),
	}

	public constructor(name: string, lobbyId: string, host: StartPlayerInfo) {
		this.DataModel.lobbyData.name = name;
		this.DataModel.lobbyData.id = lobbyId;
		this.DataModel.lobbyData.host.name = host.playerName;
		this.DataModel.lobbyData.host.localId = host.localId;
		this.addPlayer(host);
		updateLobbyList(host.peer, this.DataModel.lobbyData);
	}

	public subscribe(peer: Peer) {
		for (let i = 0; i < MAX_PLAYERS; i++) {
			this.subscribeToLatest(peer, {id: `monopolis:player_state:${i}`, value: this.DataModel.player_state[i]});
		}
		for (let i = 0; i < MAX_TEAMS; i++) {
			this.subscribeToLatest(peer, {id: `monopolis:team_state:${i}`, value: this.DataModel.team_state[i]});
		}
		for (let tile of Object.values(TileDB)) {
			if (IsPurchasableTile(tile)) {
				this.subscribeToLatest(peer, {id: `monopolis:property_ownership:${tile.id}`, value: this.DataModel.property_ownership[tile.id]});
			}
		}
		this.subscribeToLatest(peer, {id: "monopolis:auction", value: this.DataModel.misc.auction});
		this.subscribeToLatest(peer, {id: "monopolis:current_turn", value: this.DataModel.misc.current_turn});
		this.subscribeToLatest(peer, {id: "monopolis:housing_market", value: this.DataModel.misc.housing_market});
		this.subscribeToLatest(peer, {id: "monopolis:roll_order", value: this.DataModel.misc.roll_order});
		this.subscribeToLatest(peer, {id: "monopolis:trade", value: this.DataModel.misc.trade});
		this.subscribeToLatest(peer, {id: "monopolis:ui_state", value: this.DataModel.misc.ui_state});
		this.subscribeToLatest(peer, {id: "monopolis:lobbyData", value: this.DataModel.lobbyData});
	}

	

	private subscribeToLatest(peer: Peer, event: {id: string, value: any}) {
		peer.subscribe(this.DataModel.lobbyData.id + "|" +event.id);
		peer.send({...event, id: event.id, type: "init"});
	}
	private dispatchState(peer: Peer, field: string, event: any) {
		peer.publish(this.DataModel.lobbyData.id + "|" +field, {id: field, value: event});
		peer.send({id: field, value: event});
	}

	private CalculateRent(tile: EstateSpace | UtilitySpace | RailRoadSpace, current: PlayerState, propertyState: PropertyOwnership): number {
		console.log({tile, current, propertyState});

		let turnState = this.DataModel.misc.current_turn;
		if (propertyState.houseCount === -1) { 
			return 0;
		}
		if (tile.type === "Estate") {
			let properties = Object.values(TileDB).filter(row => row.type === "Estate" && row.category === tile.category) as EstateSpace[];
			let owners = properties.map(row => [row, this.DataModel.property_ownership[row.id]]) as [EstateSpace, PropertyOwnership][];
			console.log(owners);
			let isMonopoly = true;
			for (let owner of owners) {
				if (owner[1].owner !== propertyState.owner) {
					console.log(owner);
					isMonopoly = false;
					break;
				}
			}
			console.log(isMonopoly);
			if (isMonopoly) {
				if (propertyState.houseCount === 0) {
					return tile.rent[0] * 2;
				}
				return tile.rent[propertyState.houseCount];
			}
			return tile.rent[0];
		}
		else if (tile.type === "Railroad") {
			let railroads = [
				this.DataModel.property_ownership["RailroadA"],
				this.DataModel.property_ownership["RailroadB"],
				this.DataModel.property_ownership["RailroadC"],
				this.DataModel.property_ownership["RailroadD"]
			];
			let ownedRailroads = railroads.filter(railroad => railroad.owner === propertyState.owner).length;
			const prices = [25, 50, 100, 200]
			let price = prices[ownedRailroads - 1];
			if (turnState.type === "card_result" && turnState.card.type === "teleport_category") {
				return price * 2;
			}
			return price;
		} else {
			console.log({turnState});
			if (turnState.type === "diceroll") {
				let diceSum = turnState.dice1 + turnState.dice2;
				let utilities = [
					this.DataModel.property_ownership["ElectricCompany"],
					this.DataModel.property_ownership["Waterworks"],
				];
				let ownedUtilities = utilities.filter(utility => utility.owner === propertyState.owner).length;
				return tile.multipliers[ownedUtilities - 1] * diceSum;
			} else if (turnState.type === "card_result") {
				return NaN;
			} else {
				throw "wtf why is it not diceroll state";
			}
		}
	}
	private OnTileLanded(peer: Peer) {
		let turnState = this.DataModel.misc.current_turn;
		if (turnState.type !== "diceroll" && turnState.type !== "card_result") return;
		const playerState = this.DataModel.player_state[turnState.pID];
		const teamState = this.DataModel.team_state[playerState.team];
		let tile = TileDB[playerState.location];
		if (IsPurchasableTile(tile)) {
			let propertyState = this.DataModel.property_ownership[tile.id];
			console.log(propertyState);
			// Owned property that isn't current player and it isn't mortgaged (-1)
			if (propertyState.owner > -1 && propertyState.owner !== playerState.team && propertyState.houseCount >= 0) {
				console.log("Well you need to pay up now");
				const price = this.CalculateRent(tile, playerState, propertyState);
				console.log({price, playerState, a:Number.isNaN(price)});
				if (Number.isNaN(price) && turnState.type === "card_result") {
					this.setTurnState(peer, {pID: playerState.pID, type: "auxroll_prompt", rolls: turnState.rolls, card: turnState.card});
				} else {
					this.setTurnState(peer, {pID: playerState.pID, type: "payrent", rolls: turnState.rolls, property: tile.id, price, potentialBankrupt: propertyState.owner});
				}
			}
			else if (propertyState.owner === -1) {
				this.setTurnState(peer, {pID: playerState.pID, type: "unowned", rolls: turnState.rolls, property: tile.id});
			} else {
				// owner exists but either current player owns it or its mortgaged. skip to endturn state
				this.setTurnState(peer, {type: "endturn", pID: playerState.pID, rolls: turnState.rolls});
			}
		} else if (tile.type === "Tax") {
			this.setTurnState(peer, {pID: playerState.pID, type: "payrent", rolls: turnState.rolls, property: tile.id, price: tile.cost, potentialBankrupt: -1});
		} else if (tile.type === "CardDraw") {
			this.setTurnState(peer, {type: "card_prompt", pID: playerState.pID, rolls: turnState.rolls, deck: tile.category as Deck});
		} else if (tile.id === "gotojail") {
			this.GotoJail(peer);
		} else {
			this.dispatchState(peer, "monopolis:player_state:"+playerState.pID, playerState);
			this.setTurnState(peer, {type: "endturn", pID: playerState.pID, rolls: turnState.rolls});
		}
	}
	private StartTurn(peer: Peer, preRolled = false) {
		let turnState = this.DataModel.misc.current_turn;
		if (turnState.type !== "transition" && turnState.type !== "jailed") return;
		const playerState = this.DataModel.player_state[turnState.pID];
		console.log("Turn Start", playerState.pID);

		console.log(playerState.jailed);
		let indicators: Partial<Record<string, number>> = {};
		for (let i = 1; i <= 12; i++) {
			if (i % 2 === 1 && playerState.jailed > 1) continue;
			let indicatorSpot = (playerState.location + i) % 40;
			indicators[TileDB[indicatorSpot].id] = i;
		}
		if (preRolled || playerState.jailed > 0) {
			this.setTurnState(peer, {type: "jailed", pID: playerState.pID, rolls: turnState.rolls, indicators, preRolled});
		} else {
			this.setTurnState(peer, {type: "start", pID: playerState.pID, rolls: turnState.rolls, indicators});
		}
	}
	private NextTurn(peer: Peer) {
		let turnState = this.DataModel.misc.current_turn;
		if (turnState.type !== "endturn") return;
		this.Anticheat(peer, turnState.pID);

		let rollOrder = this.DataModel.misc.roll_order;
		let currentIndex = rollOrder.findIndex(pID => turnState.pID === pID);
		if (currentIndex === -1) {
			console.log(rollOrder, turnState.pID);
			throw "Can't find the index :(";
		}
		const aliveTeamIDs = Object.values(this.DataModel.team_state).filter(team => team.alive).map(team => team.tID);
		let playerStates = Object.values(this.DataModel.player_state).filter(player => aliveTeamIDs.indexOf(player.team) !== -1);
		console.log("Have we won yet?", playerStates.length);
		if (playerStates.length === 1) {
			console.log("Win?");
			// TODO: Winner screen?
		}
		let nextIndex = currentIndex as number;
		let nextPlayer: PlayerState;
		let nextTeam: TeamState;
		do {
			nextIndex = (nextIndex + 1) % Object.keys(rollOrder).length;
			let pID = rollOrder[nextIndex];
			nextPlayer = this.DataModel.player_state[pID];
			nextTeam = this.DataModel.team_state[nextPlayer.team];
			console.log(nextPlayer.pID, nextTeam.alive);
		} while (!nextTeam.alive);
		let savedTurn: TurnState = { pID: nextPlayer.pID, rolls: [], type: "transition"};
		this.setTurnState(peer, savedTurn);
		this.StartTurn(peer);
	}
	private MoveBackwardToLocation(peer: Peer, futureLocation: number) {
		if (futureLocation < 0) {
			futureLocation = 40 + futureLocation;
		}
		return this.MoveForwardToLocation(peer, futureLocation, true);
	}
	private MoveForwardToLocation(peer: Peer, futureLocation: number, backwards = false) {
		let turnState = this.DataModel.misc.current_turn;
		if (turnState.type !== "diceroll" && turnState.type !== "card_result") return;
		const playerState = this.DataModel.player_state[turnState.pID];
		const teamState = this.DataModel.team_state[playerState.team];
		// TODO: Switch to client side Tweening
		
		const stop = setInterval(() => {
			playerState.location += backwards ? -1 : 1;
			// TODO: Complex boards
			if (playerState.location > 39) {
				playerState.location = 0;
				// TODO: House rules
				teamState.money += 200;
				this.dispatchState(peer, "monopolis:team_state:"+teamState.tID, teamState);
			}
			this.dispatchState(peer, "monopolis:player_state:"+playerState.pID, playerState);
			if (playerState.location === futureLocation) {
				clearInterval(stop);
				this.OnTileLanded(peer);
			}
		}, 300);
	}
	private StartGame(peer: Peer): void {
		console.log("Game starting!");
		//CustomNetTables.SetTableValue("misc", "price_definition", TilesObj);
		this.DataModel.misc.housing_market = {houses: 32, hotels: 12};
		this.dispatchState(peer, "monopolis:housing_market", this.DataModel.misc.housing_market);
		this.DataModel.misc.ui_state = {type: "n/a"};
		this.dispatchState(peer, "monopolis:ui_state", this.DataModel.misc.ui_state);

		this.currentDecks = {
			Chance: ShuffleArray([...CardDeck.Chance]),
			CommunityChest: ShuffleArray([...CardDeck.CommunityChest]),
		}
		
		for (let tile of Object.values(TileDB)) {
			if (IsPurchasableTile(tile)) {
				this.DataModel.property_ownership[tile.id] = {
					houseCount: 0,
					owner: -1,
				};
				this.dispatchState(peer, "monopolis:property_ownership:"+tile.id, this.DataModel.property_ownership[tile.id]);
			}
		}
		this.setTurnState(peer, {pID: 0, rolls: [], type: "transition"});

		// TODO: Do logic to determine roll order
		let rollOrder: number[] = [];
		for (let [i, player] of this.DataModel.lobbyData.players.entries()) {
				rollOrder.push(i);
				this.DataModel.player_state[i] = {
					pID: i,
					location: 0,
					jailed: 0,
					name: player.name,
					colour: player.colour,
					team: player.team,
				};
				this.dispatchState(peer, "monopolis:player_state:"+i, this.DataModel.player_state[i]);
		}
		for (let [i, team] of this.DataModel.lobbyData.teams.entries()) {
				this.DataModel.team_state[i] = {
					tID: i,
					name: team.name,
					alive: Object.values(this.DataModel.player_state).filter(player => player.team === i).length > 0,
					money: 1500,
				};
				this.dispatchState(peer, "monopolis:team_state:"+i, this.DataModel.team_state[i]);
		}
		this.DataModel.misc.roll_order = rollOrder;
		this.dispatchState(peer, "monopolis:lobbyData", this.DataModel.lobbyData);
		this.StartTurn(peer);
	}
    private LeaveJail(peer: Peer) {
		let turnState = this.DataModel.misc.current_turn;
		if (turnState.type !== "jailed") return;
		const playerState = this.DataModel.player_state[turnState.pID];

        playerState.jailed = 0;
        playerState.location = 10;
		this.dispatchState(peer, "monopolis:player_state:"+playerState.pID, this.DataModel.player_state[playerState.pID]);
    }
    private GotoJail(peer: Peer) {
		let turnState = this.DataModel.misc.current_turn;
		if (turnState.type !== "diceroll" && turnState.type !== "card_result") return;
		const playerState = this.DataModel.player_state[turnState.pID];
        this.setTurnState(peer, {type: "endturn", pID: playerState.pID, rolls: turnState.rolls});
        playerState.jailed = 3;
        playerState.location = -1;
		this.dispatchState(peer, "monopolis:player_state:"+playerState.pID, this.DataModel.player_state[playerState.pID]);
    }
	private setTurnState(peer: Peer, turnState: TurnState) {
		this.DataModel.misc.current_turn = turnState;
		this.dispatchState(peer, "monopolis:current_turn", this.DataModel.misc.current_turn);
	}
	private Anticheat(peer: Peer, expectedPID: number) {
		const peerState = Object.values(PlayerMap).find(row => row.type === "connected" && row.peer === peer);
		if (!peerState) return true;
		const pID = this.DataModel.lobbyData.players.findIndex(player => player.localId === peerState.localId);
		if (expectedPID !== pID) return true;
		return false;
	}
	public EventHandlers: EventHandlers = {
		monopolis_requestdiceroll: (peer: Peer, payload: undefined): void => {
			let turnState = this.DataModel.misc.current_turn;
			if (turnState.type !== "start" && turnState.type !== "auxroll_prompt" && turnState.type !== "jailed") {
				return;
			}
			if (this.Anticheat(peer, turnState.pID)) {
				return;
			}

			// already rolled, dont show button again
			if (turnState.type === "jailed" && turnState.preRolled) return;

			let dice1 = RandomInt(1, 6);
			let dice2 = RandomInt(1, 6);
			const playerState = this.DataModel.player_state[turnState.pID];

			if (turnState.type === "auxroll_prompt") {
				let propertyState = this.DataModel.property_ownership[TileDB[playerState.location].id];
				// TODO: Make more generic
				let value = 10 * (dice1 + dice2);
				this.setTurnState(peer, { type: "auxroll_result", pID: playerState.pID, rolls: turnState.rolls, card: turnState.card, dice1, dice2, value, potentialBankrupt: propertyState.owner });
				return;
			}
			turnState.rolls = [...turnState.rolls, { dice1, dice2 }];
			// We are in jail and did NOT get doubles :(
			if (playerState.jailed > 0 && dice1 !== dice2) {
				playerState.jailed--;
				this.dispatchState(peer, "monopolis:player_state:" + playerState.pID, playerState);
				if (playerState.jailed === 0) {
					this.setTurnState(peer, turnState);
					this.StartTurn(peer, true);
				} else {
					this.setTurnState(peer, { type: "endturn", pID: playerState.pID, rolls: turnState.rolls });
				}
				return;
			} else if (playerState.jailed > 0) {
				this.LeaveJail(peer);
				// cheesy logic to make sure its not treated as a double later on
				turnState.rolls.push({dice1: 1, dice2: -1});
			}
			this.setTurnState(peer, {
				pID: playerState.pID,
				type: "diceroll",
				rolls: turnState.rolls,
				dice1,
				dice2,
			});

			if (dice1 === dice2 && turnState.rolls.length >= 3) {
				this.GotoJail(peer);
				return;
			} else {
				let futureLocation = (playerState.location + dice1 + dice2) % 40;
				console.log(playerState.location, dice1, dice2, futureLocation);
				this.dispatchState(peer, "monopolis:player_state:" + playerState.pID, playerState);
				this.MoveForwardToLocation(peer, futureLocation);
			}
		},
		monopolis_requestpayrent: (peer: Peer, payload: undefined): void => {
			let turnState = this.DataModel.misc.current_turn;
			if (turnState.type !== "payrent" && turnState.type !== "jailed") {
				return;
			}
			if (this.Anticheat(peer, turnState.pID)) {
				return;
			}
			const playerState = this.DataModel.player_state[turnState.pID];
			const teamState = this.DataModel.team_state[playerState.team];

			if (turnState.type === "jailed") {
				if (teamState.money < 50) {
					// FIXME
					//HudErrorMessage("#monopolis_broke");
					return;
				}
				teamState.money -= 50;
				this.dispatchState(peer, "monopolis:team_state:" + playerState.team, teamState);
				this.LeaveJail(peer);
				if (turnState.preRolled === true) {
					if (turnState.rolls.length < 1) throw new Error("Why is there no dice roll?");
					let diceRoll = turnState.rolls[turnState.rolls.length - 1];
					this.setTurnState(peer, {type: "diceroll", dice1: diceRoll.dice1, dice2: diceRoll.dice2, pID: playerState.pID, rolls: turnState.rolls});
					this.MoveForwardToLocation(peer, (playerState.location + diceRoll.dice1 + diceRoll.dice2) % 40);
				} else {
					this.StartTurn(peer);
				}
				return;
			}

			if (teamState.money < turnState.price) {
				// HudErrorMessage("#monopolis_broke");
				return;
			}

			let tile = TileDB.find(tile => tile.id === turnState.property);
			// need this check because it may be tax which has no owner
			if (IsPurchasableTile(tile)) {
				let propertyState = this.DataModel.property_ownership[tile.id];
				let owner = this.DataModel.team_state[propertyState.owner];
				owner.money += turnState.price;
				this.dispatchState(peer, "monopolis:team_state:" + propertyState.owner, owner);
			}
			teamState.money -= turnState.price;
			this.dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
			this.setTurnState(peer, { pID: playerState.pID, rolls: turnState.rolls, type: "endturn" });
		},
		monopolis_requestauction: (peer: Peer, payload: undefined): void => {
			//throw new Error("Function not implemented.");
		},
		monopolis_requestpurchase: (peer: Peer, payload: undefined): void => {
			let turnState = this.DataModel.misc.current_turn;
			if (turnState.type !== "unowned") return;
			if (this.Anticheat(peer, turnState.pID)) {
				return;
			}
			const playerState = this.DataModel.player_state[turnState.pID];
			const teamState = this.DataModel.team_state[playerState.team];

			let tile = TileDB.find(tile => tile.id === turnState.property);
			let propertyState = this.DataModel.property_ownership[turnState.property];
			if (!IsPurchasableTile(tile)) return;

			if (teamState.money < tile.purchasePrice) {
				//HudErrorMessage("#monopolis_broke");
				return;
			}
			teamState.money -= tile.purchasePrice;
			propertyState.owner = playerState.team;
			this.dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
			this.dispatchState(peer, "monopolis:property_ownership:" + turnState.property, propertyState);
			this.setTurnState(peer, { pID: playerState.pID, rolls: turnState.rolls, type: "endturn" });
		},
		monopolis_requestcard: (peer: Peer, payload: undefined): void => {
			let turnState = this.DataModel.misc.current_turn;
			if (turnState.type !== "card_prompt") return;
			if (this.Anticheat(peer, turnState.pID)) {
				return;
			}
			const playerState = this.DataModel.player_state[turnState.pID];

			let card = this.currentDecks[turnState.deck].shift();
			if (!card) {
				console.log("Why is the deck empty");
				return;
			}
			if (card.type !== "fuckjail") {
				this.currentDecks[turnState.deck].push(card);
			} else {
				// TODO: Work out how we are going to keep it
			}
			this.setTurnState(peer, { type: "card_result", pID: playerState.pID, rolls: turnState.rolls, card, potentialBankrupt: -1 });
		},
		monopolis_acknowledgecard: (peer: Peer, payload: undefined): void => {
			let turnState = this.DataModel.misc.current_turn;
			if (turnState.type !== "auxroll_result" && turnState.type !== "card_result") return;
			if (this.Anticheat(peer, turnState.pID)) {
				return;
			}
			const playerState = this.DataModel.player_state[turnState.pID];
			const teamState = this.DataModel.team_state[playerState.team];
			if (turnState.type === "auxroll_result") {
				if (teamState.money < turnState.value) {
					// FIXME
					//HudErrorMessage("#monopolis_broke");
					return;
				}
				teamState.money -= turnState.value;
				let tile = TileDB[playerState.location];
				let propertyOwnership = this.DataModel.property_ownership[tile.id];
				let owner = this.DataModel.team_state[propertyOwnership.owner];
				owner.money += turnState.value;
				this.setTurnState(peer, { type: "endturn", pID: playerState.pID, rolls: turnState.rolls });
				this.dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
				this.dispatchState(peer, "monopolis:team_state:" + owner.tID, owner);
				return;
			}
			let card = turnState.card;
			switch (card.type) {
				case "jail":
					this.GotoJail(peer);
					return;
				case "money_gain":
					teamState.money += card.value;
					this.dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
					break;
				case "money_gain_others":
					let playerCountGain = 0;
					for (let otherTeam of Object.values(this.DataModel.team_state)) {
						if (teamState.tID === otherTeam.tID) continue;
						if (otherTeam.alive === false) { continue; }
						// TODO: Handle bankrupt scenario
						otherTeam.money -= card.value;
						this.dispatchState(peer, "monopolis:team_state:" + otherTeam.tID, otherTeam);
						playerCountGain++;
					}
					teamState.money += (card.value * playerCountGain);
					this.dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
					break;
				case "money_lose":
					if (teamState.money < card.value) {
						// FIXME
						//HudErrorMessage("#monopolis_broke");
						return;
					}
					teamState.money -= card.value;
					this.dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
					break;
				case "money_lose_others":
					let otherTeams = [];
					for (let otherTeam of Object.values(this.DataModel.team_state)) {
						if (teamState.tID === otherTeam.tID) continue;
						if (otherTeam.alive === false) { continue; }
						otherTeams.push(otherTeam);
					}
					let cost = (card.value * otherTeams.length);
					if (teamState.money < cost) {
						// FIXME
						//HudErrorMessage("#monopolis_broke");
						return;
					}
					teamState.money -= cost;
					for (let otherTeam of otherTeams) {
						otherTeam.money += card.value;
						this.dispatchState(peer, "monopolis:team_state:" + otherTeam.tID, otherTeam);
					}
					this.dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
					break;
				case "repairs":
					console.log("Fuck repairs");
					break;
				case "teleport":
					this.MoveForwardToLocation(peer, TileDB.findIndex(tile => tile.id === card.dest));
					return;
				case "teleport_category":
					let destinations = TileDB.map((tile, i) => ({ ...tile, index: i })).filter(row => row.type === (card as TeleportCategoryCardAction).dest);
					destinations.sort((a, b) => a.index - b.index);
					let dest = destinations[0];
					for (let destination of destinations) {
						if (playerState.location < destination.index) {
							dest = destination;
							break;
						}
					}
					this.MoveForwardToLocation(peer, dest.index);
					return;
				case "teleport_relative":
					if (card.value >= 0)
						this.MoveForwardToLocation(peer, playerState.location + card.value);

					else
						this.MoveBackwardToLocation(peer, playerState.location + card.value);
					return;
			}
			this.setTurnState(peer, { type: "endturn", pID: playerState.pID, rolls: turnState.rolls });
		},
		monopolis_endturn: (peer: Peer, payload: undefined): void => {
			let turnState = this.DataModel.misc.current_turn;
			if (turnState.type !== "endturn") return;
			if (this.Anticheat(peer, turnState.pID)) {
				return;
			}
			const playerState = this.DataModel.player_state[turnState.pID];

			let endturn = true;
			if (playerState.jailed === 0 && turnState.rolls.length > 0 && turnState.rolls.length < 3) {
				let diceRolls = turnState.rolls[turnState.rolls.length - 1];
				if (diceRolls.dice1 === diceRolls.dice2) {
					console.log("End turn bypassed by doubles?");
					endturn = false;
				}
			}
			if (endturn) {
				this.NextTurn(peer);
			} else {
				let indicators: Partial<Record<string, number>> = {};
				for (let i = 1; i <= 12; i++) {
					let indicatorSpot = (playerState.location + i) % 40;
					indicators[TileDB[indicatorSpot].id] = i;
				}
				this.setTurnState(peer, { type: "start", pID: playerState.pID, rolls: turnState.rolls, indicators });
			}
		},
		monopolis_requestrenovation: (peer: Peer, payload: MonopolisRenovationEvent): void => {
			let turnState = this.DataModel.misc.current_turn;
			if (turnState.type !== "endturn" && turnState.type !== "payrent" && turnState.type !== "card_result" && turnState.type !== "auxroll_result") return;
			const playerState = this.DataModel.player_state[turnState.pID];
			const teamState = this.DataModel.team_state[playerState.team];
			if (this.Anticheat(peer, turnState.pID)) {
				return;
			}
	
			let tile = TileDB.find(tile => tile.id === payload.property) as (RailRoadSpace | UtilitySpace | EstateSpace);
			if (!tile) return;
			let propertyState = this.DataModel.property_ownership[tile.id];
	
			// Asserts its ownable and if it is, its the current player
			if (propertyState?.owner !== teamState.tID) { return; }

			if (turnState.type === "payrent") {
				// if you can afford it, you don't have access to property management
				if (teamState.money > turnState.price) return;
				// if you owe someone money and have access to property management, only sell, no buy
				if (payload.houseCount > propertyState.houseCount) {
					// HudErrorMessage("#monopolis_property_debt");
					return;
				}
			}
			if (turnState.type === "card_result") {
				if (turnState.card.type === "money_lose" || turnState.card.type === "money_lose_others") {
					// if you can afford it, you don't have access to property management
					let value = turnState.card.value;
					if (turnState.card.type === "money_lose_others") {
						let otherTeams = [];
						for (let otherTeam of Object.values(this.DataModel.team_state)) {
							if (teamState.tID === otherTeam.tID) continue;
							if (otherTeam.alive === false) { continue; }
							otherTeams.push(otherTeam);
						}
						value = otherTeams.length * value;
					}
					if (teamState.money > value) return;
					// if you owe someone money and have access to property management, only sell, no buy
					if (payload.houseCount > propertyState.houseCount) {
						// HudErrorMessage("#monopolis_property_debt");
						return;
					}
				} else { return; }
			}
			if (turnState.type === "auxroll_result") {
				// if you can afford it, you don't have access to property management
				if (teamState.money > turnState.value) return;
				// if you owe someone money and have access to property management, only sell, no buy
				if (payload.houseCount > propertyState.houseCount) {
					// HudErrorMessage("#monopolis_property_debt");
					return;
				}
			}
	
			let commonLogicUsed = false;
			if (propertyState.houseCount === 0 && payload.houseCount === -1) {
				// 0 => -1, we are mortgaging
				teamState.money += tile.purchasePrice / 2;
				propertyState.houseCount = -1;
				commonLogicUsed = true;
			} else if (propertyState.houseCount === -1 && payload.houseCount === 0) {
				// -1 => 0, we are unmortgaging and should take the money + 10% fee
				let cost = (tile.purchasePrice / 2) * 1.10;
				if (teamState.money < cost) {
					// HudErrorMessage("#monopolis_property_broke");
					return;
				}
				teamState.money -= cost;
				propertyState.houseCount = 0;
				commonLogicUsed = true;
			}
	
			if (tile.type === "Estate") {
				let properties = TileDB.filter(row => row.type === "Estate" && row.category === tile.category) as EstateSpace[];
				let owners = properties.map(row => [row, this.DataModel.property_ownership[row.id]]) as [EstateSpace, PropertyOwnership][];
				let isMonopoly = true;
				let minHouseCount = Number.MAX_SAFE_INTEGER;
				let maxHouseCount = Number.MIN_SAFE_INTEGER;
				for (let owner of owners) {
					if (owner[1].owner !== propertyState.owner) {
						isMonopoly = false;
					} else {
						if (owner[1].houseCount < minHouseCount) {
							minHouseCount = owner[1].houseCount;
						}
						if (owner[1].houseCount > maxHouseCount) {
							maxHouseCount = owner[1].houseCount;
						}
					}
				}
				let currentDelta = maxHouseCount - minHouseCount;
				if (currentDelta > 1) {
					console.log("Wait what, this is illegal.");
					return;
				}
				
				let delta = payload.houseCount - propertyState.houseCount;
				// Bound houseCount to legal values
				if (payload.houseCount > 5 || payload.houseCount < -1) {
					console.log("Illegal");
					return;
				}
				// Only allow increments of 1 or -1, OR -5
				// TODO: Reconsider this when I allow "blueprint mode" property management
				if (Math.abs(delta) > 1 && delta !== -5) {
					console.log("Illegal");
					return;
				}
				if (currentDelta > 0 && (payload.houseCount > maxHouseCount || payload.houseCount < minHouseCount)) {
					// HudErrorMessage("#monopolis_property_buildevenly");
					return;
				}
				// If you don't have the monopoly fuck off
				if (payload.houseCount > 0 && !isMonopoly) {
					// HudErrorMessage("#monopolis_property_needmonopoly");
					return;
				}
				let market = this.DataModel.misc.housing_market;
				
				console.log({propertyState, payload, delta, market, tile});
				if (propertyState.houseCount === 0 && payload.houseCount === -1) {
					teamState.money += tile.purchasePrice / 2;
					propertyState.houseCount = -1;
				} else if (propertyState.houseCount === -1 && payload.houseCount === 0) {
					// -1 => 0, we are unmortgaging and should take the money + 10% fee
					let cost = (tile.purchasePrice / 2) * 1.10;
					if (teamState.money < cost) {
						// HudErrorMessage("#monopolis_property_broke");
						return;
					}
					teamState.money -= cost;
					propertyState.houseCount = 0;
				}
				// If you want houses and aren't going to a hotel, needs to have houses in the market
				else if (payload.houseCount != 5 && delta > 0 && market.houses < delta) {
					// HudErrorMessage("#monopolis_property_marketcrash_house");
					return;
				}
				// If you want a hotel, need a hotel in the market
				if (payload.houseCount === 5 && delta > 0 && market.hotels < 1) {
					// HudErrorMessage("#monopolis_property_marketcrash_hotel");
					return;
				}
				// If you are only removing the hotel and replacing with 4 houses, 4 houses need to be in the market
				if (delta === -1 && propertyState.houseCount === 5 && market.houses < 4) {
					// HudErrorMessage("#monopolis_property_marketcrash_house");
					return;
				}
				// if you want a house/hotel and are poor, go away
				if (delta > 0 && teamState.money < tile.housePrice) {
					// HudErrorMessage("#monopolis_property_broke");
					return;
				}
				// Sell the hotel and not put houses back on
				if (delta === -5 && propertyState.houseCount === 5) {
					market.hotels -= 1;
					propertyState.houseCount = 0;
					teamState.money += (tile.housePrice / 2) * 5;
				}
				// Buy a hotel (hotels are on the market, delta must be 1 and can afford it)
				else if (payload.houseCount === 5 && delta > 0) {
					propertyState.houseCount = 5;
					market.hotels -= 1;
					market.houses += 4;
					teamState.money -= tile.housePrice;
				}
				// Buy a house (cant be hotel, houses are on the market, delta must be 1 and can afford it)
				else if (payload.houseCount > 0 && propertyState.houseCount !== -1 && delta > 0) {
					propertyState.houseCount += delta;
					market.houses -= delta;
					teamState.money -= tile.housePrice;
				}
				// Sell a house/hotel
				else if (delta < 0 && payload.houseCount !== -1) {
					if (propertyState.houseCount === 5) {
						market.houses -= (5 + delta);
						market.hotels += 1;
					} else {
						market.houses -= delta;
					}
					propertyState.houseCount += delta;
					teamState.money += (tile.housePrice / 2) * Math.abs(delta);
				} else if (commonLogicUsed) {}
				// 0 => -1, we are mortgaging and need to grant money
				else {
					console.log("Wait how did it make it this far");
					return;
				}
				
				this.dispatchState(peer, "monopolis:housing_market", market);
			}
			
			this.dispatchState(peer, "monopolis:property_ownership:"+tile.id, propertyState);
			this.dispatchState(peer, "monopolis:team_state:"+teamState.tID, teamState);
			console.log("Saving the market, current property and player?");
		},
		monopolis_requesttrade: (peer: Peer, payload: undefined): void => {
			//throw new Error("Function not implemented.");
		},
		monopolis_requestbankrupt: (peer: Peer, payload: undefined): void => {
			let turnState = this.DataModel.misc.current_turn;
			if (turnState.type !== "payrent" && turnState.type !== "card_result" && turnState.type !== "auxroll_result") return;
			const playerState = this.DataModel.player_state[turnState.pID];
			const teamState = this.DataModel.team_state[playerState.team];
			if (this.Anticheat(peer, turnState.pID)) {
				return;
			}
			if (turnState.type === "payrent") {
				if (teamState.money > turnState.price) return;
			}
			else if (turnState.type === "card_result") {
				if (turnState.card.type !== "money_lose" && turnState.card.type !== "money_lose_others") return;
				let value = turnState.card.value;
				if (turnState.card.type === "money_lose_others") {
					let otherTeams = [];
					for (let otherTeam of Object.values(this.DataModel.team_state)) {
						if (teamState.tID === otherTeam.tID) continue;
						if (otherTeam.alive === false) { continue; }
						otherTeams.push(otherTeam);
					}
					value = otherTeams.length * value;
				}
				if (teamState.money > value) return;
			} else {
				if (teamState.money > turnState.value) return;
			}
			// if you made it this far, you are genuinely broke, good job
			
			let uiState = this.DataModel.misc.ui_state;
			if (uiState.type === "n/a") {
				this.DataModel.misc.ui_state = {type: "bankrupt_confirm"};
				this.dispatchState(peer, "monopolis:ui_state", this.DataModel.misc.ui_state);
				return;
			}
			if (uiState.type !== "bankrupt_confirm") return;
			// TODO: Make the auto liquidate a setting
			let modifiedProperties: Array<[string, PropertyOwnership]> = [];
			for (let [id, state] of Object.entries(this.DataModel.property_ownership)) {
				if (state.owner === teamState.tID) {
					let propertyInfo = TileDB.find(property => property.id === id) as EstateSpace|RailRoadSpace|UtilitySpace;
					if (propertyInfo.type === "Estate" && state.houseCount > 0) {
						// TODO: Put these back into the market
						teamState.money += (propertyInfo.housePrice * state.houseCount)/2;
					}
					if (turnState.potentialBankrupt !== -1 && state.houseCount >= 0) {
						teamState.money += propertyInfo.purchasePrice / 2;
					}
					// TODO: #pretty destruction of the board
					modifiedProperties.push([id, {
						owner: turnState.potentialBankrupt,
						houseCount: turnState.potentialBankrupt !== -1 ? -1 : 0,
					}]);
				}
			}
			// when it isn't the bank
			// TODO: free parking house rule
			// TODO: Auction all the shit
				
			if (turnState.potentialBankrupt !== -1) {
				let asshole = this.DataModel.team_state[turnState.potentialBankrupt];
				asshole.money += teamState.money;
				this.dispatchState(peer, "monopolis:team_state:"+asshole.tID, asshole);
			}
			for (let [id, state] of modifiedProperties) {
				this.dispatchState(peer, "monopolis:property_ownership:"+id, state);
			}
			teamState.money = 0;
			teamState.alive = false;
			this.dispatchState(peer, "monopolis:team_state:"+teamState.tID, teamState);
			this.DataModel.misc.ui_state = {type: "n/a"};
			this.dispatchState(peer, "monopolis:ui_state", this.DataModel.misc.ui_state);
			this.NextTurn(peer);
		},
		monopolis_auctionbid: (peer: Peer, payload: MonopolisAuctionBid): void => {
			throw new Error("Function not implemented.");
		},
		monopolis_auctionwithdraw: (peer: Peer, payload: undefined): void => {
			throw new Error("Function not implemented.");
		},
		monopolis_trade: (peer: Peer, payload: MonopolisTradeEvent): void => {
			throw new Error("Function not implemented.");
		},
		lobby_addteam: (peer: Peer, payload: LobbyAddTeamEvent): void => {
			let turnState = this.DataModel.misc.current_turn;
			if (turnState.type !== "lobby") return;
			const lobbyState = this.DataModel.lobbyData;
			if (lobbyState.started) return;
			if (lobbyState.teams.length === MAX_TEAMS) return;
			lobbyState.teams.push({
				name: payload.teamName
			});
			this.dispatchState(peer, "monopolis:lobbyData", this.DataModel.lobbyData);
		},
		lobby_addplayer: (peer: Peer, payload: LobbyAddPlayerEvent): void => {
			let turnState = this.DataModel.misc.current_turn;
			if (turnState.type !== "lobby") return;
			const lobbyState = this.DataModel.lobbyData;
			if (lobbyState.started) return;
			const localState = Object.values(PlayerMap).find(p => p.type === "connected" && p.peer === peer);
			if (!localState) return;
			const player = lobbyState.players.find(player => player.localId === localState.localId);
			if (!player) return;
			player.colour = payload.playerColour;
			player.configured = true;
			this.dispatchState(peer, "monopolis:lobbyData", this.DataModel.lobbyData);
		},
		lobby_jointeam: (peer: Peer, payload: LobbyJoinTeamEvent): void => {
			let turnState = this.DataModel.misc.current_turn;
			if (turnState.type !== "lobby") return;
			const lobbyState = this.DataModel.lobbyData;
			if (lobbyState.started) return;
			const peerState = Object.values(PlayerMap).find(row => row.type === "connected" && row.peer === peer);
			if (!peerState) return;
			const lobbyPlayer = lobbyState.players.find(player => player.localId === peerState.localId);
			if (!lobbyPlayer || lobbyPlayer.team !== -1) return;
			if (payload.teamId < 0 || payload.teamId >= lobbyState.teams.length) return;
			lobbyPlayer.team = payload.teamId;
			this.dispatchState(peer, "monopolis:lobbyData", this.DataModel.lobbyData);
		},
		lobby_start: (peer: Peer, payload: undefined): void => {
			console.log("Lobby Start?")
			let turnState = this.DataModel.misc.current_turn;
			console.log(turnState);
			if (turnState.type !== "lobby") return;
			const lobbyState = this.DataModel.lobbyData;
			console.log(lobbyState);
			if (lobbyState.started) return;
			const peerState = Object.values(PlayerMap).find(row => row.type === "connected" && row.peer === peer);
			console.log(peerState);
			if (!peerState) return;
			const firstPlayer = lobbyState.players[0];
			console.log(firstPlayer);
			if (!firstPlayer || firstPlayer.localId !== peerState.localId) return;
			lobbyState.started = true;
			updateLobbyList(peer, this.DataModel.lobbyData);
			this.StartGame(peer);
		}
	}
}

function ShuffleArray<T>(array: T[]): T[] {
    let currentIndex = array.length
    let randomIndex: number;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
}

function RandomInt(min: number, max: number) {
	const range = max - min;
	let val = Math.floor(Math.random() * range);
	return val + min;
}

type EventHandlers = {
    [P in keyof CustomGameEventDeclarations]: (peer: Peer, payload: CustomGameEventDeclarations[P]) => void;
}

setInterval(() => {
	for (let connection of Object.values(PlayerMap)) {
		if (connection.type === "connected" || connection.type === "start") {
			connection.peer.send({type: "ping"});
			// TODO: If pongs dont come back DC them
		}
	}
}, 30_000);

export default eventHandler({
	handler: () => {},
	websocket: defineWebSocket({
		async open(peer) {
			console.log("WebSocket opened");
		},
		async message(peer, event) {
			console.log("WebSocket message", event);
            let msg = JSON.parse(event.text()) as WSMessage;

            if (msg.type === "register") {
                if (msg.id === "localId") {
					const localState = PlayerMap[msg.defaultValue];
					if (!localState) {
						peer.send({id: "localId", value: null});
						return;
					}
					if (localState.type === "start") {
						// You are taking over another players identity?
						localState.peer = peer;
					} else {
						PlayerMap[localState.localId] = {
							peer,
							type: "connected",
							playerName: localState.playerName,
							lobbyId: localState.lobbyId,
							localId: localState.localId
						}
						LobbyMap[localState.lobbyId].subscribe(peer);
					}
				}
            }
			const localState = Object.values(PlayerMap).find(p => (p.type === "connected" || p.type === "start") && p.peer === peer);
			if (msg.type === "startevent") {
				console.log(localState, PlayerMap);
				if (localState?.type === "disconnected") {
					return;
				}
				if (msg.id === "start_lobbycreate") {
					const lobbyName = (msg.payload as StartLobbyCreateEvent).lobbyName;
					if (!localState || localState.type === "connected") return;
					const lobbyId = generateUUID();
					LobbyMap[lobbyId] = new MonopolisLobbyInstance(lobbyName, lobbyId, localState);
					peer.unsubscribe("lobbyList");
				} else if (msg.id === "start_lobbyjoin") {
					const lobbyId = (msg.payload as StartLobbyJoinEvent).lobbyId;
					if (localState?.type !== "start") return;
					if (!LobbyMap[lobbyId]) return;
					LobbyMap[lobbyId].addPlayer(localState);
					peer.unsubscribe("lobbyList");
				} else if (msg.id === "start_createuser") {
					if (localState) return;
					const payload = msg.payload as StartCreateUserEvent;
					if (PlayerMap[payload.localId]) return;
					PlayerMap[payload.localId] = {
						type: "start",
						localId: payload.localId,
						peer,
						playerName: payload.playerName,
					}
					peer.send({id: "localId", value: payload.localId});
					peer.send({id: "localName", value: payload.playerName});
					peer.subscribe("lobbyList");
					peer.send({id: "lobbyList", value: Object.values(LobbyList)});
				}
			}
			if (msg.type === "event") {
				if (localState?.type !== "connected") return;
				LobbyMap[localState.lobbyId].EventHandlers[msg.id](peer, msg.payload as unknown as never);
			}
		},
		async close(peer) {
			const peers = Object.values(PlayerMap).filter(row => (row.type === "connected" || row.type === "start") && row.peer === peer) as (StartPlayerInfo|ConnectedLobbyPlayerInfo)[];
			for (let dcPeer of peers) {
				if (dcPeer.type === "connected") {
					(dcPeer as any).type = "disconnected";
					(dcPeer as any).peer = undefined;
				} else {
					delete PlayerMap[dcPeer.localId];
				}
			}
			console.log("WebSocket closed");
		},
	}),
});