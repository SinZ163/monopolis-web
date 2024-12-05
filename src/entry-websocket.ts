import { defineWebSocket, eventHandler } from "vinxi/http";
import { EstateSpace, RailRoadSpace, Space, TileDB, UtilitySpace } from "./common/tiledb";
import { Deck, PlayerColors, PlayerID } from "./common/utils";
import { CustomGameEventDeclarations, MonopolisRenovationEvent, MonopolisAuctionBid, MonopolisTradeEvent, LobbyAddTeamEvent, LobbyAddPlayerEvent, LobbyJoinTeamEvent } from "./common/events";
import { WSMessage } from "./common/message";
import { CustomNetTableDeclarations, PlayerState, PropertyOwnership, TeamState } from "./common/state";
import { TurnState } from "./common/turnstate";
import { CardAction, TeleportCategoryCardAction } from "./common/cardaction";
// TODO: find a sane way to import this without conflicts
type Peer = Parameters<Exclude<ReturnType<typeof defineWebSocket>["open"], undefined>>[0]

interface BasePlayerInfo {
	localId: string;
}
interface ConnectedPlayerInfo extends BasePlayerInfo {
	connected: true;
	peer: Peer;
};
interface DisconnectedPlayerInfo extends BasePlayerInfo {
	connected: false;
}
type PlayerInfo = ConnectedPlayerInfo | DisconnectedPlayerInfo;
const PlayerMap: Record<string, PlayerInfo> = {};

const DataState: Record<string, any> = {};

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

const DataModel: CustomNetTableDeclarations = {
	property_ownership: {},
	player_state: {},
	team_state: {},
	misc: {
		//current_turn: {pID: 0, rolls: [], type: "transition"}, // FIXME
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
	// TODO: When lobby is real, fix
	lobbyData: {
		players: [],
		teams: [],
		started: false
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
let currentDecks: Record<Deck, CardAction[]> = {
	Chance: ShuffleArray([...CardDeck.Chance]),
	CommunityChest: ShuffleArray([...CardDeck.CommunityChest]),
}

function RandomInt(min: number, max: number) {
	const range = max - min;
	let val = Math.floor(Math.random() * range);
	return val + min;
}

type EventHandlers = {
    [P in keyof CustomGameEventDeclarations]: (peer: Peer, payload: CustomGameEventDeclarations[P]) => void;
}
function dispatchState(peer: Peer, field: string, event: any) {
	peer.publish(field, {id: field, value: event});
	peer.send({id: field, value: event});
}

function CalculateRent(tile: EstateSpace | UtilitySpace | RailRoadSpace, current: PlayerState, propertyState: PropertyOwnership): number {
	console.log({tile, current, propertyState});

	let turnState = DataModel.misc.current_turn;
	if (propertyState.houseCount === -1) { 
		return 0;
	}
	if (tile.type === "Estate") {
		let properties = Object.values(TileDB).filter(row => row.type === "Estate" && row.category === tile.category) as EstateSpace[];
		let owners = properties.map(row => [row, DataModel.property_ownership[row.id]]) as [EstateSpace, PropertyOwnership][];
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
			DataModel.property_ownership["RailroadA"],
			DataModel.property_ownership["RailroadB"],
			DataModel.property_ownership["RailroadC"],
			DataModel.property_ownership["RailroadD"]
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
				DataModel.property_ownership["ElectricCompany"],
				DataModel.property_ownership["Waterworks"],
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
function OnTileLanded(peer: Peer) {
	let turnState = DataModel.misc.current_turn;
	if (turnState.type !== "diceroll" && turnState.type !== "card_result") return;
	const playerState = DataModel.player_state[turnState.pID];
	const teamState = DataModel.team_state[playerState.team];
	let tile = TileDB[playerState.location];
	if (IsPurchasableTile(tile)) {
		let propertyState = DataModel.property_ownership[tile.id];
		console.log(propertyState);
		// Owned property that isn't current player and it isn't mortgaged (-1)
		if (propertyState.owner > -1 && propertyState.owner !== playerState.team && propertyState.houseCount >= 0) {
			console.log("Well you need to pay up now");
			const price = CalculateRent(tile, playerState, propertyState);
			console.log({price, playerState, a:Number.isNaN(price)});
			if (Number.isNaN(price) && turnState.type === "card_result") {
				setTurnState(peer, {pID: playerState.pID, type: "auxroll_prompt", rolls: turnState.rolls, card: turnState.card});
			} else {
				setTurnState(peer, {pID: playerState.pID, type: "payrent", rolls: turnState.rolls, property: tile.id, price, potentialBankrupt: propertyState.owner});
			}
		}
		else if (propertyState.owner === -1) {
			setTurnState(peer, {pID: playerState.pID, type: "unowned", rolls: turnState.rolls, property: tile.id});
		} else {
			// owner exists but either current player owns it or its mortgaged. skip to endturn state
			setTurnState(peer, {type: "endturn", pID: playerState.pID, rolls: turnState.rolls});
		}
	} else if (tile.type === "Tax") {
		setTurnState(peer, {pID: playerState.pID, type: "payrent", rolls: turnState.rolls, property: tile.id, price: tile.cost, potentialBankrupt: -1});
	} else if (tile.type === "CardDraw") {
		setTurnState(peer, {type: "card_prompt", pID: playerState.pID, rolls: turnState.rolls, deck: tile.category as Deck});
	} else if (tile.id === "gotojail") {
		// FIXME
		//this.GotoJail();
	} else {
		dispatchState(peer, "monopolis:player_state:"+playerState.pID, playerState);
		setTurnState(peer, {type: "endturn", pID: playerState.pID, rolls: turnState.rolls});
	}
}
function StartTurn(peer: Peer, preRolled = false) {
	let turnState = DataModel.misc.current_turn;
	if (turnState.type !== "transition" && turnState.type !== "jailed") return;
	const playerState = DataModel.player_state[turnState.pID];
	console.log("Turn Start", playerState.pID);

	console.log(playerState.jailed);
	let indicators: Partial<Record<string, number>> = {};
	for (let i = 1; i <= 12; i++) {
		if (i % 2 === 1 && playerState.jailed > 1) continue;
		let indicatorSpot = (playerState.location + i) % 40;
		indicators[TileDB[indicatorSpot].id] = i;
	}
	if (preRolled || playerState.jailed > 0) {
		setTurnState(peer, {type: "jailed", pID: playerState.pID, rolls: turnState.rolls, indicators, preRolled});
	} else {
		setTurnState(peer, {type: "start", pID: playerState.pID, rolls: turnState.rolls, indicators});
	}
}
function NextTurn(peer: Peer) {
	// TODO: AntiCheat (check peer against current turn)
	let turnState = DataModel.misc.current_turn;
	if (turnState.type !== "endturn") return;

	let rollOrder = DataModel.misc.roll_order;
	let currentIndex = rollOrder.findIndex(pID => turnState.pID === pID);
	if (currentIndex === -1) {
		console.log(rollOrder, turnState.pID);
		throw "Can't find the index :(";
	}
	const aliveTeamIDs = Object.values(DataModel.team_state).filter(team => team.alive).map(team => team.tID);
	let playerStates = Object.values(DataModel.player_state).filter(player => aliveTeamIDs.indexOf(player.team) !== -1);
	console.log("Have we won yet?", playerStates.length);
	/*stats?.SetGameInfo({
		propertyOwnership: this.propertyOwnership.GetAllValues(),
		playerState: this.playerState.GetAllValues()
	});*/
	if (playerStates.length === 1) {
		console.log("Win?");
		// TODO: Replace with custom postgame as dedi servers instantly turn off when a winner is announced
		//GameRules.SetGameWinner(PlayerResource.GetPlayer(playerStates[0].pID)!.GetTeam());
	}
	let nextIndex = currentIndex as number;
	let nextPlayer: PlayerState;
	let nextTeam: TeamState;
	do {
		nextIndex = (nextIndex + 1) % Object.keys(rollOrder).length;
		let pID = rollOrder[nextIndex];
		nextPlayer = DataModel.player_state[pID];
		nextTeam = DataModel.team_state[nextPlayer.team];
		console.log(nextPlayer.pID, nextTeam.alive);
	} while (!nextTeam.alive);
	let savedTurn: TurnState = { pID: nextPlayer.pID, rolls: [], type: "transition"};
	setTurnState(peer, savedTurn);
	StartTurn(peer);
}
function MoveBackwardToLocation(peer: Peer, futureLocation: number) {
	if (futureLocation < 0) {
		futureLocation = 40 + futureLocation;
	}
	return MoveForwardToLocation(peer, futureLocation, true);
}
function MoveForwardToLocation(peer: Peer, futureLocation: number, backwards = false) {
	let turnState = DataModel.misc.current_turn;
	if (turnState.type !== "diceroll" && turnState.type !== "card_result") return;
	const playerState = DataModel.player_state[turnState.pID];
	const teamState = DataModel.team_state[playerState.team];
	// TODO: Switch to client side Tweening
	
	const stop = setInterval(() => {
		playerState.location += backwards ? -1 : 1;
		// TODO: Complex boards
		if (playerState.location > 39) {
			playerState.location = 0;
			// TODO: House rules
			teamState.money += 200;
			dispatchState(peer, "monopolis:team_state:"+teamState.tID, teamState);
		}
		dispatchState(peer, "monopolis:player_state:"+playerState.pID, playerState);
		if (playerState.location === futureLocation) {
			clearInterval(stop);
			OnTileLanded(peer);
		}
	}, 300);
}
function StartGame(peer: Peer): void {
	console.log("Game starting!");
	//CustomNetTables.SetTableValue("misc", "price_definition", TilesObj);
	DataModel.misc.housing_market = {houses: 32, hotels: 12};
	dispatchState(peer, "monopolis:housing_market", DataModel.misc.housing_market);
	DataModel.misc.ui_state = {type: "n/a"};
	dispatchState(peer, "monopolis:ui_state", DataModel.misc.ui_state);

	currentDecks = {
		Chance: ShuffleArray([...CardDeck.Chance]),
		CommunityChest: ShuffleArray([...CardDeck.CommunityChest]),
	}
	
	for (let tile of Object.values(TileDB)) {
		if (IsPurchasableTile(tile)) {
			DataModel.property_ownership[tile.id] = {
				houseCount: 0,
				owner: -1,
			};
			dispatchState(peer, "monopolis:property_ownership:"+tile.id, DataModel.property_ownership[tile.id]);
		}
	}
	setTurnState(peer, {pID: 0, rolls: [], type: "transition"});

	// TODO: Do logic to determine roll order
	let rollOrder: number[] = [];
	for (let [i, player] of DataModel.lobbyData.players.entries()) {
			rollOrder.push(i);
			DataModel.player_state[i] = {
				pID: i,
				location: 0,
				jailed: 0,
				name: player.name,
				colour: player.colour,
				team: player.team,
			};
			dispatchState(peer, "monopolis:player_state:"+i, DataModel.player_state[i]);
	}
	for (let [i, team] of DataModel.lobbyData.teams.entries()) {
			DataModel.team_state[i] = {
				tID: i,
				name: team.name,
				alive: Object.values(DataModel.player_state).filter(player => player.team === i).length > 0,
				money: 1500,
			};
			dispatchState(peer, "monopolis:team_state:"+i, DataModel.team_state[i]);
	}
	DataModel.misc.roll_order = rollOrder;
	dispatchState(peer, "monopolis:lobbyData", DataModel.lobbyData);
	StartTurn(peer);
}
function setTurnState(peer: Peer, turnState: TurnState) {
	DataModel.misc.current_turn = turnState;
	dispatchState(peer, "monopolis:current_turn", DataModel.misc.current_turn);
}
function Anticheat(peer: Peer, expectedPID: number) {
	const peerState = Object.values(PlayerMap).find(row => row.connected && row.peer === peer);
	if (!peerState) return true;
	const pID = DataModel.lobbyData.players.findIndex(player => player.localId === peerState.localId);
	if (expectedPID !== pID) return true;
	return false;
}
const EventHandlers: EventHandlers = {
	monopolis_requestdiceroll: function (peer: Peer, payload: undefined): void {
		// TODO: AntiCheat (check peer against current turn)
		let turnState = DataModel.misc.current_turn;
		if (turnState.type !== "start" && turnState.type !== "auxroll_prompt" && turnState.type !== "jailed") {
			return;
		}
		if (Anticheat(peer, turnState.pID)) {
			return;
		}

		// already rolled, dont show button again
		if (turnState.type === "jailed" && turnState.preRolled) return;

		let dice1 = RandomInt(1, 6);
		let dice2 = RandomInt(1, 6);
		const playerState = DataModel.player_state[turnState.pID];

		if (turnState.type === "auxroll_prompt") {
			let propertyState = DataModel.property_ownership[TileDB[playerState.location].id];
			// TODO: Make more generic
			let value = 10 * (dice1 + dice2);
			setTurnState(peer, { type: "auxroll_result", pID: playerState.pID, rolls: turnState.rolls, card: turnState.card, dice1, dice2, value, potentialBankrupt: propertyState.owner });
			return;
		}
		turnState.rolls = [...turnState.rolls, { dice1, dice2 }];

		// We are in jail and did NOT get doubles :(
		if (playerState.jailed > 0 && dice1 !== dice2) {
			playerState.jailed--;
			dispatchState(peer, "monopolis:player_state:" + playerState.pID, playerState);
			if (playerState.jailed === 0) {
				setTurnState(peer, turnState);
				// FIXME
				StartTurn(peer, true);
			} else {
				setTurnState(peer, { type: "endturn", pID: playerState.pID, rolls: turnState.rolls });
			}
			return;
		} else if (playerState.jailed > 0) {
			// FIXME
			/*this.LeaveJail();
			let oldRolls = turnState.rolls;
			const newcurrent = this.GetCurrentPlayerState();
			turnState.rolls = oldRolls;
			// cheesy logic to make sure its not treated as a double later on
			turnState.rolls.push({dice1: 1, dice2: -1});*/
		}
		setTurnState(peer, {
			pID: playerState.pID,
			type: "diceroll",
			rolls: turnState.rolls,
			dice1,
			dice2,
		});

		//if (dice1 === dice2 && turnState.rolls.length >= 3) {
		//	// FIXME
		//	//this.GotoJail();
		//	return;
		//} else {
			let futureLocation = (playerState.location + dice1 + dice2) % 40;
			console.log(playerState.location, dice1, dice2, futureLocation);
			dispatchState(peer, "monopolis:player_state:" + playerState.pID, playerState);
			MoveForwardToLocation(peer, futureLocation);
		//}
	},
	monopolis_requestpayrent: function (peer: Peer, payload: undefined): void {
		// TODO: AntiCheat (check peer against current turn)
		let turnState = DataModel.misc.current_turn;
		if (turnState.type !== "payrent" && turnState.type !== "jailed") {
			return;
		}
		if (Anticheat(peer, turnState.pID)) {
			return;
		}
		const playerState = DataModel.player_state[turnState.pID];
		const teamState = DataModel.team_state[playerState.team];

		if (turnState.type === "jailed") {
			if (teamState.money < 50) {
				// FIXME
				//HudErrorMessage("#monopolis_broke");
				return;
			}
			teamState.money -= 50;
			dispatchState(peer, "monopolis:team_state:" + playerState.team, teamState);
			// FIXME
			/*this.LeaveJail();
			current = this.GetCurrentPlayerState();
			if (turnState.preRolled === 1) {
				let diceRoll = toArray(turnState.rolls).pop();
				if (!diceRoll) throw new Error("Why is there no dice roll?");
				CustomNetTables.SetTableValue("misc", "current_turn", {type: "diceroll", dice1: diceRoll.dice1, dice2: diceRoll.dice2, pID: current.pID, rolls: turnState.rolls});
				MoveForwardToLocation(peer, (current.location + diceRoll.dice1 + diceRoll.dice2) % 40);
			} else {
				this.StartTurn();
			}*/
			return;
		}

		if (teamState.money < turnState.price) {
			// HudErrorMessage("#monopolis_broke");
			return;
		}

		let tile = TileDB.find(tile => tile.id === turnState.property);
		// need this check because it may be tax which has no owner
		if (IsPurchasableTile(tile)) {
			let propertyState = DataModel.property_ownership[tile.id];
			let owner = DataModel.team_state[propertyState.owner];
			owner.money += turnState.price;
			dispatchState(peer, "monopolis:team_state:" + propertyState.owner, owner);
		}
		teamState.money -= turnState.price;
		dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
		setTurnState(peer, { pID: playerState.pID, rolls: turnState.rolls, type: "endturn" });
	},
	monopolis_requestauction: function (peer: Peer, payload: undefined): void {
		//throw new Error("Function not implemented.");
	},
	monopolis_requestpurchase: function (peer: Peer, payload: undefined): void {
		// TODO: AntiCheat (check peer against current turn)
		let turnState = DataModel.misc.current_turn;
		if (turnState.type !== "unowned") return;
		if (Anticheat(peer, turnState.pID)) {
			return;
		}
		const playerState = DataModel.player_state[turnState.pID];
		const teamState = DataModel.team_state[playerState.team];

		let tile = TileDB.find(tile => tile.id === turnState.property);
		let propertyState = DataModel.property_ownership[turnState.property];
		if (!IsPurchasableTile(tile)) return;

		if (teamState.money < tile.purchasePrice) {
			//HudErrorMessage("#monopolis_broke");
			return;
		}
		teamState.money -= tile.purchasePrice;
		propertyState.owner = playerState.team;
		dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
		dispatchState(peer, "monopolis:property_ownership:" + turnState.property, propertyState);
		setTurnState(peer, { pID: playerState.pID, rolls: turnState.rolls, type: "endturn" });
	},
	monopolis_requestcard: function (peer: Peer, payload: undefined): void {
		// TODO: AntiCheat (check peer against current turn)
		let turnState = DataModel.misc.current_turn;
		if (turnState.type !== "card_prompt") return;
		if (Anticheat(peer, turnState.pID)) {
			return;
		}
		const playerState = DataModel.player_state[turnState.pID];

		let card = currentDecks[turnState.deck].shift();
		if (!card) {
			console.log("Why is the deck empty");
			return;
		}
		if (card.type !== "fuckjail") {
			currentDecks[turnState.deck].push(card);
		} else {
			// TODO: Work out how we are going to keep it
		}
		setTurnState(peer, { type: "card_result", pID: playerState.pID, rolls: turnState.rolls, card, potentialBankrupt: -1 });
	},
	monopolis_acknowledgecard: function (peer: Peer, payload: undefined): void {
		// TODO: AntiCheat (check peer against current turn)
		let turnState = DataModel.misc.current_turn;
		if (turnState.type !== "auxroll_result" && turnState.type !== "card_result") return;
		if (Anticheat(peer, turnState.pID)) {
			return;
		}
		const playerState = DataModel.player_state[turnState.pID];
		const teamState = DataModel.team_state[playerState.team];
		if (turnState.type === "auxroll_result") {
			if (teamState.money < turnState.value) {
				// FIXME
				//HudErrorMessage("#monopolis_broke");
				return;
			}
			teamState.money -= turnState.value;
			let tile = TileDB[playerState.location];
			let propertyOwnership = DataModel.property_ownership[tile.id];
			let owner = DataModel.team_state[propertyOwnership.owner];
			owner.money += turnState.value;
			setTurnState(peer, { type: "endturn", pID: playerState.pID, rolls: turnState.rolls });
			dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
			dispatchState(peer, "monopolis:team_state:" + owner.tID, owner);
			return;
		}
		let card = turnState.card;
		switch (card.type) {
			case "jail":
				// FIXME
				//this.GotoJail();
				return;
			case "money_gain":
				teamState.money += card.value;
				dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
				break;
			case "money_gain_others":
				let playerCountGain = 0;
				for (let otherTeam of Object.values(DataModel.team_state)) {
					if (teamState.tID === otherTeam.tID) continue;
					if (otherTeam.alive === false) { continue; }
					// TODO: Handle bankrupt scenario
					otherTeam.money -= card.value;
					dispatchState(peer, "monopolis:team_state:" + otherTeam.tID, otherTeam);
					playerCountGain++;
				}
				teamState.money += (card.value * playerCountGain);
				dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
				break;
			case "money_lose":
				if (teamState.money < card.value) {
					// FIXME
					//HudErrorMessage("#monopolis_broke");
					return;
				}
				teamState.money -= card.value;
				dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
				break;
			case "money_lose_others":
				let otherTeams = [];
				for (let otherTeam of Object.values(DataModel.team_state)) {
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
					dispatchState(peer, "monopolis:team_state:" + otherTeam.tID, otherTeam);
				}
				dispatchState(peer, "monopolis:team_state:" + teamState.tID, teamState);
				break;
			case "repairs":
				console.log("Fuck repairs");
				break;
			case "teleport":
				MoveForwardToLocation(peer, TileDB.findIndex(tile => tile.id === card.dest));
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
				MoveForwardToLocation(peer, dest.index);
				return;
			case "teleport_relative":
				if (card.value >= 0)
					MoveForwardToLocation(peer, playerState.location + card.value);

				else
					MoveBackwardToLocation(peer, playerState.location + card.value);
				return;
		}
		setTurnState(peer, { type: "endturn", pID: playerState.pID, rolls: turnState.rolls });
	},
	monopolis_endturn: function (peer: Peer, payload: undefined): void {
		// TODO: AntiCheat (check peer against current turn)
		let turnState = DataModel.misc.current_turn;
		if (turnState.type !== "endturn") return;
		if (Anticheat(peer, turnState.pID)) {
			return;
		}
		const playerState = DataModel.player_state[turnState.pID];

		let endturn = true;
		if (playerState.jailed === 0 && turnState.rolls.length > 0 && turnState.rolls.length < 3) {
			let diceRolls = turnState.rolls[turnState.rolls.length - 1];
			if (diceRolls.dice1 === diceRolls.dice2) {
				console.log("End turn bypassed by doubles?");
				endturn = false;
			}
		}
		if (endturn) {
			NextTurn(peer);
		} else {
			let indicators: Partial<Record<string, number>> = {};
			for (let i = 1; i <= 12; i++) {
				let indicatorSpot = (playerState.location + i) % 40;
				indicators[TileDB[indicatorSpot].id] = i;
			}
			setTurnState(peer, { type: "start", pID: playerState.pID, rolls: turnState.rolls, indicators });
		}
	},
	monopolis_requestrenovation: function (peer: Peer, payload: MonopolisRenovationEvent): void {
		throw new Error("Function not implemented.");
	},
	monopolis_requesttrade: function (peer: Peer, payload: undefined): void {
		//throw new Error("Function not implemented.");
	},
	monopolis_requestbankrupt: function (peer: Peer, payload: undefined): void {
		throw new Error("Function not implemented.");
	},
	monopolis_auctionbid: function (peer: Peer, payload: MonopolisAuctionBid): void {
		throw new Error("Function not implemented.");
	},
	monopolis_auctionwithdraw: function (peer: Peer, payload: undefined): void {
		throw new Error("Function not implemented.");
	},
	monopolis_trade: function (peer: Peer, payload: MonopolisTradeEvent): void {
		throw new Error("Function not implemented.");
	},
	lobby_addteam: function (peer: Peer, payload: LobbyAddTeamEvent): void {
		let turnState = DataModel.misc.current_turn;
		if (turnState.type !== "lobby") return;
		const lobbyState = DataModel.lobbyData;
		if (lobbyState.started) return;
		if (lobbyState.teams.length === MAX_TEAMS) return;
		lobbyState.teams.push({
			name: payload.teamName
		});
		dispatchState(peer, "monopolis:lobbyData", DataModel.lobbyData);
	},
	lobby_addplayer: function (peer: Peer, payload: LobbyAddPlayerEvent): void {
		let turnState = DataModel.misc.current_turn;
		if (turnState.type !== "lobby") return;
		const lobbyState = DataModel.lobbyData;
		if (lobbyState.started) return;
		if (lobbyState.players.length === MAX_PLAYERS) return;
		lobbyState.players.push({
			colour: payload.playerColour,
			name: payload.playerName,
			localId: payload.localId,
			team: -1,
		});
		PlayerMap[payload.localId] = {
			connected: true,
			localId: payload.localId,
			peer
		};
		dispatchState(peer, "monopolis:lobbyData", DataModel.lobbyData);
	},
	lobby_jointeam: function (peer: Peer, payload: LobbyJoinTeamEvent): void {
		let turnState = DataModel.misc.current_turn;
		if (turnState.type !== "lobby") return;
		const lobbyState = DataModel.lobbyData;
		if (lobbyState.started) return;
		const peerState = Object.entries(PlayerMap).find(row => row[1].connected && row[1].peer === peer);
		if (!peerState) return;
		const lobbyPlayer = lobbyState.players.find(player => player.localId === peerState[0]);
		if (!lobbyPlayer || lobbyPlayer.team !== -1) return;
		if (payload.teamId < 0 || payload.teamId >= lobbyState.teams.length) return;
		lobbyPlayer.team = payload.teamId;
		dispatchState(peer, "monopolis:lobbyData", DataModel.lobbyData);
	},
	lobby_start: function (peer: Peer, payload: undefined): void {
		console.log("Lobby Start?")
		let turnState = DataModel.misc.current_turn;
		console.log(turnState);
		if (turnState.type !== "lobby") return;
		const lobbyState = DataModel.lobbyData;
		console.log(lobbyState);
		if (lobbyState.started) return;
		const peerState = Object.entries(PlayerMap).find(row => row[1].connected && row[1].peer === peer);
		console.log(peerState);
		if (!peerState) return;
		const firstPlayer = lobbyState.players[0];
		console.log(firstPlayer);
		if (!firstPlayer || firstPlayer.localId !== peerState[1].localId) return;
		lobbyState.started = true;
		StartGame(peer);
	}
}

function subscribeToLatest(peer: Peer, event: {id: string, value: any}) {
	peer.subscribe(event.id);
	peer.send({...event, type: "init"});
}

setInterval(() => {
	for (let connection of Object.values(PlayerMap)) {
		if (connection.connected) {
			connection.peer.send({type: "ping"});
		}
	}
}, 30_000);

export default eventHandler({
	handler: () => {},
	websocket: defineWebSocket({
		async open(peer) {
			console.log("WebSocket opened");
			// TODO: Refactor if multi-lobby is ever made
			for (let i = 0; i < MAX_PLAYERS; i++) {
				subscribeToLatest(peer, {id: `monopolis:player_state:${i}`, value: DataModel.player_state[i]});
			}
			for (let i = 0; i < MAX_TEAMS; i++) {
				subscribeToLatest(peer, {id: `monopolis:team_state:${i}`, value: DataModel.team_state[i]});
			}
			for (let tile of Object.values(TileDB)) {
				if (IsPurchasableTile(tile)) {
					subscribeToLatest(peer, {id: `monopolis:property_ownership:${tile.id}`, value: DataModel.property_ownership[tile.id]});
				}
			}
			subscribeToLatest(peer, {id: "monopolis:auction", value: DataModel.misc.auction});
			subscribeToLatest(peer, {id: "monopolis:current_turn", value: DataModel.misc.current_turn});
			subscribeToLatest(peer, {id: "monopolis:housing_market", value: DataModel.misc.housing_market});
			subscribeToLatest(peer, {id: "monopolis:roll_order", value: DataModel.misc.roll_order});
			subscribeToLatest(peer, {id: "monopolis:trade", value: DataModel.misc.trade});
			subscribeToLatest(peer, {id: "monopolis:ui_state", value: DataModel.misc.ui_state});
			subscribeToLatest(peer, {id: "monopolis:lobbyData", value: DataModel.lobbyData});
		},
		async message(peer, event) {
			console.log("WebSocket message", event);
            let msg = JSON.parse(event.text()) as WSMessage;

            if (msg.type === "register") {
                peer.subscribe(msg.id);
				if (DataState[msg.id]) {
					console.log("Already registered, sending cached value" + DataState[msg.id]);
					peer.send({id: msg.id, value: DataState[msg.id]});
				}
            }
			if (msg.type === "resume") {
				const priorData = PlayerMap[msg.localId];
				if (priorData && !priorData.connected) {
					PlayerMap[msg.localId] = {
						...priorData,
						connected: true,
						peer,
					};
				}
			}
            /*if (msg.type === "change") {
				// TODO: Server Validation
				DataState[msg.id] = msg.value;
                peer.publish(msg.id, msg);
            }*/
			if (msg.type === "event") {
				EventHandlers[msg.id](peer, msg.payload as unknown as never);
			}
		},
		async close(peer) {
			const peers = Object.values(PlayerMap).filter(row => row.connected && row.peer === peer) as PlayerInfo[];
			for (let dcPeer of peers) {
				dcPeer.connected = false;
				(dcPeer as any).peer = undefined;
			}
			console.log("WebSocket closed");
		},
	}),
});